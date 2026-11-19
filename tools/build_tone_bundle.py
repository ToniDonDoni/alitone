#!/usr/bin/env python3
"""Build the vendored Tone.js browser bundle directly from the pinned Git sources."""
import argparse
import shutil
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
UPSTREAM = ROOT / "thirdparty" / "tone_15_1_22"
OUTPUT = ROOT / "src" / "vendor" / "Tone-15.1.22.js"
PINNED_COMMIT = "d2d52ffa8803b35debd9f19f2da08ad1c3540de0"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--verify-only", action="store_true",
                        help="Verify that the submodule is at the pinned source commit")
    parser.add_argument("--skip-install", action="store_true",
                        help="Reuse node_modules already installed in the submodule")
    args = parser.parse_args()
    if not (UPSTREAM / "Tone" / "version.ts").is_file():
        parser.error("Initialize sources first: git submodule update --init --recursive")
    sha = subprocess.check_output(
        ["git", "-C", str(UPSTREAM), "rev-parse", "HEAD"], text=True
    ).strip()
    if sha != PINNED_COMMIT:
        parser.error(f"Unexpected upstream commit: {sha} (expected {PINNED_COMMIT})")
    print(f"Using Tone.js TypeScript source commit {sha}")
    if args.verify_only:
        return

    with tempfile.TemporaryDirectory(prefix="march-tone-source-") as temp:
        workspace = Path(temp) / "tone"
        shutil.copytree(
            UPSTREAM, workspace,
            ignore=shutil.ignore_patterns(".git", "node_modules", "build")
        )
        # The Git tag contains 'dev' metadata; do not modify the submodule.
        version_file = workspace / "Tone" / "version.ts"
        version = version_file.read_text()
        if '"dev"' not in version:
            parser.error("Unexpected upstream Tone/version.ts contents")
        version_file.write_text(version.replace('"dev"', '"15.1.22"'))

        if args.skip_install:
            dependencies = UPSTREAM / "node_modules"
            if not dependencies.is_dir():
                parser.error("Missing submodule node_modules; rerun without --skip-install")
            (workspace / "node_modules").symlink_to(dependencies, target_is_directory=True)
        else:
            # Install build tooling, never the published 'tone' npm package.
            subprocess.run(
                ["npm", "ci", "--no-audit", "--no-fund"],
                cwd=workspace, check=True
            )
        subprocess.run(["npm", "run", "ts:build"], cwd=workspace, check=True)
        subprocess.run(["npm", "run", "webpack:build"], cwd=workspace, check=True)
        bundle = workspace / "build" / "Tone.js"
        if not bundle.is_file():
            parser.error(f"Upstream build did not produce {bundle}")
        shutil.copy2(bundle, OUTPUT)

    print(f"Built {OUTPUT} directly from the pinned TypeScript source")
    print("Next: python3 tools/build_tone_page.py")


if __name__ == "__main__":
    main()
