from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path


@dataclass(slots=True)
class UIConfig:
    width: int = 1040
    height: int = 760
    accent_primary: str = "#26D7FF"
    accent_secondary: str = "#9E6BFF"
    startup_fade_ms: int = 420
    silence_text_fade_ms: int = 2800
    enable_system_tray: bool = True


@dataclass(slots=True)
class VoiceConfig:
    model_size: str = "small"
    language: str = "en"
    device: str = "cpu"
    compute_type: str = "int8"
    sample_rate: int = 16_000
    chunk_size: int = 1_024
    input_device_index: int | None = None
    speech_threshold_multiplier: float = 1.35
    silence_timeout_seconds: float = 1.7
    not_hearing_timeout_seconds: float = 6.0
    partial_update_seconds: float = 0.8
    max_record_seconds: float = 14.0


@dataclass(slots=True)
class AssistantConfig:
    name: str = "IN.N.O.V8"
    greeting: str = "System online. I am listening when you are ready."
    tts_rate: int = 178
    tts_volume: float = 0.95
    command_match_threshold: int = 76
    logs_dir: Path = field(default_factory=lambda: Path("innov8_assistant/logs"))
    search_roots: list[Path] = field(default_factory=list)


@dataclass(slots=True)
class AppConfig:
    ui: UIConfig
    voice: VoiceConfig
    assistant: AssistantConfig


def _default_search_roots() -> list[Path]:
    home = Path.home()
    candidates = [
        home / "Desktop",
        home / "Documents",
        home / "Downloads",
        Path("C:/Program Files"),
        Path("C:/Program Files (x86)"),
    ]
    return [path for path in candidates if path.exists()]


def _env(name: str, default: str) -> str:
    return os.getenv(f"INNOV8_{name}", default)


def load_config() -> AppConfig:
    ui = UIConfig(
        width=int(_env("WIDTH", "1040")),
        height=int(_env("HEIGHT", "760")),
        accent_primary=_env("ACCENT_PRIMARY", "#26D7FF"),
        accent_secondary=_env("ACCENT_SECONDARY", "#9E6BFF"),
        startup_fade_ms=int(_env("FADE_MS", "420")),
        silence_text_fade_ms=int(_env("SILENCE_TEXT_FADE_MS", "2800")),
        enable_system_tray=_env("SYSTEM_TRAY", "1") not in {"0", "false", "False"},
    )
    voice = VoiceConfig(
        model_size=_env("WHISPER_MODEL", "small"),
        language=_env("LANGUAGE", "en"),
        device=_env("WHISPER_DEVICE", "cpu"),
        compute_type=_env("WHISPER_COMPUTE_TYPE", "int8"),
        input_device_index=(
            int(_env("INPUT_DEVICE_INDEX", ""))
            if _env("INPUT_DEVICE_INDEX", "").strip()
            else None
        ),
    )
    assistant = AssistantConfig(
        name=_env("NAME", "IN.N.O.V8"),
        greeting=_env(
            "GREETING",
            "System online. I am listening when you are ready.",
        ),
        tts_rate=int(_env("TTS_RATE", "178")),
        tts_volume=float(_env("TTS_VOLUME", "0.95")),
        command_match_threshold=int(_env("MATCH_THRESHOLD", "76")),
        logs_dir=Path(_env("LOG_DIR", "innov8_assistant/logs")),
        search_roots=_default_search_roots(),
    )
    return AppConfig(ui=ui, voice=voice, assistant=assistant)
