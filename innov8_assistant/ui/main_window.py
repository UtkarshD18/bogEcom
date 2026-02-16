from __future__ import annotations

from enum import Enum

from PySide6.QtCore import QEasingCurve, QPropertyAnimation, QPoint, QTimer, Qt, Signal
from PySide6.QtGui import QColor, QLinearGradient, QPainter, QPainterPath, QPen, QRadialGradient
from PySide6.QtWidgets import (
    QFrame,
    QGraphicsDropShadowEffect,
    QHBoxLayout,
    QLabel,
    QToolButton,
    QPushButton,
    QVBoxLayout,
    QWidget,
)

from innov8_assistant.ui.chat_widget import ChatView
from innov8_assistant.ui.orb_widget import OrbWidget


class AssistantVisualState(str, Enum):
    IDLE = "idle"
    LISTENING = "listening"
    SPEAKING = "speaking"
    ERROR = "error"


class DotIndicator(QWidget):
    def __init__(self, parent=None) -> None:
        super().__init__(parent)
        self._color = QColor("#4A90E2")
        self.setFixedSize(14, 14)

    def set_color(self, color: str) -> None:
        self._color = QColor(color)
        self.update()

    def paintEvent(self, event) -> None:  # noqa: N802
        painter = QPainter(self)
        painter.setRenderHint(QPainter.Antialiasing)
        painter.setBrush(self._color)
        painter.setPen(Qt.NoPen)
        painter.drawEllipse(0, 0, self.width(), self.height())


class GlassPanel(QFrame):
    def __init__(self, parent=None) -> None:
        super().__init__(parent)
        self.setObjectName("GlassPanel")

    def paintEvent(self, event) -> None:  # noqa: N802
        painter = QPainter(self)
        painter.setRenderHint(QPainter.Antialiasing)

        rect = self.rect().adjusted(1, 1, -1, -1)
        radius = 24

        body = QLinearGradient(rect.topLeft(), rect.bottomRight())
        body.setColorAt(0.0, QColor(255, 255, 255, 26))
        body.setColorAt(0.3, QColor(215, 234, 255, 14))
        body.setColorAt(1.0, QColor(143, 171, 209, 8))

        path = QPainterPath()
        path.addRoundedRect(rect, radius, radius)
        painter.fillPath(path, body)

        border = QLinearGradient(rect.topLeft(), rect.bottomRight())
        border.setColorAt(0.0, QColor(255, 255, 255, 96))
        border.setColorAt(0.6, QColor(145, 216, 255, 62))
        border.setColorAt(1.0, QColor(118, 130, 255, 52))
        painter.setPen(QPen(border, 1.2))
        painter.drawPath(path)

        # Liquid-glass specular highlight strip.
        highlight = QLinearGradient(rect.left(), rect.top(), rect.left(), rect.top() + rect.height() * 0.45)
        highlight.setColorAt(0.0, QColor(255, 255, 255, 74))
        highlight.setColorAt(1.0, QColor(255, 255, 255, 0))
        painter.fillPath(path, highlight)


