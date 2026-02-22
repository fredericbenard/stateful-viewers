# Profile label prompt variations

Text-only experiment to compare different **profile label** prompt wordings.

## Goal

Find label prompts that produce **shorter** and **more interesting** tags while staying grounded in the inputs.

## Inputs (frozen)

This experiment uses two fixed public inputs (profiles):

- **High ambiguity**: `artifacts/high_ambiguity_profile.txt`
- **Low ambiguity**: `artifacts/low_ambiguity_profile.txt`

## Prompt variants

Defined in `variants.yaml`.

- `v00_*`: base prompt (mirrors `src/prompts.ts:getProfileLabelFromProfileUserPrompt`)
- `v01_*`…`v05_*`: increasingly strict short-label constraints (2–3 words, exactly 2 words, hyphen-compound form, participle-first, max character length)

## Run

From `research/` (after setting up `.venv` and `.env`):

```bash
python scripts/run_experiment.py -e profile_label_prompt_variations --evaluate
```

