# Initial state label prompt variations

Text-only experiment to compare different **initial state label** prompt wordings.

## Goal

Find label prompts that produce **shorter** and **more interesting** tags while staying grounded in the arrival state (mood, tension/ease, energy, openness, attentional quality).

## Inputs (frozen)

This experiment uses two fixed public initial states:

- **Muted/weary**: `artifacts/muted_weary_state.txt`
- **Alert/buoyant**: `artifacts/alert_buoyant_state.txt`

## Prompt variants

Defined in `variants.yaml`.

- `v00_*`: base prompt (mirrors `src/prompts.ts:getStateLabelUserPrompt`)
- `v01_*`…`v05_*`: increasingly strict short-label constraints (2–3 words, exactly 2 words, adjective+noun form, participle-first, max character length)

## Run

From `research/` (after setting up `.venv` and `.env`):

```bash
python scripts/run_experiment.py -e state_label_prompt_variations --evaluate
```

