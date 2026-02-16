from __future__ import annotations

import os
import time
from dataclasses import dataclass
from pathlib import Path

from innov8_assistant.utils.fuzzy import top_matches


@dataclass(slots=True)
class FileMatch:
    path: Path
    score: int


class FileFinder:
    def __init__(self, roots: list[Path], index_refresh_seconds: int = 120) -> None:
        self.roots = roots
        self.index_refresh_seconds = index_refresh_seconds
        self._indexed_files: list[Path] = []
        self._last_indexed_at = 0.0

    def _refresh_index_if_needed(self) -> None:
        now = time.time()
        if self._indexed_files and (now - self._last_indexed_at) < self.index_refresh_seconds:
            return

        files: list[Path] = []
        for root in self.roots:
            if not root.exists():
                continue
            try:
                for dirpath, _, filenames in os.walk(root):
                    base = Path(dirpath)
                    for filename in filenames:
                        files.append(base / filename)
                        if len(files) >= 35_000:
                            break
                    if len(files) >= 35_000:
                        break
            except Exception:
                continue
        self._indexed_files = files
        self._last_indexed_at = now

    def find_best_matches(self, spoken_query: str, limit: int = 5) -> list[FileMatch]:
        query = spoken_query.strip().lower()
        if not query:
            return []
        self._refresh_index_if_needed()
        if not self._indexed_files:
            return []

        names = [path.name.lower() for path in self._indexed_files]
        ranked = top_matches(query, names, limit=limit * 2)
        if not ranked:
            return []

        resolved: list[FileMatch] = []
        used: set[Path] = set()
        for name, score in ranked:
            for path in self._indexed_files:
                if path in used:
                    continue
                if path.name.lower() == name:
                    resolved.append(FileMatch(path=path, score=score))
                    used.add(path)
                    break
            if len(resolved) >= limit:
                break
        return resolved

    def open_file(self, match: FileMatch) -> tuple[bool, str]:
        try:
            os.startfile(str(match.path))  # type: ignore[attr-defined]
            return True, f"Opening {match.path.name} now."
        except Exception:
            return False, f"I could not open {match.path.name}."
