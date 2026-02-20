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
  --evaluate --judge-provider openai --judge-model gpt-5.2

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
    runner.py                 # Run prompt x image matrix, collect results (+ text-only)
    evaluator.py              # LLM-as-judge + human rating scaffolding
    parametric.py             # Parametric hint generation (random dimension sampling)
    labeler.py                # LLM-based short label generation for artifacts
    summarize.py              # Aggregate scores across all runs
    image_utils.py            # Load/encode images from URL or file
    providers/
      base.py                 # VisionProvider protocol
      openai_provider.py      # OpenAI (GPT-5.2, ...)
      anthropic_provider.py   # Anthropic (Claude Opus 4.6, Claude Sonnet 4.6, ...)
      gemini_provider.py      # Google Gemini
  experiments/                # Experiment definitions (YAML)
    emotional_response/       # Single-image emotional response (5 prompt variants)
    profile_generation/       # v2 profile generation (7 variability hints, text-only)
    style_generation/         # v2 style generation (7 variability hints, text-only)
    initial_state_generation/ # v2 initial state generation (7 variability hints, text-only)
    stateful_reflection/      # Sequential gallery walk (profile + style + state + images)
    stateful_baseline/        # Master prompt definitions + dimension docs (reference)
  output/                     # Results (gitignored)
  scripts/
    run_experiment.py         # CLI for single-stage experiments
    run_stateful.py           # CLI for sequential gallery walk
    run_contrastive_stateful.py # Orchestrate 2×2 cross-model/cross-judge stateful comparison
    generate_labels.py        # Generate short (2–4 word) labels for artifacts
  docs/                       # Research documentation
    generation-eval-report.md # Full evaluation report with scores, analysis, and pending work
    dimensions.md             # Theoretical grounding for the 7-dimension framework
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
  config.json                          # Frozen experiment config
  prompts.json                         # Frozen prompt variants (including parametric hints)
  results.json                         # All RunResults (response text, latency, tokens)
  scores.json                          # LLM-as-judge scores (latest judge)
  scores_openai_gpt-5.2.json           # Judge-specific scores (when judge_model_name is set)
  scores_anthropic_claude-opus-4-6.json # Allows multiple judges without overwrites
  human_ratings/
    template.json                      # Pre-filled template for manual scoring
```

When `--evaluate-only` is used, prompts are loaded from the run's own `prompts.json` (not the experiment YAML), so parametric and reuse-prompt runs evaluate correctly.

The `human_ratings/template.json` uses the same schema as LLM scores, so human and automated scores can be compared directly.

Stateful reflection runs also include:

```
output/stateful_reflection/<timestamp>/
  artifacts.json            # Generated profile, style, and initial state text
  assembled_prompts.json    # Fully substituted prompts sent to the VLM per image
```

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

## Stateful baseline v2 experiments

The v2 prompt architecture separates generation into independent stages that can be tested and combined factorially. See `docs/dimensions.md` for the full theoretical grounding.

### Step 1: Generate and evaluate artifacts (text-only)

```bash
# Generate and evaluate profiles (7 fixed hint variants)
python scripts/run_experiment.py --experiment profile_generation --evaluate

# Generate and evaluate styles (7 fixed hint variants)
python scripts/run_experiment.py --experiment style_generation --evaluate

# Generate and evaluate initial states (7 fixed hint variants)
python scripts/run_experiment.py --experiment initial_state_generation --evaluate
```

These are text-only experiments (no images). Each produces 7 outputs (one per variability hint) and evaluates them against stage-specific criteria.

#### Parametric variants

Instead of the 7 fixed hints (which carve narrow corridors in the dimension space), use `--parametric N` to randomly sample dimensions:

```bash
# Generate 7 parametric profiles and evaluate
python scripts/run_experiment.py --experiment profile_generation --parametric 7 --evaluate

# Same for styles and initial states
python scripts/run_experiment.py --experiment style_generation --parametric 7 --evaluate
python scripts/run_experiment.py --experiment initial_state_generation --parametric 7 --evaluate
```

Each parametric variant randomly selects 2–4 of the 7 dimensions to constrain, leaving the rest for the model to resolve creatively. This produces more diverse and coherent outputs than specifying all dimensions at once.

#### Cross-model testing

Use `--provider` / `--model` to change the generator, and `--judge-provider` / `--judge-model` to change the evaluator:

```bash
# GPT-5.2 generates, GPT-5.2 judges (default)
python scripts/run_experiment.py -e profile_generation --parametric 7 --evaluate

# GPT-5.2 generates, Claude Opus 4.6 judges
python scripts/run_experiment.py -e profile_generation --parametric 7 --evaluate \
  --judge-provider anthropic --judge-model claude-opus-4-6

# Claude Opus 4.6 generates, GPT-5.2 judges
python scripts/run_experiment.py -e profile_generation --parametric 7 \
  -p anthropic -m claude-opus-4-6 --evaluate \
  --judge-provider openai --judge-model gpt-5.2

# Claude Opus 4.6 generates, Claude Opus 4.6 judges
python scripts/run_experiment.py -e profile_generation --parametric 7 \
  -p anthropic -m claude-opus-4-6 --evaluate

