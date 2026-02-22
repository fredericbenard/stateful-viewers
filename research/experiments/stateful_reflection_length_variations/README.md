# Stateful reflection length variations

Stateful, **single-image** experiment to test how prompt constraints affect the **length of the `[REFLECTION]` block**.

## Inputs (frozen)

Reuses the **high ambiguity** artifacts:

- `artifacts/profile.txt`
- `artifacts/style.txt`
- `artifacts/initial_state.txt`

## Image

Single image (from the same gallery set as `stateful_reflection_high_ambiguity`):

- `park_ave_doors`

## Prompt variants

Defined in `variants.yaml`:

- `v00_base`: current prompt (4–8 sentences reflection)
- `v01_reflection_2to3_sentences`: force **2–3 sentences**
- `v02_reflection_max_70_words`: force **≤ 70 words**

## Evaluation criteria

Same criteria as `stateful_reflection_high_ambiguity`, plus:

- `reflection_length`: measures brevity + compliance with the variant’s length constraints.

## Run

From `research/`:

```bash
python scripts/run_stateful.py stateful_reflection_length_variations --evaluate
```

To override the model/provider (and also use that as the judge, unless overridden):

```bash
python scripts/run_stateful.py stateful_reflection_length_variations -p openai -m gpt-5.2 --evaluate
```
