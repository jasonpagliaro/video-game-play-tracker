#!/usr/bin/env python3
"""Validate the video-game-play-tracker project-continuity pack."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]

REQUIRED_FILES = [
    "AGENTS.md",
    "docs/project-continuity/project/project-continuity.yaml",
    "docs/project-continuity/project/PURPOSE.md",
    "docs/project-continuity/project/STATUS.md",
    "docs/project-continuity/project/NEXT.md",
    "docs/project-continuity/project/HANDOFF.md",
    "docs/project-continuity/project/USER_INPUT.md",
    "docs/project-continuity/project/DECISIONS/README.md",
    "docs/project-continuity/project/DECISIONS/0001-adopt-project-continuity-system.md",
    "docs/project-continuity/spec/SELF_IMPROVEMENT.md",
    "docs/project-continuity/project/PROPOSED_CHANGES.md",
    "docs/project-continuity/project/archive/README.md",
    "scripts/validate_continuity_pack.py",
]

ALLOWED_RANKS = {"P1", "P2", "P3"}
ALLOWED_INPUT_LEVELS = {"auto", "review recommended", "user required"}


def read_text(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def fail(message: str) -> None:
    print(f"FAIL: {message}")
    sys.exit(1)


def require_contains(path: str, required_text: list[str]) -> None:
    text = read_text(path)
    missing = [item for item in required_text if item not in text]
    if missing:
        fail(f"{path} missing required text: " + ", ".join(missing))


def markdown_section(path: str, heading: str) -> str:
    text = read_text(path)
    pattern = re.compile(
        rf"^{re.escape(heading)}\s*$\n(?P<body>.*?)(?=^## |\Z)",
        re.M | re.S,
    )
    match = pattern.search(text)
    return match.group("body").strip() if match else ""


def check_required_files_exist() -> None:
    missing = [path for path in REQUIRED_FILES if not (ROOT / path).exists()]
    if missing:
        fail("missing required files: " + ", ".join(missing))


def extract_yaml_path_refs(yaml_text: str) -> list[str]:
    refs: list[str] = []
    path_pattern = re.compile(
        r"\s*(?:-\s*)?(?:[a-z_]+:\s*)?"
        r"((?:AGENTS|docs|scripts)/[A-Za-z0-9_./-]+|AGENTS\.md)\s*$"
    )
    for line in yaml_text.splitlines():
        match = path_pattern.match(line)
        if match:
            refs.append(match.group(1).rstrip("/"))
    return refs


def check_yaml_references() -> None:
    yaml_path = "docs/project-continuity/project/project-continuity.yaml"
    yaml_text = read_text(yaml_path)
    required_text = [
        "schema: project-continuity.v1",
        "system_name: Project Continuity System",
        "system_version: 0.1.0",
        "install_depth: mvp_plus_self_improvement",
        "full_spec_copied: false",
        "ci_enforcement_enabled: false",
        "package_script: continuity:check",
        "self_improvement: docs/project-continuity/spec/SELF_IMPROVEMENT.md",
        "proposed_changes: docs/project-continuity/project/PROPOSED_CHANGES.md",
    ]
    missing_text = [text for text in required_text if text not in yaml_text]
    if missing_text:
        fail(f"{yaml_path} missing required text: " + ", ".join(missing_text))

    for required in REQUIRED_FILES:
        if required not in yaml_text and required != "scripts/validate_continuity_pack.py":
            fail(f"{yaml_path} does not reference required file {required}")

    missing_refs = []
    for ref in extract_yaml_path_refs(yaml_text):
        if not (ROOT / ref).exists():
            missing_refs.append(ref)
    if missing_refs:
        fail(f"{yaml_path} references missing paths: " + ", ".join(missing_refs))


def check_agents_entry() -> None:
    require_contains(
        "AGENTS.md",
        [
            "<!-- project-continuity:begin -->",
            "<!-- project-continuity:end -->",
            "SELF_IMPROVEMENT.md",
            "PROPOSED_CHANGES.md",
            "npm run continuity:check",
            "Keep existing project-specific instructions authoritative.",
        ],
    )


def check_project_docs() -> None:
    required_headings = {
        "docs/project-continuity/project/PURPOSE.md": ["# Purpose", "## Product Purpose"],
        "docs/project-continuity/project/STATUS.md": ["# Status", "## Current State"],
        "docs/project-continuity/project/NEXT.md": ["# Next", "## Recommended Next Action"],
        "docs/project-continuity/project/HANDOFF.md": ["# Handoff", "## Current Handoff"],
        "docs/project-continuity/project/USER_INPUT.md": ["# User Input", "## Open Questions"],
        "docs/project-continuity/spec/SELF_IMPROVEMENT.md": [
            "# Self-Improvement",
            "## Required Fields",
            "## Session Review Triage",
        ],
        "docs/project-continuity/project/PROPOSED_CHANGES.md": [
            "# Proposed Changes",
            "## Proposed",
        ],
    }
    for path, headings in required_headings.items():
        require_contains(path, headings)

    if not markdown_section(
        "docs/project-continuity/project/NEXT.md",
        "## Recommended Next Action",
    ):
        fail("NEXT.md Recommended Next Action must contain a concrete action")

    require_contains(
        "docs/project-continuity/project/USER_INPUT.md",
        [
            "## Resolved Choices",
            "Open Questions",
            "None.",
            "Production follow-through remains automatic",
        ],
    )


def check_decisions() -> None:
    decisions_index = read_text("docs/project-continuity/project/DECISIONS/README.md")
    decision_file = "0001-adopt-project-continuity-system.md"
    if decision_file not in decisions_index:
        fail(f"DECISIONS/README.md must index {decision_file}")

    decision_text = read_text(f"docs/project-continuity/project/DECISIONS/{decision_file}")
    required_text = [
        "Date: 2026-07-07",
        "Status: Accepted",
        "mvp_plus_self_improvement",
    ]
    missing = [text for text in required_text if text not in decision_text]
    if missing:
        fail(f"{decision_file} missing required text: " + ", ".join(missing))


def required_proposal_fields() -> list[str]:
    body = markdown_section("docs/project-continuity/spec/SELF_IMPROVEMENT.md", "## Required Fields")
    fields = []
    for line in body.splitlines():
        match = re.match(r"-\s+([^:]+)(?::.*)?$", line.strip())
        if match:
            fields.append(match.group(1).strip())
    if not fields:
        fail("SELF_IMPROVEMENT.md Required Fields section is empty")
    return fields


def check_proposed_changes() -> None:
    text = read_text("docs/project-continuity/project/PROPOSED_CHANGES.md")
    fields = required_proposal_fields()
    entries = re.split(r"^###\s+", text, flags=re.M)[1:]
    entries = [entry for entry in entries if re.search(r"^-\s+title:", entry, re.M)]
    for entry in entries:
        title = entry.splitlines()[0].strip()
        for field in fields:
            if not re.search(rf"^-\s+{re.escape(field)}:", entry, re.M):
                fail(f"PROPOSED_CHANGES.md entry missing {field}: {title}")

        rank_match = re.search(r"^-\s+rank:\s*(\S+)\s*$", entry, re.M)
        if not rank_match or rank_match.group(1) not in ALLOWED_RANKS:
            fail(f"PROPOSED_CHANGES.md entry has invalid rank: {title}")

        input_match = re.search(r"^-\s+input level:\s*(.+?)\s*$", entry, re.M)
        if not input_match or input_match.group(1) not in ALLOWED_INPUT_LEVELS:
            fail(f"PROPOSED_CHANGES.md entry has invalid input level: {title}")


def check_package_script() -> None:
    package = json.loads(read_text("package.json"))
    script = package.get("scripts", {}).get("continuity:check")
    if script != "python3 scripts/validate_continuity_pack.py":
        fail("package.json must define continuity:check")


def main() -> None:
    check_required_files_exist()
    check_yaml_references()
    check_agents_entry()
    check_project_docs()
    check_decisions()
    check_proposed_changes()
    check_package_script()
    print("Continuity pack validation passed.")


if __name__ == "__main__":
    main()
