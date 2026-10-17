"""Explicit source allowlist shared by audit, inventory and reproducibility receipts."""
import os
from pathlib import Path

DIRECTORIES = (".agents", "agents", "brands", "campaigns", "config", "content", "creative",
               "distribution", "docs", "growth", "plugins", "relationships", "research", "scripts",
               "strategy", "tests", "workflows", "packages", "adapters", "data",
               "output/sample-plans", "output/sample-calendars")
SUFFIXES = {".md", ".json", ".yaml", ".yml", ".py", ".txt", ".ts", ".js", ".mjs", ".sql"}


def sensitive_name(name):
    lowered = name.lower()
    return lowered.startswith((".env", "credentials", "secrets", "session", "cookies", "auth."))


def project_inputs(root):
    """Never follow links or traverse .git, .beads, runtime, caches or secret dirs."""
    root = Path(root).resolve()
    files = {p for p in root.glob("*.md") if p.is_file() and not p.is_symlink()}
    for name in (".gitignore", ".env.example", "package.json", "pnpm-lock.yaml", "tsconfig.json",
                 "tsconfig.build.json", "vitest.config.ts", "gtm"):
        p = root / name
        if p.is_file() and not p.is_symlink():
            files.add(p)
    for name in DIRECTORIES:
        base = root / name
        if not base.is_dir() or base.is_symlink():
            continue
        for directory, dirs, names in os.walk(base, followlinks=False):
            dirs[:] = sorted(d for d in dirs if not d.startswith(".") and not sensitive_name(d) and
                             d not in {"__pycache__", "node_modules", "secrets", "runtime"} and
                             not (Path(directory) / d).is_symlink())
            for filename in names:
                p = Path(directory) / filename
                if (not filename.startswith(".") and not sensitive_name(filename) and
                        p.suffix in SUFFIXES and not p.is_symlink()):
                    files.add(p)
    return sorted(files)
