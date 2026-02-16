from __future__ import annotations

import math

from PySide6.QtCore import QTimer
from PySide6.QtGui import QColor, QPainter, QPen, QRadialGradient
from PySide6.QtWidgets import QWidget


class OrbWidget(QWidget):
    def __init__(self, accent_primary: str, accent_secondary: str, parent=None) -> None:
        super().__init__(parent)
        self.setMinimumSize(260, 260)
        self._accent_primary = QColor(accent_primary)
        self._accent_secondary = QColor(accent_secondary)
        self._phase = 0.0
        self._mic_level = 0.0
        self._mode = "idle"

        self._timer = QTimer(self)
        self._timer.timeout.connect(self._tick)
        self._timer.start(16)

    def set_mode(self, mode: str) -> None:
        self._mode = mode
        self.update()

    def set_mic_level(self, level: float) -> None:
        self._mic_level = max(0.0, min(1.0, level))
        self.update()

    def _tick(self) -> None:
        self._phase += 0.04
        self.update()

    def paintEvent(self, event) -> None:  # noqa: N802
        painter = QPainter(self)
        painter.setRenderHint(QPainter.Antialiasing)
        painter.fillRect(self.rect(), QColor(0, 0, 0, 0))

        center = self.rect().center()
        base_radius = min(self.width(), self.height()) * 0.22

        if self._mode == "idle":
            dynamic = math.sin(self._phase) * 7
        elif self._mode == "listening":
            dynamic = math.sin(self._phase * 3.0) * 12 + (self._mic_level * 18)
        elif self._mode == "speaking":
            dynamic = math.sin(self._phase * 2.4) * 15 + 8
        else:
            dynamic = math.sin(self._phase * 1.6) * 3

        main_radius = base_radius + dynamic

        glow = QRadialGradient(center, main_radius * 2.8)
        glow.setColorAt(0.0, QColor(self._accent_primary.red(), self._accent_primary.green(), self._accent_primary.blue(), 130))
        glow.setColorAt(0.55, QColor(self._accent_secondary.red(), self._accent_secondary.green(), self._accent_secondary.blue(), 70))
        glow.setColorAt(1.0, QColor(0, 0, 0, 0))
        painter.setBrush(glow)
        painter.setPen(QPen(QColor(0, 0, 0, 0)))
        painter.drawEllipse(center, int(main_radius * 2.8), int(main_radius * 2.8))

        core = QRadialGradient(center, main_radius)
        core.setColorAt(0.0, QColor(180, 241, 255, 240))
        core.setColorAt(0.5, QColor(self._accent_primary.red(), self._accent_primary.green(), self._accent_primary.blue(), 220))
        core.setColorAt(1.0, QColor(self._accent_secondary.red(), self._accent_secondary.green(), self._accent_secondary.blue(), 180))
        painter.setBrush(core)
        painter.drawEllipse(center, int(main_radius), int(main_radius))

        # Gloss layer to emulate a liquid-glass orb cap.
        gloss = QRadialGradient(
            center.x() - int(main_radius * 0.35),
            center.y() - int(main_radius * 0.45),
            main_radius * 0.95,
        )
        gloss.setColorAt(0.0, QColor(255, 255, 255, 130))
        gloss.setColorAt(0.42, QColor(220, 242, 255, 48))
        gloss.setColorAt(1.0, QColor(255, 255, 255, 0))
        painter.setBrush(gloss)
        painter.setPen(QPen(QColor(0, 0, 0, 0)))
        painter.drawEllipse(center, int(main_radius * 0.98), int(main_radius * 0.98))

        ring_color = QColor(102, 235, 255, 160 if self._mode != "error" else 70)
        if self._mode == "error":
            ring_color = QColor(255, 72, 102, 220)
        painter.setBrush(QColor(0, 0, 0, 0))
        painter.setPen(QPen(ring_color, 2.0))
        painter.drawEllipse(center, int(main_radius * 1.45), int(main_radius * 1.45))

        ripple_alpha = 110 if self._mode in {"listening", "speaking"} else 55
        ripple_radius = main_radius * (1.75 + (0.08 * math.sin(self._phase * 2.2)))
        painter.setPen(QPen(QColor(197, 241, 255, ripple_alpha), 1.2))
        painter.drawEllipse(center, int(ripple_radius), int(ripple_radius))
