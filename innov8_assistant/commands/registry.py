from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

from innov8_assistant.commands.parser import ParsedCommand, parse_command
from innov8_assistant.system_control import AppLauncher, FileFinder


@dataclass(slots=True)
class CommandResponse:
    success: bool
    spoken_text: str
    assistant_text: str
    suggestions: list[str] = field(default_factory=list)


class CommandRegistry:
    def __init__(
        self,
        app_launcher: AppLauncher,
        file_finder: FileFinder,
        assistant_name: str = "IN.N.O.V8",
    ) -> None:
        self.app_launcher = app_launcher
        self.file_finder = file_finder
        self.assistant_name = assistant_name
        self._web_aliases = {
            "youtube": "https://www.youtube.com",
            "google": "https://www.google.com",
            "wikipedia": "https://www.wikipedia.org",
            "spotify": "https://open.spotify.com",
            "gmail": "https://mail.google.com",
            "linkedin": "https://www.linkedin.com",
        }

    def handle(self, raw_text: str) -> CommandResponse:
        parsed = parse_command(raw_text)

        if parsed.intent == "empty":
            return CommandResponse(
                success=False,
                spoken_text="I did not catch anything. Please try again.",
                assistant_text="I did not catch anything. Please try again.",
            )

        if parsed.intent == "greeting":
            return CommandResponse(
                success=True,
                spoken_text="I am listening.",
                assistant_text="I am listening.",
            )

        if parsed.intent == "open_folder":
            folder = _canonical_folder_name(parsed.target)
            success, text = self.app_launcher.open_folder(folder)
            return CommandResponse(success=success, spoken_text=text, assistant_text=text)

        if parsed.intent == "open_url":
            success, text = self.app_launcher.open_url(parsed.target)
            return CommandResponse(success=success, spoken_text=text, assistant_text=text)

        if parsed.intent == "open_any":
            return self._open_any_target(parsed)

        if parsed.intent == "search_web":
            search_url = f"https://www.google.com/search?q={parsed.target.replace(' ', '+')}"
            success, text = self.app_launcher.open_url(search_url)
            spoken = f"Here is what I found for {parsed.target}." if success else text
            return CommandResponse(success=success, spoken_text=spoken, assistant_text=spoken)

        response = (
            "I can open apps, files, folders, or websites. Try saying open downloads folder."
        )
        return CommandResponse(success=False, spoken_text=response, assistant_text=response)

    def _open_any_target(self, parsed: ParsedCommand) -> CommandResponse:
        target = parsed.target.strip().lower()
        if target in self._web_aliases:
            success, text = self.app_launcher.open_url(self._web_aliases[target])
            if success:
                spoken = f"Opening {target} now."
                return CommandResponse(success=True, spoken_text=spoken, assistant_text=spoken)
            return CommandResponse(success=False, spoken_text=text, assistant_text=text)

        success, launch_text = self.app_launcher.open_application(parsed.target)
        if success:
            return CommandResponse(success=True, spoken_text=launch_text, assistant_text=launch_text)

        matches = self.file_finder.find_best_matches(parsed.target, limit=3)
        if matches:
            opened, text = self.file_finder.open_file(matches[0])
            if opened:
                return CommandResponse(success=True, spoken_text=text, assistant_text=text)

            suggestions = [str(match.path) for match in matches]
            spoken = "I could not open that file, but I found similar options."
            return CommandResponse(
                success=False,
                spoken_text=spoken,
                assistant_text=f"{spoken}\n" + "\n".join(suggestions),
                suggestions=suggestions,
            )

        return CommandResponse(
            success=False,
            spoken_text="That application is not installed yet.",
            assistant_text=(
                f"I could not find '{parsed.target}'. "
                "Try saying open chrome, start VS Code, or open downloads folder."
            ),
        )


def _canonical_folder_name(target: str) -> str:
    words = target.split()
    if not words:
        return "downloads"
    known = {"desktop", "documents", "downloads", "music", "videos", "pictures"}
    for word in words:
        if word in known:
            return word
    return target
