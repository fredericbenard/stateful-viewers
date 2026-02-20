#!/usr/bin/env python3
"""Generate parametric prompt variants and freeze them as variants.yaml.

Usage:
  python scripts/generate_variants.py profile_generation --count 7
  python scripts/generate_variants.py style_generation --count 7 --seed 42
  python scripts/generate_variants.py initial_state_generation --count 7
"""

from __future__ import annotations

import argparse
import random
import sys
from pathlib import Path

import yaml

_RESEARCH_DIR = Path(__file__).resolve().parent.parent
if str(_RESEARCH_DIR) not in sys.path:
    sys.path.insert(0, str(_RESEARCH_DIR))

from eval_pipeline.parametric import generate_parametric_variants

EXPERIMENTS_DIR = _RESEARCH_DIR / "experiments"


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate parametric variants and save as variants.yaml.",
    )
    parser.add_argument(
        "experiment",
        help="Experiment id (profile_generation, style_generation, initial_state_generation).",
    )
    parser.add_argument(
        "--count", "-n", type=int, default=7,
        help="Number of variants to generate (default: 7).",
    )
    parser.add_argument(
        "--seed", type=int, default=None,
        help="Random seed for reproducibility. Recorded in the output file.",
    )
    parser.add_argument(
        "--force", action="store_true",
        help="Overwrite existing variants.yaml.",
    )

    args = parser.parse_args()

    exp_dir = EXPERIMENTS_DIR / args.experiment
    if not exp_dir.is_dir():
        print(f"Error: experiment directory not found: {exp_dir}")
        sys.exit(1)

    out_path = exp_dir / "variants.yaml"
    if out_path.is_file() and not args.force:
        print(f"Error: {out_path.relative_to(_RESEARCH_DIR)} already exists. Use --force to overwrite.")
        sys.exit(1)

    seed = args.seed
    if seed is not None:
        random.seed(seed)

    variants = generate_parametric_variants(
        args.experiment, args.count, EXPERIMENTS_DIR,
    )

    data: dict = {}
    if seed is not None:
        data["_seed"] = seed
    data["variants"] = [
        {
            "id": v.id,
            "name": v.name,
            "system_prompt": v.system_prompt,
            "user_prompt": v.user_prompt,
        }
        for v in variants
    ]

    out_path.write_text(
        yaml.dump(data, default_flow_style=False, allow_unicode=True, width=120, sort_keys=False)
    )
    print(f"Wrote {len(variants)} variants → {out_path.relative_to(_RESEARCH_DIR)}")
    if seed is not None:
        print(f"  (seed: {seed})")


if __name__ == "__main__":
    main()
