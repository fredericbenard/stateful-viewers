# Style label prompt variations

Text-only experiment to compare different **style label** prompt wordings.

## Goal

Find label prompts that produce **shorter** and **more interesting** tags while staying grounded in the *voice* (cadence, register, texture, intimacy, fragmentation, metaphor habit).

## Inputs (frozen)

This experiment uses two fixed public styles:

- **High**: `artifacts/high_style.txt`
- **Low**: `artifacts/low_style.txt`

## Prompt variants

Defined in `variants.yaml`.

- `v00_*`: base prompt (mirrors `src/prompts.ts:getStyleLabelUserPrompt`)
- `v01_*`…`v05_*`: increasingly strict short-label constraints (2–3 words, exactly 2 words, hyphen-compound form, participle-first, max character length)

## Run

From `research/` (after setting up `.venv` and `.env`):

```bash
python scripts/run_experiment.py -e style_label_prompt_variations --evaluate
```

