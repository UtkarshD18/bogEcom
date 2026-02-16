from __future__ import annotations

import signal
import sys
from concurrent.futures import ThreadPoolExecutor

from PySide6.QtCore import QObject, QTimer, Signal
from PySide6.QtWidgets import QApplication, QMenu, QStyle, QSystemTrayIcon

from innov8_assistant.commands import CommandRegistry, CommandResponse
from innov8_assistant.config import load_config
from innov8_assistant.system_control import AppLauncher, FileFinder
from innov8_assistant.ui import AssistantVisualState, AssistantWindow
from innov8_assistant.utils import setup_logger
from innov8_assistant.voice import TextToSpeechEngine, WhisperListener
from innov8_assistant.voice.listener import ListenerConfig


class AssistantController(QObject):
    command_finished = Signal(object)

    def __init__(self, app: QApplication) -> None:
        super().__init__()
        self.app = app
        self.config = load_config()
        self.logger = setup_logger(self.config.assistant.logs_dir)
        self.executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="innov8-worker")
        self._is_listening = False

        self.window = AssistantWindow(
            assistant_name=self.config.assistant.name,
            accent_primary=self.config.ui.accent_primary,
            accent_secondary=self.config.ui.accent_secondary,
            fade_ms=self.config.ui.startup_fade_ms,
        )
        self.window.resize(self.config.ui.width, self.config.ui.height)

        listener_config = ListenerConfig(
            model_size=self.config.voice.model_size,
            language=self.config.voice.language,
            device=self.config.voice.device,
            compute_type=self.config.voice.compute_type,
            sample_rate=self.config.voice.sample_rate,
            chunk_size=self.config.voice.chunk_size,
            input_device_index=self.config.voice.input_device_index,
            speech_threshold_multiplier=self.config.voice.speech_threshold_multiplier,
            silence_timeout_seconds=self.config.voice.silence_timeout_seconds,
            not_hearing_timeout_seconds=self.config.voice.not_hearing_timeout_seconds,
            partial_update_seconds=self.config.voice.partial_update_seconds,
            max_record_seconds=self.config.voice.max_record_seconds,
        )
        self.listener = WhisperListener(listener_config, logger=self.logger)
        self.tts = TextToSpeechEngine(
            rate=self.config.assistant.tts_rate,
            volume=self.config.assistant.tts_volume,
            logger=self.logger,
        )
        self.registry = CommandRegistry(
            app_launcher=AppLauncher(match_threshold=self.config.assistant.command_match_threshold),
            file_finder=FileFinder(self.config.assistant.search_roots),
            assistant_name=self.config.assistant.name,
        )

        self.command_finished.connect(self._on_command_result)
        self._connect_signals()
        self._tray = self._build_tray() if self.config.ui.enable_system_tray else None

        self.window.add_assistant_message(self.config.assistant.greeting, typing_animation=True)
        self.window.set_live_text("I am listening.", auto_fade_ms=self.config.ui.silence_text_fade_ms)
        self.window.show()

    def _connect_signals(self) -> None:
        self.window.listen_requested.connect(self.start_listening)
        self.window.stop_listening_requested.connect(self.stop_listening)
        self.window.shutdown_requested.connect(self.shutdown)

        self.listener.partial_text.connect(self._on_partial_text)
        self.listener.final_text.connect(self._on_final_text)
        self.listener.mic_level.connect(self.window.set_mic_level)
        self.listener.silence_timeout.connect(self._on_silence_timeout)
        self.listener.listening_changed.connect(self._on_listening_changed)
        self.listener.error.connect(self._on_voice_error)

        self.tts.started.connect(self._on_tts_started)
        self.tts.finished.connect(self._on_tts_finished)
        self.tts.error.connect(self._on_tts_error)

    def _build_tray(self) -> QSystemTrayIcon:
        icon = self.window.style().standardIcon(QStyle.SP_ComputerIcon)
        tray = QSystemTrayIcon(icon, self.window)
        tray.setToolTip(f"{self.config.assistant.name} Assistant")

        menu = QMenu()
        show_action = menu.addAction("Show Assistant")
        hide_action = menu.addAction("Hide Assistant")
        quit_action = menu.addAction("Exit")

        show_action.triggered.connect(self.window.showNormal)
        show_action.triggered.connect(self.window.activateWindow)
        hide_action.triggered.connect(self.window.hide)
        quit_action.triggered.connect(self._quit_from_tray)

        tray.setContextMenu(menu)
        tray.show()
        return tray

    def start_listening(self) -> None:
        if self._is_listening:
            return
        self._is_listening = True
        self.window.set_visual_state(AssistantVisualState.LISTENING)
        self.window.set_button_mode("Listening...", listening=True)
        self.window.set_live_text("Listening for your command...")
        self.listener.start_session()

    def stop_listening(self) -> None:
        if not self._is_listening:
            return
        self.listener.stop_session()
        self._is_listening = False
        self.window.set_visual_state(AssistantVisualState.IDLE)
        self.window.set_button_mode("Tap to Listen", listening=False)
        self.window.set_live_text("Listening stopped.", auto_fade_ms=self.config.ui.silence_text_fade_ms)

    def _on_listening_changed(self, listening: bool) -> None:
        self._is_listening = listening
        if not listening and self.window.control_button.text().startswith("Listening"):
            self.window.set_button_mode("Tap to Listen", listening=False)
            if self.window.header_label.text():
                self.window.set_visual_state(AssistantVisualState.IDLE)

    def _on_partial_text(self, text: str, confidence: float) -> None:
        if not text:
            return
        self.window.set_live_text(text)

    def _on_final_text(self, text: str, confidence: float) -> None:
        normalized = text.strip()
        if not normalized:
            self._on_silence_timeout()
            return

        self.window.add_user_message(normalized)
        self.window.set_live_text(normalized, auto_fade_ms=self.config.ui.silence_text_fade_ms)
        self.window.set_button_mode("Tap to Listen", listening=False)
        self.window.set_visual_state(AssistantVisualState.IDLE)

        future = self.executor.submit(self.registry.handle, normalized)
        future.add_done_callback(self._emit_command_result)

    def _emit_command_result(self, future) -> None:
        try:
            result = future.result()
        except Exception as exc:
            self.logger.exception("Command execution crashed")
            result = CommandResponse(
                success=False,
                spoken_text="I hit an internal command error.",
                assistant_text=f"Command pipeline failed: {exc}",
            )
        self.command_finished.emit(result)

    def _on_command_result(self, response: CommandResponse) -> None:
        self.window.add_assistant_message(response.assistant_text, typing_animation=True)
        self.window.set_live_text(response.spoken_text, auto_fade_ms=self.config.ui.silence_text_fade_ms)
        self.tts.speak_async(response.spoken_text)

    def _on_silence_timeout(self) -> None:
        self.window.set_visual_state(AssistantVisualState.IDLE)
        self.window.set_button_mode("Not hearing you", listening=False)
        message = "I did not hear speech clearly. Tap and try again."
        self.window.set_live_text(message, auto_fade_ms=self.config.ui.silence_text_fade_ms)
        self.tts.speak_async("Not hearing you clearly. Please try again.")
        QTimer.singleShot(1900, lambda: self.window.set_button_mode("Tap to Listen", listening=False))

    def _on_voice_error(self, message: str) -> None:
        self.window.set_visual_state(AssistantVisualState.ERROR)
        self.window.set_button_mode("Tap to Listen", listening=False)
        self.window.add_assistant_message(message, typing_animation=False)
        self.tts.speak_async("Voice engine encountered an error.")

    def _on_tts_started(self) -> None:
        if not self._is_listening:
            self.window.set_visual_state(AssistantVisualState.SPEAKING)

    def _on_tts_finished(self) -> None:
        if not self._is_listening:
            self.window.set_visual_state(AssistantVisualState.IDLE)

    def _on_tts_error(self, message: str) -> None:
        self.window.add_assistant_message(f"Voice output issue: {message}", typing_animation=False)
        self.window.set_visual_state(AssistantVisualState.ERROR)
        QTimer.singleShot(1400, lambda: self.window.set_visual_state(AssistantVisualState.IDLE))

    def _quit_from_tray(self) -> None:
        self.shutdown()
        self.app.quit()

    def shutdown(self) -> None:
        self.listener.shutdown()
        self.tts.shutdown()
        self.executor.shutdown(wait=False, cancel_futures=True)
        if self._tray:
            self._tray.hide()


def run() -> int:
    app = QApplication(sys.argv)
    app.setApplicationDisplayName("IN.N.O.V8 Assistant")

    controller = AssistantController(app)

    def _signal_handler(*_) -> None:
        controller.shutdown()
        app.quit()

    signal.signal(signal.SIGINT, _signal_handler)
    signal.signal(signal.SIGTERM, _signal_handler)
    return app.exec()


if __name__ == "__main__":
    raise SystemExit(run())
