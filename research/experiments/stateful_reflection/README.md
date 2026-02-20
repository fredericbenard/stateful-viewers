# stateful_reflection — shared template

This directory is **not a runnable experiment**. It holds the shared prompt
template and evaluation criteria used by all per-profile stateful experiments
(e.g. `stateful_reflection_low_ambiguity`, `stateful_reflection_high_ambiguity`).

## Contents

- `prompts.yaml` — system prompt and `user_prompt_template` with `{profile}`,
  `{style}`, and `{current_state}` placeholders
- `criteria.yaml` — 9 evaluation criteria for LLM-as-judge scoring

## How it's used

- `freeze_artifacts.py` copies `prompts.yaml` and `criteria.yaml` from here
  when creating a new per-profile experiment directory.
- Per-profile directories each have their own copy of these files (for
  self-containment), but this directory is the canonical source.

To create a new runnable experiment, use:

```bash
python scripts/freeze_artifacts.py stateful_reflection_<name> \
  --profile ... --style ... --state ... \
  --description "..."
```
