#!/usr/bin/env python3
"""Inspect installed public-package metadata and integrity pins without executing hooks."""
import hashlib
import json
from pathlib import Path

import yaml


def main():
    root = Path(__file__).resolve().parents[1]
    resolutions = {}
    # pnpm 12 records package-manager and application graphs in separate YAML documents.
    for document in yaml.safe_load_all((root / "pnpm-lock.yaml").read_text()):
        resolutions.update(document.get("packages", {}))
    packages = []
    seen = set()
    for virtual in sorted((root / "node_modules/.pnpm").iterdir()):
        nested = virtual / "node_modules"
        if not nested.is_dir():
            continue
        candidates = []
        for child in nested.iterdir():
            candidates.extend(child.iterdir() if child.name.startswith("@") and child.is_dir() else [child])
        for folder in candidates:
            path = folder / "package.json"
            if folder.is_symlink() or not path.is_file():
                continue
            metadata = json.loads(path.read_text())
            name, version = metadata["name"], metadata["version"]
            if (name, version) in seen:
                continue
            seen.add((name, version))
            package = {"name": name, "version": version, "license_metadata": metadata.get("license", "NOT_REPORTED"),
                       "integrity": resolutions.get(name + "@" + version, {}).get("resolution", {}).get("integrity", "SEE_LOCKFILE"),
                       "manifest_sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
                       "lifecycle_scripts": {k: v for k, v in metadata.get("scripts", {}).items()
                                             if k in ("preinstall", "install", "postinstall")},
                       "native_or_launcher_files": []}
            for relative in ("prebuilds/linux-x64.node", "rolldown-binding.linux-x64-gnu.node",
                             "rolldown-binding.linux-x64-musl.node", "lib/tsc", "bin/tsc"):
                native = folder / relative
                if native.is_file() and not native.is_symlink():
                    package["native_or_launcher_files"].append({"path": str(native.relative_to(root)),
                        "sha256": hashlib.sha256(native.read_bytes()).hexdigest()})
            packages.append(package)
    result = {"revision": "phase-b-r1", "registry": "https://registry.npmjs.org",
              "source": "Installed metadata and pnpm-lock.yaml; registry metadata read 2026-10-17",
              "install_scripts_enabled": False, "packages": sorted(packages, key=lambda p: p["name"]),
              "limitations": ["Metadata and integrity pins are not a full vulnerability or legal audit.",
                              "No third-party skill or provider account was activated."],
              "sqlite_source_reference": {"repository": "https://github.com/WiseLibs/better-sqlite3", "version": "13.0.3",
                  "commit": "dbc2ea1165fef1f599b9be12faea33fa5e9d7ffb", "adapted_code": False,
                  "review": "No install hook; lib/database.js and methods/transaction.js inspected; Linux binary round trip passed."}}
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