# Re-evaluate an existing GPT run with Claude as judge
python scripts/run_experiment.py -e profile_generation \
  --evaluate-only output/profile_generation/<timestamp>/ \
  --judge-provider anthropic --judge-model claude-opus-4-6
```

#### Controlled cross-model comparison with `--reuse-prompts`

When using `--parametric`, each run gets different randomly generated hints, making direct comparison across providers unreliable. To fix this, use `--reuse-prompts` to apply the exact same prompts from a previous run to a different generator:

```bash
# 1. Generate with GPT (creates prompts.json with parametric hints)
python scripts/run_experiment.py -e profile_generation --parametric 7 --evaluate

# 2. Re-run with Claude using the same prompts
python scripts/run_experiment.py -e profile_generation \
  --reuse-prompts output/profile_generation/<gpt-timestamp>/ \
  -p anthropic -m claude-opus-4-6 --evaluate

# 3. Cross-judge: evaluate the GPT run with Claude as judge
python scripts/run_experiment.py -e profile_generation \
  --evaluate-only output/profile_generation/<gpt-timestamp>/ \
  --judge-provider anthropic --judge-model claude-opus-4-6

# 4. Cross-judge: evaluate the Claude run with GPT as judge
python scripts/run_experiment.py -e profile_generation \
  --evaluate-only output/profile_generation/<claude-timestamp>/ \
  --judge-provider openai --judge-model gpt-5.2
```

This gives a full 2×2 comparison (GPT-gen / Claude-gen × GPT-judge / Claude-judge) with identical input prompts.

### Step 2: Run a sequential gallery walk

```bash
# Auto-generate all artifacts and walk through the gallery
python scripts/run_stateful.py

# With evaluation
python scripts/run_stateful.py --evaluate

# Use saved artifacts from step 1 (factorial experiments)
python scripts/run_stateful.py \
  --profile output/profile_generation/<timestamp>/results.json:hint_unusual_combo \
  --style output/style_generation/<timestamp>/results.json:hint_terse_fragmented \
  --initial-state output/initial_state_generation/<timestamp>/results.json:hint_depleted_guarded

# Use inline text for quick testing
python scripts/run_stateful.py --profile-text "Tolerance for ambiguity is high..."

# Reuse artifacts from a previous run (for controlled cross-model comparison)
python scripts/run_stateful.py \
  -p anthropic -m claude-opus-4-6 \
  --reuse-artifacts output/stateful_reflection/<gpt-timestamp>/ \
  --evaluate

# Show results from a previous run
python scripts/run_stateful.py --show output/stateful_reflection/<timestamp>/
```

The stateful runner:
1. Resolves profile, style, and initial state (from files, inline text, or auto-generation)
2. For each image, assembles the reflection prompt with the current state
3. Calls the VLM, parses `[REFLECTION]` and `[STATE]` from the response
4. Carries the `[STATE]` forward to the next image
5. Saves all results + artifacts to a timestamped output directory

### Factorial design

To test profile x style x state interactions, run step 1 once to build a library of artifacts, then run step 2 multiple times with different combinations:

```bash
# Profile A x Style A
python scripts/run_stateful.py \
  --profile output/profile_generation/.../results.json:hint_unusual_combo \
  --style output/style_generation/.../results.json:hint_terse_fragmented

# Profile A x Style B (same profile, different style)
python scripts/run_stateful.py \
  --profile output/profile_generation/.../results.json:hint_unusual_combo \
  --style output/style_generation/.../results.json:hint_literary_expansive
```

### Cross-model stateful comparison

Use `run_contrastive_stateful.py` to run the full 2×2 matrix (GPT-gen / Claude-gen × GPT-judge / Claude-judge) for a given set of artifacts:

```bash
# Run with default artifacts (high-ambiguity profile)
python scripts/run_contrastive_stateful.py

# Dry-run: print commands without executing
python scripts/run_contrastive_stateful.py --dry-run

# Custom artifact selection
python scripts/run_contrastive_stateful.py \
  --profile output/profile_generation/<timestamp>/results.json:<variant_id> \
  --style output/style_generation/<timestamp>/results.json:<variant_id> \
  --state output/initial_state_generation/<timestamp>/results.json:<variant_id>
```

This orchestrates 4 sequential steps: GPT generation + self-eval, Claude cross-judge, Claude generation (reusing artifacts) + self-eval, GPT cross-judge.

## Adding a new experiment

1. Create a directory under `experiments/` (e.g. `experiments/my_experiment/`)
2. Add `config.yaml`, `prompts.yaml`, and `criteria.yaml`
3. Run: `python scripts/run_experiment.py --experiment my_experiment --evaluate`

Text-only experiments: set `images: []` in config.yaml. The runner will use `generate_text()` instead of the vision API.

## Relation to the main app

This pipeline is **independent** of the TypeScript/React app. It calls LLM APIs directly via Python SDKs — no Vite proxy or Express server needed. The prompt design draws from `src/prompts.ts` and `docs/prompts/`, and the evaluation criteria map to the research constructs in `research/docs/thesis-defense-plan.md`.