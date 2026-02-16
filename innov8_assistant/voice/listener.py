from __future__ import annotations

import math
import queue
import threading
import time
from collections import deque
from dataclasses import dataclass
from typing import Any

import numpy as np
from PySide6.QtCore import QObject, Signal


@dataclass(slots=True)
class ListenerConfig:
    model_size: str
    language: str
    device: str
    compute_type: str
    sample_rate: int
    chunk_size: int
    input_device_index: int | None
    speech_threshold_multiplier: float
    silence_timeout_seconds: float
    not_hearing_timeout_seconds: float
    partial_update_seconds: float
    max_record_seconds: float


class WhisperListener(QObject):
    partial_text = Signal(str, float)
    final_text = Signal(str, float)
    mic_level = Signal(float)
    listening_changed = Signal(bool)
    silence_timeout = Signal()
    error = Signal(str)

    def __init__(self, config: ListenerConfig, logger: Any) -> None:
        super().__init__()
        self.config = config
        self.logger = logger
        self._audio_queue: queue.Queue[np.ndarray] = queue.Queue(maxsize=256)
        self._stop_event = threading.Event()
        self._worker_thread: threading.Thread | None = None
        self._model = None
        self._sounddevice = None
        self._device_fallback_applied = False
        self._stream_sample_rate = config.sample_rate

    def start_session(self) -> None:
        if self._worker_thread and self._worker_thread.is_alive():
            return
        self._stop_event.clear()
        self._worker_thread = threading.Thread(target=self._capture_loop, daemon=True)
        self._worker_thread.start()
        self.listening_changed.emit(True)

    def stop_session(self) -> None:
        self._stop_event.set()
        self.listening_changed.emit(False)

    def shutdown(self) -> None:
        self.stop_session()
        if self._worker_thread and self._worker_thread.is_alive():
            self._worker_thread.join(timeout=1.2)

    def _load_dependencies(self) -> bool:
        try:
            if self._sounddevice is None:
                import sounddevice as sd

                self._sounddevice = sd
            if self._model is None:
                from faster_whisper import WhisperModel

                self._model = WhisperModel(
                    self.config.model_size,
                    device=self.config.device,
                    compute_type=self.config.compute_type,
                )
            return True
        except Exception as exc:
            self.logger.exception("Failed to load voice dependencies")
            self.error.emit(f"Voice engine failed: {exc}")
            return False

    def _audio_callback(self, indata, frames, stream_time, status) -> None:
        if status:
            self.logger.warning("Microphone callback status: %s", status)
        try:
            self._audio_queue.put_nowait(np.copy(indata).reshape(-1))
        except queue.Full:
            # Drop oldest chunk to keep latency stable.
            try:
                _ = self._audio_queue.get_nowait()
                self._audio_queue.put_nowait(np.copy(indata).reshape(-1))
            except Exception:
                pass

    def _capture_loop(self) -> None:
        if not self._load_dependencies():
            self.listening_changed.emit(False)
            return
        sd = self._sounddevice
        stream_device, stream_rate = self._resolve_stream_config(sd)
        self._stream_sample_rate = stream_rate

        self._clear_audio_queue()
        calibrate_samples: list[np.ndarray] = []
        speech_chunks: list[np.ndarray] = []
        lead_in_chunks: deque[np.ndarray] = deque(maxlen=10)
        speech_started_at: float | None = None
        last_voice_time = time.time()
        last_partial_time = 0.0
        idle_started_at = time.time()
        noise_floor = 0.008
        latest_partial = ""

        try:
            with sd.InputStream(
                samplerate=stream_rate,
                channels=1,
                dtype="float32",
                blocksize=self.config.chunk_size,
                device=stream_device,
                callback=self._audio_callback,
            ):
                while not self._stop_event.is_set():
                    try:
                        chunk = self._audio_queue.get(timeout=0.12)
                    except queue.Empty:
                        if speech_chunks and (time.time() - last_voice_time) > self.config.silence_timeout_seconds:
                            self._emit_final_transcript(speech_chunks, latest_partial)
                            break
                        if not speech_chunks and (time.time() - idle_started_at) > self.config.not_hearing_timeout_seconds:
                            self.silence_timeout.emit()
                            break
                        continue

                    rms = float(np.sqrt(np.mean(np.square(chunk)))) if chunk.size else 0.0
                    self.mic_level.emit(min(1.0, rms * 12))

                    if len(calibrate_samples) < 10:
                        calibrate_samples.append(chunk)
                        merged = np.concatenate(calibrate_samples)
                        noise_floor = max(0.004, float(np.sqrt(np.mean(np.square(merged)))))
                        continue

                    threshold = noise_floor * self.config.speech_threshold_multiplier
                    is_voice = rms > threshold
                    lead_in_chunks.append(chunk)

                    if is_voice:
                        last_voice_time = time.time()
                        if speech_started_at is None:
                            speech_started_at = time.time()
                            speech_chunks = list(lead_in_chunks)
                        speech_chunks.append(chunk)
                        idle_started_at = time.time()
                    elif speech_started_at is not None:
                        speech_chunks.append(chunk)

                    if speech_chunks and (time.time() - last_partial_time) >= self.config.partial_update_seconds:
                        preview = np.concatenate(speech_chunks[-24:])
                        preview_text, confidence = self._transcribe(preview)
                        if preview_text:
                            latest_partial = preview_text
                            self.partial_text.emit(preview_text, confidence)
                        last_partial_time = time.time()

                    if speech_started_at and (time.time() - speech_started_at) > self.config.max_record_seconds:
                        self._emit_final_transcript(speech_chunks, latest_partial)
                        break

                    if speech_chunks and (time.time() - last_voice_time) > self.config.silence_timeout_seconds:
                        self._emit_final_transcript(speech_chunks, latest_partial)
                        break

                    # If no voice was detected for too long, stop listening gracefully.
                    if (
                        speech_started_at is None
                        and (time.time() - idle_started_at) > self.config.not_hearing_timeout_seconds
                    ):
                        self.silence_timeout.emit()
                        break
        except Exception as exc:
            self.logger.exception("Microphone capture loop failed")
            self.error.emit(f"Microphone error: {exc}")
        finally:
            self.listening_changed.emit(False)

    def _emit_final_transcript(self, chunks: list[np.ndarray], latest_partial: str) -> None:
        merged = np.concatenate(chunks) if chunks else np.array([], dtype=np.float32)
        text, confidence = self._transcribe(merged)
        if not text:
            text = latest_partial.strip()
        if text:
            self.final_text.emit(text, confidence)
        else:
            self.silence_timeout.emit()

    def _transcribe(self, audio: np.ndarray) -> tuple[str, float]:
        if audio.size == 0 or self._model is None:
            return "", 0.0
        try:
            segments, _ = self._model.transcribe(
                audio=self._prepare_audio_for_whisper(audio),
                language=self.config.language,
                beam_size=1,
                best_of=1,
                temperature=0.0,
                vad_filter=True,
            )
            pieces = []
            log_probs = []
            for segment in segments:
                value = segment.text.strip()
                if value:
                    pieces.append(value)
                if hasattr(segment, "avg_logprob"):
                    log_probs.append(float(segment.avg_logprob))

            text = " ".join(pieces).strip()
            if not log_probs:
                return text, 0.65 if text else 0.0

            avg_log = sum(log_probs) / len(log_probs)
            confidence = max(0.0, min(1.0, math.exp(avg_log)))
            return text, confidence
        except Exception as exc:
            self.logger.warning("Transcription failed: %s", exc)
            message = str(exc).lower()
            if (
                not self._device_fallback_applied
                and any(token in message for token in ("cublas", "cuda", "cudnn"))
            ):
                if self._switch_to_cpu_fallback():
                    return self._transcribe(audio)
            return "", 0.0

    def _switch_to_cpu_fallback(self) -> bool:
        try:
            from faster_whisper import WhisperModel

            self.logger.warning("Switching Whisper to CPU fallback mode.")
            self._model = WhisperModel(self.config.model_size, device="cpu", compute_type="int8")
            self._device_fallback_applied = True
            self.error.emit(
                "GPU transcription backend unavailable. Switched to CPU mode for stable listening.",
            )
            return True
        except Exception as exc:
            self.logger.exception("Failed to switch Whisper to CPU fallback")
            self.error.emit(f"CPU fallback failed: {exc}")
            return False

    def _clear_audio_queue(self) -> None:
        while True:
            try:
                self._audio_queue.get_nowait()
            except queue.Empty:
                break

    def _resolve_stream_config(self, sd) -> tuple[int | None, int]:
        device_index = self.config.input_device_index
        sample_rate = self.config.sample_rate

        try:
            devices = sd.query_devices()
            default_input_index = sd.default.device[0] if sd.default.device else None
        except Exception:
            self.logger.warning("Could not read sound devices; using defaults.")
            return device_index, sample_rate

        # Resolve microphone device.
        if device_index is None:
            if isinstance(default_input_index, int) and default_input_index >= 0:
                device_index = default_input_index
            else:
                for index, device in enumerate(devices):
                    if int(device.get("max_input_channels", 0)) > 0:
                        device_index = index
                        break

        if device_index is not None and 0 <= device_index < len(devices):
            device_info = devices[device_index]
            default_sr = int(float(device_info.get("default_samplerate") or sample_rate))
            # Many Windows mics fail fixed 16k on MME/DirectSound. Use device native rate.
            if default_sr > 0:
                sample_rate = default_sr
            self.logger.info(
                "Using microphone index=%s name=%s sample_rate=%s",
                device_index,
                device_info.get("name", "unknown"),
                sample_rate,
            )
        else:
            self.logger.warning("No input device resolved; falling back to default stream settings.")
            device_index = None

        return device_index, sample_rate

    def _prepare_audio_for_whisper(self, audio: np.ndarray) -> np.ndarray:
        clipped = np.clip(audio, -1.0, 1.0).astype(np.float32)
        if self._stream_sample_rate == 16_000:
            return clipped

        source_rate = float(self._stream_sample_rate)
        target_rate = 16_000.0
        if source_rate <= 0:
            return clipped

        duration = len(clipped) / source_rate
        if duration <= 0:
            return clipped

        source_positions = np.linspace(0.0, duration, num=len(clipped), endpoint=False)
        target_length = max(1, int(duration * target_rate))
        target_positions = np.linspace(0.0, duration, num=target_length, endpoint=False)
        resampled = np.interp(target_positions, source_positions, clipped).astype(np.float32)
        return np.clip(resampled, -1.0, 1.0)
