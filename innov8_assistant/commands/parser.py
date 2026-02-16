from __future__ import annotations

from dataclasses import dataclass


@dataclass(slots=True)
class ParsedCommand:
    intent: str
    target: str


OPEN_VERBS = ("open", "start", "launch", "run")
FOLDER_HINTS = ("folder", "downloads", "documents", "desktop", "music", "pictures", "videos")


def normalize_text(text: str) -> str:
    return " ".join(text.strip().lower().split())


def parse_command(text: str) -> ParsedCommand:
    normalized = normalize_text(text)
    if not normalized:
        return ParsedCommand(intent="empty", target="")

    if normalized in {
        "hey innov8",
        "innov8",
        "in.n.o.v8",
        "in n o v8",
        "in n o v 8",
        "hello innov8",
        "hello",
    }:
        return ParsedCommand(intent="greeting", target="")

    if normalized.startswith(("search ", "find ")):
        return ParsedCommand(intent="search_web", target=normalized.split(" ", 1)[1])

    for verb in OPEN_VERBS:
        if normalized.startswith(f"{verb} "):
            target = _clean_target(normalized[len(verb) :].strip())
            if any(keyword in target for keyword in FOLDER_HINTS):
                return ParsedCommand(intent="open_folder", target=target.replace("folder", "").strip())
            if "http" in target or "." in target:
                return ParsedCommand(intent="open_url", target=target)
            return ParsedCommand(intent="open_any", target=target)

    # Natural form: "innov8 open chrome", "can you start vscode", etc.
    tokens = normalized.split()
    for index, token in enumerate(tokens):
        if token in OPEN_VERBS and index + 1 < len(tokens):
            target = _clean_target(" ".join(tokens[index + 1 :]))
            if not target:
                continue
            if any(keyword in target for keyword in FOLDER_HINTS):
                return ParsedCommand(intent="open_folder", target=target.replace("folder", "").strip())
            if "http" in target or "." in target:
                return ParsedCommand(intent="open_url", target=target)
            return ParsedCommand(intent="open_any", target=target)

    return ParsedCommand(intent="chat", target=normalized)


def _clean_target(target: str) -> str:
    removable = [
        "please",
        "for me",
        "application",
        "app",
        "the",
    ]
    cleaned = target
    for token in removable:
        cleaned = cleaned.replace(token, " ")
    return normalize_text(cleaned)
