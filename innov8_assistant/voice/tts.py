from __future__ import annotations

import queue
import re
import threading
import time
from typing import Any

from PySide6.QtCore import QObject, Signal


class TextToSpeechEngine(QObject):
    started = Signal()
    finished = Signal()
    error = Signal(str)

    def __init__(self, rate: int, volume: float, logger: Any) -> None:
        super().__init__()
        self.rate = rate
        self.volume = volume
        self.logger = logger
        self._queue: queue.Queue[str] = queue.Queue(maxsize=40)
        self._stop_event = threading.Event()
        self._worker = threading.Thread(target=self._loop, daemon=True)
        self._worker.start()

    def speak_async(self, text: str) -> None:
        if not text.strip():
            return
        try:
            self._queue.put_nowait(text.strip())
        except queue.Full:
            self.logger.warning("TTS queue full; dropping response")

    def shutdown(self) -> None:
        self._stop_event.set()
        if self._worker.is_alive():
            self._worker.join(timeout=1.2)

    def _loop(self) -> None:
        try:
            import pyttsx3

            engine = pyttsx3.init()
            engine.setProperty("rate", self.rate)
            engine.setProperty("volume", self.volume)
        except Exception as exc:
            self.error.emit(f"Text-to-speech unavailable: {exc}")
            return

        while not self._stop_event.is_set():
            try:
                text = self._queue.get(timeout=0.15)
            except queue.Empty:
                continue

            try:
                self.started.emit()
                for chunk in _split_with_pauses(text):
                    engine.say(chunk)
                    engine.runAndWait()
                    time.sleep(_pause_for_chunk(chunk))
                self.finished.emit()
            except Exception as exc:
                self.logger.exception("TTS playback failed")
                self.error.emit(str(exc))
                self.finished.emit()


def _split_with_pauses(text: str) -> list[str]:
    parts = [part.strip() for part in re.split(r"(?<=[,.;:!?])\s+", text) if part.strip()]
    return parts or [text]


def _pause_for_chunk(chunk: str) -> float:
    if chunk.endswith(("?", "!", ".")):
        return 0.2
    if chunk.endswith((",", ";", ":")):
        return 0.12
    return 0.06
