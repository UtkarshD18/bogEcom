from __future__ import annotations

import os
import shutil
import subprocess
import winreg
from pathlib import Path

from innov8_assistant.utils.fuzzy import best_match


class AppLauncher:
    def __init__(self, match_threshold: int = 76) -> None:
        self.match_threshold = match_threshold
        self._app_aliases = {
            "chrome": ["chrome", "google chrome", "browser"],
            "firefox": ["firefox", "mozila", "mozilla firefox"],
            "edge": ["edge", "microsoft edge"],
            "vscode": ["vs code", "visual studio code", "code editor"],
            "notepad": ["notepad", "notes"],
            "calculator": ["calculator", "calc"],
            "cmd": ["command prompt", "terminal", "cmd"],
            "explorer": ["file explorer", "explorer", "files"],
            "taskmgr": ["task manager", "performance manager"],
            "powershell": ["powershell", "power shell"],
            "spotify": ["spotify", "music app"],
            "discord": ["discord"],
        }
        self._launch_commands = {
            "chrome": ["chrome.exe", "chrome"],
            "firefox": ["firefox.exe", "firefox"],
            "edge": ["msedge.exe", "msedge"],
            "vscode": ["code.exe", "code"],
            "notepad": ["notepad.exe", "notepad"],
            "calculator": ["calc.exe", "calc"],
            "cmd": ["cmd.exe", "cmd"],
            "explorer": ["explorer.exe", "explorer"],
            "taskmgr": ["taskmgr.exe", "taskmgr"],
            "powershell": ["powershell.exe", "powershell"],
            "spotify": ["spotify.exe", "spotify"],
            "discord": ["discord.exe", "discord"],
        }
        self._known_install_paths: dict[str, list[Path]] = {
            "chrome": [
                Path("C:/Program Files/Google/Chrome/Application/chrome.exe"),
                Path("C:/Program Files (x86)/Google/Chrome/Application/chrome.exe"),
            ],
            "edge": [Path("C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe")],
            "vscode": [
                Path("C:/Program Files/Microsoft VS Code/Code.exe"),
                Path.home() / "AppData/Local/Programs/Microsoft VS Code/Code.exe",
            ],
            "spotify": [Path.home() / "AppData/Roaming/Spotify/Spotify.exe"],
            "discord": [Path.home() / "AppData/Local/Discord/Update.exe"],
        }

    def open_folder(self, folder_name: str) -> tuple[bool, str]:
        normalized = folder_name.strip().lower()
        home = Path.home()
        folder_map = {
            "desktop": home / "Desktop",
            "documents": home / "Documents",
            "downloads": home / "Downloads",
            "music": home / "Music",
            "videos": home / "Videos",
            "pictures": home / "Pictures",
        }
        target = folder_map.get(normalized)
        if not target or not target.exists():
            return False, f"I could not find the {folder_name} folder."
        os.startfile(target)  # type: ignore[attr-defined]
        return True, f"Opening {folder_name} folder now."

    def open_url(self, url: str) -> tuple[bool, str]:
        cleaned = url.strip()
        if not cleaned:
            return False, "I need a valid website to open."
        if not cleaned.startswith(("http://", "https://")):
            cleaned = f"https://{cleaned}"
        os.startfile(cleaned)  # type: ignore[attr-defined]
        return True, f"Opening {cleaned}."

    def open_application(self, app_query: str) -> tuple[bool, str]:
        if not app_query.strip():
            return False, "I need an application name."

        canonical = self._resolve_app_name(app_query)
        if not canonical:
            return False, f"That application is not installed yet: {app_query}."

        if self._launch_canonical(canonical):
            spoken = canonical.upper() if canonical == "vscode" else canonical.title()
            return True, f"Opening {spoken} now."

        return False, f"I could not launch {app_query}."

    def _resolve_app_name(self, query: str) -> str | None:
        normalized = query.lower().strip()

        flat_aliases: dict[str, str] = {}
        for canonical, aliases in self._app_aliases.items():
            flat_aliases[canonical] = canonical
            for alias in aliases:
                flat_aliases[alias] = canonical

        matched = best_match(normalized, list(flat_aliases.keys()), self.match_threshold)
        if matched:
            return flat_aliases[matched[0]]

        for canonical, commands in self._launch_commands.items():
            if any(shutil.which(candidate) for candidate in commands):
                if canonical in normalized:
                    return canonical

        # Fallback: find executable in Program Files by name
        search_dirs = [Path("C:/Program Files"), Path("C:/Program Files (x86)")]
        query_token = normalized.replace(" ", "")
        for root in search_dirs:
            if not root.exists():
                continue
            for exe in root.rglob("*.exe"):
                stem = exe.stem.lower().replace(" ", "")
                if query_token in stem:
                    self._launch_commands[query_token] = [str(exe)]
                    return query_token
        return None

    def _launch_canonical(self, canonical: str) -> bool:
        for registered in self._registry_app_paths(canonical):
            if self._launch_path(registered):
                return True

        for known in self._known_install_paths.get(canonical, []):
            if self._launch_path(known):
                return True

        for candidate in self._launch_commands.get(canonical, [canonical]):
            if self._launch_candidate(candidate):
                return True

        return False

    def _launch_candidate(self, candidate: str) -> bool:
        if self._launch_path(Path(candidate)):
            return True

        resolved = shutil.which(candidate)
        if resolved:
            try:
                subprocess.Popen([resolved], shell=False)
                return True
            except Exception:
                return False
        return False

    def _launch_path(self, path: Path) -> bool:
        if not path:
            return False
        expanded = Path(os.path.expandvars(str(path))).expanduser()
        if not expanded.exists():
            return False
        try:
            os.startfile(str(expanded))  # type: ignore[attr-defined]
            return True
        except Exception:
            return False

    def _registry_app_paths(self, canonical: str) -> list[Path]:
        # Query Windows App Paths for robust executable discovery.
        map_exe = {
            "chrome": "chrome.exe",
            "edge": "msedge.exe",
            "firefox": "firefox.exe",
            "vscode": "Code.exe",
            "notepad": "notepad.exe",
            "calculator": "calc.exe",
            "taskmgr": "taskmgr.exe",
            "powershell": "powershell.exe",
        }
        exe_name = map_exe.get(canonical)
        if not exe_name:
            return []

        results: list[Path] = []
        locations = [
            winreg.HKEY_CURRENT_USER,
            winreg.HKEY_LOCAL_MACHINE,
        ]
        for hive in locations:
            try:
                key = winreg.OpenKey(
                    hive,
                    f"SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\{exe_name}",
                )
                value, _ = winreg.QueryValueEx(key, None)
                if value:
                    results.append(Path(value))
                winreg.CloseKey(key)
            except Exception:
                continue
        return results
