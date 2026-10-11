#!/usr/bin/env python3
"""Validate Ash chat JSONL files."""

from __future__ import annotations

import json
import sys
from collections import Counter
from pathlib import Path


ALLOWED_ROLES = {"system", "user", "assistant"}


def validate_file(path: Path) -> int:
    errors: list[str] = []
    role_counts: Counter[str] = Counter()
    example_count = 0

    with path.open("r", encoding="utf-8") as handle:
        for line_number, raw_line in enumerate(handle, start=1):
            line = raw_line.strip()
            if not line:
                continue

            example_count += 1
            try:
                record = json.loads(line)
            except json.JSONDecodeError as exc:
                errors.append(f"{path}:{line_number}: invalid JSON: {exc}")
                continue

            messages = record.get("messages")
            if not isinstance(messages, list) or not messages:
                errors.append(f"{path}:{line_number}: missing non-empty messages list")
                continue

            for index, message in enumerate(messages):
                if not isinstance(message, dict):
                    errors.append(f"{path}:{line_number}: message {index} is not an object")
                    continue

                role = message.get("role")
                content = message.get("content")

                if role not in ALLOWED_ROLES:
                    errors.append(
                        f"{path}:{line_number}: message {index} has invalid role {role!r}"
                    )
                else:
                    role_counts[role] += 1

                if not isinstance(content, str) or not content.strip():
                    errors.append(
                        f"{path}:{line_number}: message {index} has empty content"
                    )

            if messages[-1].get("role") != "assistant":
                errors.append(f"{path}:{line_number}: final message should be assistant")

    if errors:
        print("\n".join(errors), file=sys.stderr)
        return 1

    print(f"OK: {path}")
    print(f"examples: {example_count}")
    print("roles: " + ", ".join(f"{role}={count}" for role, count in sorted(role_counts.items())))
    return 0


def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: validate_jsonl.py <file.jsonl> [more.jsonl...]", file=sys.stderr)
        return 2

    status = 0
    for argument in sys.argv[1:]:
        path = Path(argument)
        if not path.exists():
            print(f"Missing file: {path}", file=sys.stderr)
            status = 1
            continue
        status |= validate_file(path)
    return status


if __name__ == "__main__":
    raise SystemExit(main())

