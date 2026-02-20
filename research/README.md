# Research: LLM Evaluation Pipeline

A Python-based evaluation pipeline for running controlled experiments with vision-language models. Generate prompt variants, send them to LLMs, collect responses, and evaluate via LLM-as-judge.

## Setup

```bash
cd research
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # then edit with your API keys
```

## Quick start

```bash
# Generate profiles with frozen variants and evaluate
python scripts/run_experiment.py -e profile_generation --evaluate

# Run a stateful gallery walk with frozen artifacts
python scripts/run_stateful.py stateful_reflection_low_ambiguity --evaluate

# Full 2×2 contrastive experiment (GPT × Claude generators and judges)
python scripts/run_contrastive.py stateful_reflection_low_ambiguity --dry-run
```

## Project structure

```
research/
  eval_pipeline/              # Core library
    types.py                  # Dataclasses (PromptVariant, RunResult, EvalScore, ...)
    config_loader.py          # Load experiment config from YAML (prefers variants.yaml)
    provider_factory.py       # Instantiate providers by name
    runner.py                 # Run prompt × image matrix, collect results (+ text-only)
    evaluator.py              # LLM-as-judge scoring + human rating scaffolding
    parametric.py             # Parametric hint generation (used by generate_variants.py)
    manifest.py               # Run manifest (CLI args, git SHA, environment)
    summarize.py              # Aggregate scores across all runs
    image_utils.py            # Load/encode images from URL or file
    providers/
      base.py                 # VisionProvider protocol
      openai_provider.py      # OpenAI (GPT-5.2, ...)
      anthropic_provider.py   # Anthropic (Claude Opus 4.6, ...)
      gemini_provider.py      # Google Gemini
  experiments/                # Experiment definitions (YAML) — committed to git
    profile_generation/       # Profile generation + frozen variants.yaml
    style_generation/         # Style generation + frozen variants.yaml
    initial_state_generation/ # Initial state generation + frozen variants.yaml
    stateful_reflection/      # Shared prompt template + criteria (not directly runnable)
    stateful_reflection_low_ambiguity/   # Frozen artifacts: low-ambiguity profile
    stateful_reflection_high_ambiguity/  # Frozen artifacts: high-ambiguity profile
  output/                     # Results (gitignored — regenerable from experiments/)
  scripts/
    run_experiment.py         # CLI for single-stage generation experiments
    run_stateful.py           # CLI for sequential gallery walk
    run_contrastive.py        # Orchestrate 2×2 cross-model/cross-judge experiments
    generate_variants.py      # Generate & freeze parametric variants as variants.yaml
    freeze_artifacts.py       # Freeze artifacts into a stateful experiment directory
  docs/                       # Research documentation (see docs/README.md for index)
```

## Reproducibility model

Everything needed to reproduce an experiment is committed to git under `experiments/`:

- **Generation experiments** have `variants.yaml` — frozen parametric prompt variants.
- **Stateful experiments** have `artifacts/` — frozen profile, style, and initial state text, with `provenance.yaml` recording their origin.

The `output/` directory is gitignored — results are regenerable from the committed experiment definitions. Each run also saves a `run_manifest.json` with the CLI command, git SHA, and Python version.

## Experiment types

### Generation experiments (text-only)

Generate profiles, styles, or initial states using frozen parametric variants:

```bash
python scripts/run_experiment.py -e profile_generation --evaluate
python scripts/run_experiment.py -e style_generation --evaluate
python scripts/run_experiment.py -e initial_state_generation --evaluate
```

Each experiment directory contains:

- `config.yaml` — provider, model, temperature, max_tokens, images
- `prompts.yaml` — base system prompt and user prompt template
- `variants.yaml` — frozen parametric prompt variants (used by default)
- `criteria.yaml` — evaluation criteria with 1–5 scoring rubrics

Cross-model comparison uses the same frozen variants:

```bash
# Claude generates with same variants
python scripts/run_experiment.py -e profile_generation \
  -p anthropic -m claude-opus-4-6 --evaluate

# Re-evaluate an existing run with a different judge
python scripts/run_experiment.py -e profile_generation \
  --evaluate-only output/profile_generation/<timestamp>/ \
  --judge-provider anthropic --judge-model claude-opus-4-6
```

To regenerate frozen variants (e.g. with a different seed):

```bash
python scripts/generate_variants.py profile_generation --count 7 --seed 42
```

### Stateful reflection experiments (multimodal)

Walk through a gallery sequence with a frozen viewer profile, reflective style, and initial state:

```bash
python scripts/run_stateful.py stateful_reflection_low_ambiguity --evaluate
python scripts/run_stateful.py stateful_reflection_high_ambiguity \
  -p anthropic -m claude-opus-4-6 --evaluate
```

Each per-profile experiment directory contains:

- `artifacts/profile.txt`, `style.txt`, `initial_state.txt` — frozen text artifacts
- `config.yaml` — provider, model, images
- `prompts.yaml` — reflection prompt template with `{profile}`, `{style}`, `{current_state}` placeholders
- `criteria.yaml` — 9 evaluation criteria (including vision-grounded `image_responsiveness`)
- `provenance.yaml` — records where artifacts came from

The runner loads artifacts, walks through each image, and carries `[STATE]` forward between images.

### Cross-model contrastive experiments

Run the full 2×2 matrix (GPT/Claude generators × GPT/Claude judges):

```bash
python scripts/run_contrastive.py stateful_reflection_low_ambiguity
python scripts/run_contrastive.py stateful_reflection_low_ambiguity stateful_reflection_high_ambiguity
python scripts/run_contrastive.py stateful_reflection_low_ambiguity --dry-run
```

## Creating new experiments

**New generation experiment:** create a directory with `config.yaml`, `prompts.yaml`, `criteria.yaml`, then generate frozen variants:

```bash
python scripts/generate_variants.py my_experiment --count 7 --seed 42
python scripts/run_experiment.py -e my_experiment --evaluate
```

**New stateful experiment:** freeze artifacts from generation runs:

```bash
python scripts/freeze_artifacts.py stateful_reflection_new_profile \
  --profile output/profile_generation/<ts>/results.json:<variant_id> \
  --style output/style_generation/<ts>/results.json:<variant_id> \
  --state output/initial_state_generation/<ts>/results.json:<variant_id> \
  --description "Description of this profile configuration"
```

## Output format

Each run creates a timestamped directory under `output/`:

```
output/<experiment_id>/<timestamp>/
  run_manifest.json            # CLI args, git SHA, Python version
  config.json                  # Frozen experiment config
  prompts.json                 # Frozen prompt variants used
  results.json                 # All responses (text, latency, tokens)
  scores.json                  # LLM-as-judge scores (latest judge)
  scores_<provider>_<model>.json  # Judge-tagged scores (multiple judges coexist)
  judge_prompts.json           # Exact prompts sent to the judge
  human_ratings/template.json  # Pre-filled template for manual scoring
```

Stateful runs additionally include `artifacts.json` and `assembled_prompts.json`.

## Summarizing across runs

```bash
python scripts/run_experiment.py -e profile_generation --summarize
```

Aggregates scores from all runs into a summary table and saves `output/<experiment_id>/summary.json`. No API keys needed.

## Relation to the main app

This pipeline is **independent** of the TypeScript/React app. It calls LLM APIs directly via Python SDKs. The prompt design draws from `src/prompts.ts`, and the evaluation criteria map to the research constructs in `docs/planning/thesis-defense-plan.md`.
