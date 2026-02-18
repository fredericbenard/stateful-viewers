# Research: LLM Evaluation Pipeline

A Python-based evaluation pipeline for running controlled experiments with vision-language models. Define prompt variants, send them with images to LLMs, collect responses, and evaluate them via LLM-as-judge (with human rating support scaffolded).

## Setup

```bash
cd research

# Create a virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure API keys
cp .env.example .env
# Edit .env with your keys
```

## Quick start

Run the first experiment (emotional response to an image, 5 prompt variants):

```bash
# Run with OpenAI (default)
python scripts/run_experiment.py --experiment emotional_response

# Run with a different provider
python scripts/run_experiment.py --experiment emotional_response --provider anthropic

# Run and evaluate (LLM-as-judge)
python scripts/run_experiment.py --experiment emotional_response --evaluate

# Use a different model for judging
python scripts/run_experiment.py --experiment emotional_response \
  --evaluate --judge-provider openai --judge-model gpt-4o

# Evaluate existing results
python scripts/run_experiment.py --experiment emotional_response \
  --evaluate-only output/emotional_response/2026-02-18T14-30-00/

# Show scores and responses for a specific run
python scripts/run_experiment.py --experiment emotional_response \
  --show output/emotional_response/2026-02-18T21-40-41

# Summarize scores across all runs
python scripts/run_experiment.py --experiment emotional_response --summarize
```

## Project structure

```
research/
  eval_pipeline/              # Core library
    types.py                  # Dataclasses (PromptVariant, RunResult, EvalScore, ...)
    config_loader.py          # Load experiment config from YAML
    provider_factory.py       # Instantiate providers by name
    runner.py                 # Run prompt x image matrix, collect results
    evaluator.py              # LLM-as-judge + human rating scaffolding
    summarize.py              # Aggregate scores across all runs
    image_utils.py            # Load/encode images from URL or file
    providers/
      base.py                 # VisionProvider protocol
      openai_provider.py      # OpenAI (GPT-4o, GPT-5.2, ...)
      anthropic_provider.py   # Anthropic (Claude Sonnet 4.5, ...)
      gemini_provider.py      # Google Gemini
  experiments/                # Experiment definitions (YAML)
    emotional_response/
      config.yaml             # Model, temperature, images
      prompts.yaml            # 5 prompt variants
      criteria.yaml           # 5 evaluation criteria
  output/                     # Results (gitignored)
  scripts/
    run_experiment.py         # CLI entry point
  docs/                       # Research documentation
```

## Defining experiments

Each experiment is a directory under `experiments/` with three YAML files:

### `config.yaml` — what to run

- `experiment_id`: directory name
- `provider` / `model`: which LLM to use
- `temperature` / `max_tokens`: generation parameters
- `images`: list of images (URL or local path, with optional caption)
- `prompt_variant_ids`: which variants to run (empty = all)

### `prompts.yaml` — prompt variants

Each variant has:

- `id`: unique identifier
- `name`: human-readable label
- `system_prompt`: the system message
- `user_prompt`: the user message sent with the image

### `criteria.yaml` — evaluation criteria

Each criterion has:

- `id`: unique identifier
- `name`: human-readable label
- `description`: what it measures
- `scoring_prompt`: 1-5 rubric for the judge LLM

## Output format

Each run creates a timestamped directory:

```
output/emotional_response/2026-02-18T14-30-00/
  config.json           # Frozen experiment config
  prompts.json          # Frozen prompt variants
  results.json          # All RunResults (response text, latency, tokens)
  scores.json           # LLM-as-judge scores (if --evaluate)
  human_ratings/
    template.json       # Pre-filled template for manual scoring
```

The `human_ratings/template.json` uses the same schema as LLM scores, so human and automated scores can be compared directly.

## Summarizing across runs

Use `--summarize` to aggregate scores from every run of an experiment:

```bash
python scripts/run_experiment.py --experiment emotional_response --summarize
```

This prints:

- A **runs** table with provider, model, and result/score counts per run
- A **mean scores** table (variant x criterion) with sample counts and row averages
- A **score ranges** table showing min-max spread per cell

It also saves `output/<experiment_id>/summary.json` with the full aggregated data. No API keys are needed — it reads only from local output files.

## Adding a new experiment

1. Create a directory under `experiments/` (e.g. `experiments/my_experiment/`)
2. Add `config.yaml`, `prompts.yaml`, and `criteria.yaml`
3. Run: `python scripts/run_experiment.py --experiment my_experiment --evaluate`

## Relation to the main app

This pipeline is **independent** of the TypeScript/React app. It calls LLM APIs directly via Python SDKs — no Vite proxy or Express server needed. The prompt design draws from `src/prompts.ts` and `docs/prompts/`, and the evaluation criteria map to the research constructs in `research/docs/thesis-defense-plan.md`.