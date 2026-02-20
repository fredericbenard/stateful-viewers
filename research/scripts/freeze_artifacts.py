#!/usr/bin/env python3
"""Freeze artifacts into a stateful experiment directory.

Extracts profile, style, and initial state text from generation run outputs
(or a previous stateful run) and saves them as plain text files in the
experiment's artifacts/ directory.

Usage:

  # From generation run results (variant_id selection):
  python scripts/freeze_artifacts.py stateful_reflection_low_ambiguity \
    --profile output/profile_generation/2026-02-.../results.json:parametric_001_... \
    --style output/style_generation/2026-02-.../results.json:parametric_006_... \
    --state output/initial_state_generation/2026-02-.../results.json:parametric_004_...

  # From a previous stateful run's artifacts.json:
  python scripts/freeze_artifacts.py stateful_reflection_low_ambiguity \
    --from-run output/stateful_reflection/2026-02-.../

  # From plain text files:
  python scripts/freeze_artifacts.py stateful_reflection_new \
    --profile-file my_profile.txt \
    --style-file my_style.txt \
    --state-file my_state.txt
"""

from __future__ import annotations

import argparse
import json
import shutil
import sys
from pathlib import Path

import yaml

_RESEARCH_DIR = Path(__file__).resolve().parent.parent
EXPERIMENTS_DIR = _RESEARCH_DIR / "experiments"


def _load_from_results(path_spec: str) -> str:
    """Load text from ``results.json:variant_id``."""
    parts = path_spec.rsplit(":", 1)
    results_path = Path(parts[0])
    variant_id = parts[1] if len(parts) > 1 else None

    if not results_path.is_file():
        raise FileNotFoundError(f"Results file not found: {results_path}")

    raw = json.loads(results_path.read_text())
    if variant_id:
        matches = [r for r in raw if r["prompt_variant_id"] == variant_id]
        if not matches:
            available = sorted({r["prompt_variant_id"] for r in raw})
            raise ValueError(f"Variant '{variant_id}' not found. Available: {available}")
        return matches[0]["raw_response"]
    return raw[0]["raw_response"]


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Freeze artifacts into a stateful experiment directory.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "experiment",
        help="Target experiment directory name (e.g. stateful_reflection_low_ambiguity).",
    )
    parser.add_argument("--profile", default=None, help="results.json:variant_id for profile.")
    parser.add_argument("--style", default=None, help="results.json:variant_id for style.")
    parser.add_argument("--state", default=None, help="results.json:variant_id for initial state.")
    parser.add_argument("--profile-file", default=None, help="Plain text file for profile.")
    parser.add_argument("--style-file", default=None, help="Plain text file for style.")
    parser.add_argument("--state-file", default=None, help="Plain text file for initial state.")
    parser.add_argument("--from-run", default=None, help="Load all artifacts from a previous stateful run directory.")
    parser.add_argument("--force", action="store_true", help="Overwrite existing artifacts.")
    parser.add_argument("--description", default="", help="Short description for provenance.yaml.")

    args = parser.parse_args()

    exp_dir = EXPERIMENTS_DIR / args.experiment
    if not exp_dir.is_dir():
        base_dir = EXPERIMENTS_DIR / "stateful_reflection"
        if not base_dir.is_dir():
            print(f"Error: neither {exp_dir} nor {base_dir} exist.")
            sys.exit(1)
        print(f"Creating {exp_dir.name}/ from stateful_reflection/ template...")
        exp_dir.mkdir()
        for fname in ("criteria.yaml", "prompts.yaml"):
            src = base_dir / fname
            if src.is_file():
                shutil.copy2(src, exp_dir / fname)

    artifacts_dir = exp_dir / "artifacts"
    if artifacts_dir.is_dir() and not args.force:
        existing = list(artifacts_dir.glob("*.txt"))
        if existing:
            print(f"Error: artifacts/ already contains files. Use --force to overwrite.")
            sys.exit(1)
    artifacts_dir.mkdir(exist_ok=True)

    provenance_sources: dict[str, str] = {}

    if args.from_run:
        run_dir = Path(args.from_run)
        artifacts_json = run_dir / "artifacts.json"
        if not artifacts_json.is_file():
            print(f"Error: artifacts.json not found in {run_dir}")
            sys.exit(1)
        saved = json.loads(artifacts_json.read_text())
        artifacts = {
            "profile": saved["profile"],
            "style": saved["style"],
            "initial_state": saved["initial_state"],
        }
        for key in artifacts:
            provenance_sources[key] = str(run_dir.relative_to(_RESEARCH_DIR)) + "/artifacts.json"
    else:
        artifacts = {}
        for key, flag, file_flag in (
            ("profile", args.profile, args.profile_file),
            ("style", args.style, args.style_file),
            ("initial_state", args.state, args.state_file),
        ):
            if flag:
                artifacts[key] = _load_from_results(flag)
                provenance_sources[key] = flag
            elif file_flag:
                p = Path(file_flag)
                if not p.is_file():
                    print(f"Error: file not found: {p}")
                    sys.exit(1)
                artifacts[key] = p.read_text().strip()
                provenance_sources[key] = str(p)
            else:
                print(f"Error: no source provided for {key}. Use --{key.replace('_', '-')} or --{key.replace('_', '-')}-file.")
                sys.exit(1)

    for key, fname in (("profile", "profile.txt"), ("style", "style.txt"), ("initial_state", "initial_state.txt")):
        txt_path = artifacts_dir / fname
        txt_path.write_text(artifacts[key])
        print(f"  {fname}: {len(artifacts[key])} chars")

    # Write/update config.yaml to point to artifacts/
    config_path = exp_dir / "config.yaml"
    if config_path.is_file():
        config = yaml.safe_load(config_path.read_text())
    else:
        base_config_path = EXPERIMENTS_DIR / "stateful_reflection" / "config.yaml"
        config = yaml.safe_load(base_config_path.read_text())
    config["experiment_id"] = args.experiment
    config["profile"] = "artifacts/profile.txt"
    config["style"] = "artifacts/style.txt"
    config["initial_state"] = "artifacts/initial_state.txt"
    config_path.write_text(
        yaml.dump(config, default_flow_style=False, allow_unicode=True, width=120, sort_keys=False)
    )

    provenance = {
        "description": args.description or f"Frozen artifacts for {args.experiment}",
        "sources": provenance_sources,
    }
    prov_path = exp_dir / "provenance.yaml"
    prov_path.write_text(
        yaml.dump(provenance, default_flow_style=False, allow_unicode=True, width=120, sort_keys=False)
    )

    print(f"\nFrozen artifacts → {exp_dir.relative_to(_RESEARCH_DIR)}/artifacts/")
    print(f"Provenance → {prov_path.relative_to(_RESEARCH_DIR)}")


if __name__ == "__main__":
    main()