class AssistantWindow(QWidget):
    listen_requested = Signal()
    stop_listening_requested = Signal()
    shutdown_requested = Signal()

    def __init__(self, assistant_name: str, accent_primary: str, accent_secondary: str, fade_ms: int) -> None:
        super().__init__()
        self.assistant_name = assistant_name
        self._drag_offset = QPoint()
        self._glow_tick = 0
        self._live_text_opacity = 1.0
        self._fade_timer = QTimer(self)
        self._fade_timer.setInterval(55)
        self._fade_timer.timeout.connect(self._fade_live_text_step)
        self._accent_primary = accent_primary
        self._accent_secondary = accent_secondary

        self.setWindowTitle(f"{assistant_name} Assistant")
        self.setMinimumSize(860, 640)
        self.setWindowFlags(Qt.FramelessWindowHint | Qt.Window)
        self.setAttribute(Qt.WA_TranslucentBackground)

        root = QVBoxLayout(self)
        root.setContentsMargins(26, 26, 26, 26)
        root.setSpacing(0)

        self.container = GlassPanel(self)
        self.container.setObjectName("Container")
        self.container.setStyleSheet(
            f"""
            #Container {{
                background: qlineargradient(x1:0, y1:0, x2:1, y2:1,
                    stop:0 rgba(15, 20, 33, 231),
                    stop:0.52 rgba(18, 24, 42, 225),
                    stop:1 rgba(20, 16, 34, 222)
                );
                border: 1px solid rgba(173, 224, 255, 0.24);
                border-radius: 28px;
            }}
            QLabel {{
                color: #E7EEFF;
            }}
            """
        )
        root.addWidget(self.container)

        glass = QVBoxLayout(self.container)
        glass.setContentsMargins(28, 22, 28, 22)
        glass.setSpacing(16)

        shadow = QGraphicsDropShadowEffect(self.container)
        shadow.setBlurRadius(50)
        shadow.setOffset(0, 20)
        shadow.setColor(QColor(5, 15, 32, 170))
        self.container.setGraphicsEffect(shadow)

        header = QHBoxLayout()
        header.setContentsMargins(2, 2, 2, 4)
        header.setSpacing(12)

        left_actions = QHBoxLayout()
        left_actions.setSpacing(8)
        self.min_button = self._make_header_button("—")
        self.min_button.clicked.connect(self.showMinimized)
        self.close_button = self._make_header_button("✕")
        self.close_button.clicked.connect(self.close)
        left_actions.addWidget(self.min_button)
        left_actions.addWidget(self.close_button)
        header.addLayout(left_actions)
        header.addStretch(1)
        self.header_label = QLabel(assistant_name)
        self.header_label.setStyleSheet(
            "font-size: 30px; font-weight: 700; letter-spacing: 1px; color: rgba(242, 249, 255, 0.98);"
        )
        header.addWidget(self.header_label)
        self.status_dot = DotIndicator()
        header.addWidget(self.status_dot)
        header.addStretch(1)
        header.addSpacing(90)
        glass.addLayout(header)

        self.orb = OrbWidget(accent_primary=accent_primary, accent_secondary=accent_secondary)
        orb_row = QHBoxLayout()
        orb_row.addStretch(1)
        orb_row.addWidget(self.orb)
        orb_row.addStretch(1)
        glass.addLayout(orb_row)

        self.live_text = QLabel("I am listening.")
        self.live_text.setAlignment(Qt.AlignCenter)
        self.live_text.setStyleSheet(
            "font-size: 17px; color: rgba(227, 241, 255, 0.95); font-weight: 500;"
        )
        glass.addWidget(self.live_text)

        controls_row = QHBoxLayout()
        controls_row.addStretch(1)
        self.control_button = QPushButton("Tap to Listen")
        self.control_button.setCursor(Qt.PointingHandCursor)
        self.control_button.setFixedHeight(58)
        self.control_button.setMinimumWidth(260)
        self.control_button.clicked.connect(self._toggle_listening)
        controls_row.addWidget(self.control_button)
        controls_row.addStretch(1)
        glass.addLayout(controls_row)

        self.chat_view = ChatView()
        self.chat_view.setMinimumHeight(250)
        self.chat_view.setStyleSheet(
            """
            QScrollArea {
                background: qlineargradient(x1:0, y1:0, x2:0, y2:1,
                    stop:0 rgba(255, 255, 255, 0.08),
                    stop:1 rgba(255, 255, 255, 0.02));
                border-radius: 20px;
                border: 1px solid rgba(188, 220, 255, 0.24);
                padding: 8px;
            }
            """
        )
        glass.addWidget(self.chat_view, 1)

        self._glow_timer = QTimer(self)
        self._glow_timer.timeout.connect(self._animate_listening_button)
        self._apply_button_style(active=False)
        self._set_state(AssistantVisualState.IDLE)
        self._play_fade_in(duration_ms=fade_ms)

    def _play_fade_in(self, duration_ms: int) -> None:
        self.setWindowOpacity(0.0)
        animation = QPropertyAnimation(self, b"windowOpacity")
        animation.setDuration(duration_ms)
        animation.setStartValue(0.0)
        animation.setEndValue(1.0)
        animation.setEasingCurve(QEasingCurve.OutCubic)
        animation.start()
        self._fade_animation = animation

    def set_live_text(self, text: str, auto_fade_ms: int | None = None) -> None:
        self.live_text.setText(text)
        self._live_text_opacity = 1.0
        self.live_text.setStyleSheet("font-size: 17px; color: rgba(215, 236, 255, 0.92);")
        self._fade_timer.stop()
        if auto_fade_ms:
            QTimer.singleShot(auto_fade_ms, self._fade_timer.start)

    def _fade_live_text_step(self) -> None:
        self._live_text_opacity -= 0.06
        if self._live_text_opacity <= 0.15:
            self._fade_timer.stop()
            self.live_text.setText("")
            return
        alpha = int(255 * self._live_text_opacity)
        self.live_text.setStyleSheet(
            f"font-size: 17px; color: rgba(227, 241, 255, {alpha}); font-weight: 500;"
        )

    def set_visual_state(self, state: AssistantVisualState) -> None:
        self._set_state(state)

    def set_mic_level(self, level: float) -> None:
        self.orb.set_mic_level(level)

    def set_button_mode(self, text: str, listening: bool) -> None:
        self.control_button.setText(text)
        if listening:
            if not self._glow_timer.isActive():
                self._glow_timer.start(160)
            self._apply_button_style(active=True)
        else:
            self._glow_timer.stop()
            self._apply_button_style(active=False)

    def add_user_message(self, text: str) -> None:
        self.chat_view.add_message("user", text, typing_animation=False)

    def add_assistant_message(self, text: str, typing_animation: bool = True) -> None:
        self.chat_view.add_message("assistant", text, typing_animation=typing_animation)

    def closeEvent(self, event) -> None:  # noqa: N802
        self.shutdown_requested.emit()
        super().closeEvent(event)

    def mousePressEvent(self, event) -> None:  # noqa: N802
        if event.button() == Qt.LeftButton:
            self._drag_offset = event.globalPosition().toPoint() - self.frameGeometry().topLeft()
            event.accept()

    def mouseMoveEvent(self, event) -> None:  # noqa: N802
        if event.buttons() & Qt.LeftButton:
            self.move(event.globalPosition().toPoint() - self._drag_offset)
            event.accept()

    def _toggle_listening(self) -> None:
        if self.control_button.text().lower().startswith("listening"):
            self.stop_listening_requested.emit()
            return
        self.listen_requested.emit()

    def _set_state(self, state: AssistantVisualState) -> None:
        colors = {
            AssistantVisualState.IDLE: "#4FA7FF",
            AssistantVisualState.LISTENING: "#30E08D",
            AssistantVisualState.SPEAKING: "#35D9FF",
            AssistantVisualState.ERROR: "#FF5268",
        }
        self.status_dot.set_color(colors[state])
        self.orb.set_mode(state.value)
        subtitle = {
            AssistantVisualState.IDLE: "Idle",
            AssistantVisualState.LISTENING: "Listening",
            AssistantVisualState.SPEAKING: "Speaking",
            AssistantVisualState.ERROR: "Error",
        }[state]
        self.header_label.setText(f"{self.assistant_name} · {subtitle}")

    def _animate_listening_button(self) -> None:
        self._glow_tick = (self._glow_tick + 1) % 8
        self._apply_button_style(active=True)

    def _apply_button_style(self, active: bool) -> None:
        if active:
            alpha = 120 + (self._glow_tick * 14)
            shadow = QGraphicsDropShadowEffect(self.control_button)
            shadow.setBlurRadius(34)
            shadow.setOffset(0, 0)
            shadow.setColor(QColor(38, 215, 255, min(220, alpha)))
            self.control_button.setGraphicsEffect(shadow)
            self.control_button.setStyleSheet(
                """
                QPushButton {
                    color: #081621;
                    font-size: 18px;
                    font-weight: 700;
                    border-radius: 22px;
                    border: 1px solid rgba(194, 238, 255, 0.86);
                    background: qlineargradient(x1:0, y1:0, x2:1, y2:0,
                        stop:0 rgba(179, 246, 255, 0.93),
                        stop:0.55 rgba(118, 216, 255, 0.92),
                        stop:1 rgba(165, 163, 255, 0.9));
                    padding: 12px 26px;
                }
                """
            )
            return

        self.control_button.setGraphicsEffect(None)
        self.control_button.setStyleSheet(
            """
            QPushButton {
                color: #F0F6FF;
                font-size: 18px;
                font-weight: 700;
                border-radius: 22px;
                border: 1px solid rgba(196, 233, 255, 0.38);
                background: qlineargradient(x1:0, y1:0, x2:1, y2:1,
                    stop:0 rgba(52, 72, 110, 0.64),
                    stop:1 rgba(38, 45, 78, 0.62));
                padding: 12px 26px;
            }
            QPushButton:hover {
                background: rgba(59, 86, 138, 0.84);
            }
            """
        )

    def _make_header_button(self, symbol: str) -> QToolButton:
        button = QToolButton(self)
        button.setText(symbol)
        button.setCursor(Qt.PointingHandCursor)
        button.setFixedSize(28, 28)
        button.setStyleSheet(
            """
            QToolButton {
                color: rgba(239, 247, 255, 0.86);
                border-radius: 14px;
                border: 1px solid rgba(197, 232, 255, 0.28);
                background: rgba(255, 255, 255, 0.1);
                font-size: 12px;
                font-weight: 700;
            }
            QToolButton:hover {
                background: rgba(129, 208, 255, 0.25);
            }
            """
        )
        return button

    def paintEvent(self, event) -> None:  # noqa: N802
        painter = QPainter(self)
        painter.setRenderHint(QPainter.Antialiasing)

        bg = QLinearGradient(self.rect().topLeft(), self.rect().bottomRight())
        bg.setColorAt(0.0, QColor(7, 12, 24, 255))
        bg.setColorAt(0.4, QColor(12, 16, 28, 255))
        bg.setColorAt(1.0, QColor(14, 9, 24, 255))
        painter.fillRect(self.rect(), bg)

        center_a = QPoint(int(self.width() * 0.18), int(self.height() * 0.16))
        glow_a = QRadialGradient(center_a, int(self.width() * 0.36))
        glow_a.setColorAt(0.0, QColor(55, 174, 255, 62))
        glow_a.setColorAt(1.0, QColor(55, 174, 255, 0))
        painter.setBrush(glow_a)
        painter.setPen(Qt.NoPen)
        painter.drawEllipse(center_a, int(self.width() * 0.36), int(self.width() * 0.36))

        center_b = QPoint(int(self.width() * 0.82), int(self.height() * 0.24))
        glow_b = QRadialGradient(center_b, int(self.width() * 0.31))
        glow_b.setColorAt(0.0, QColor(152, 110, 255, 56))
        glow_b.setColorAt(1.0, QColor(152, 110, 255, 0))
        painter.setBrush(glow_b)
        painter.drawEllipse(center_b, int(self.width() * 0.31), int(self.width() * 0.31))

        super().paintEvent(event)
