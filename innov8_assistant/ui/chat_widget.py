from __future__ import annotations

from PySide6.QtCore import QTimer, Qt
from PySide6.QtWidgets import (
    QFrame,
    QLabel,
    QScrollArea,
    QSizePolicy,
    QVBoxLayout,
    QWidget,
    QHBoxLayout,
)


class MessageBubble(QFrame):
    def __init__(self, role: str, text: str, typing_animation: bool = False, parent=None) -> None:
        super().__init__(parent)
        self.role = role
        self._full_text = text
        self._typing_animation = typing_animation
        self._typed = ""
        self._index = 0

        self.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Fixed)
        self.setObjectName("MessageBubble")
        self.label = QLabel("")
        self.label.setWordWrap(True)
        self.label.setTextInteractionFlags(Qt.TextSelectableByMouse)
        self.label.setObjectName("MessageText")

        layout = QVBoxLayout(self)
        layout.setContentsMargins(14, 10, 14, 10)
        layout.addWidget(self.label)

        self.setStyleSheet(self._style())
        if typing_animation and role == "assistant":
            self._timer = QTimer(self)
            self._timer.timeout.connect(self._type_next)
            self._timer.start(14)
        else:
            self.label.setText(text)

    def _type_next(self) -> None:
        self._index += 1
        self._typed = self._full_text[: self._index]
        self.label.setText(self._typed)
        if self._index >= len(self._full_text):
            self._timer.stop()

    def _style(self) -> str:
        if self.role == "user":
            return """
            #MessageBubble {
                background: qlineargradient(x1:0, y1:0, x2:1, y2:1,
                    stop:0 rgba(103, 170, 255, 0.34),
                    stop:1 rgba(57, 112, 255, 0.22));
                border: 1px solid rgba(161, 209, 255, 0.62);
                border-radius: 16px;
            }
            #MessageText { color: #F2F8FF; font-size: 14px; }
            """
        return """
        #MessageBubble {
            background: qlineargradient(x1:0, y1:0, x2:1, y2:1,
                stop:0 rgba(102, 237, 255, 0.21),
                stop:1 rgba(136, 116, 255, 0.16));
            border: 1px solid rgba(197, 236, 255, 0.55);
            border-radius: 16px;
        }
        #MessageText { color: #F3FCFF; font-size: 14px; }
        """


class ChatView(QWidget):
    def __init__(self, parent=None) -> None:
        super().__init__(parent)
        self.scroll = QScrollArea(self)
        self.scroll.setWidgetResizable(True)
        self.scroll.setFrameShape(QFrame.NoFrame)
        self.scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarAlwaysOff)
        self.scroll.setStyleSheet(
            """
            QScrollArea { background: transparent; }
            QScrollArea > QWidget > QWidget { background: transparent; }
            """
        )

        self.inner = QWidget()
        self.inner.setStyleSheet("background: transparent;")
        self.inner_layout = QVBoxLayout(self.inner)
        self.inner_layout.setContentsMargins(6, 6, 6, 6)
        self.inner_layout.setSpacing(10)
        self.inner_layout.addStretch(1)
        self.scroll.setWidget(self.inner)
        self.scroll.viewport().setStyleSheet("background: transparent;")

        root = QVBoxLayout(self)
        root.setContentsMargins(0, 0, 0, 0)
        root.addWidget(self.scroll)

    def add_message(self, role: str, text: str, typing_animation: bool = False) -> None:
        row = QWidget()
        row_layout = QHBoxLayout(row)
        row_layout.setContentsMargins(4, 0, 4, 0)

        bubble = MessageBubble(role=role, text=text, typing_animation=typing_animation)
        bubble.setMaximumWidth(560)

        if role == "user":
            row_layout.addStretch(1)
            row_layout.addWidget(bubble, alignment=Qt.AlignRight)
        else:
            row_layout.addWidget(bubble, alignment=Qt.AlignLeft)
            row_layout.addStretch(1)

        self.inner_layout.insertWidget(self.inner_layout.count() - 1, row)
        QTimer.singleShot(0, self._scroll_to_bottom)

    def _scroll_to_bottom(self) -> None:
        bar = self.scroll.verticalScrollBar()
        bar.setValue(bar.maximum())
