"""LLM-as-judge evaluator and human rating scaffolding."""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Sequence

from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn, TimeElapsedColumn

from eval_pipeline.providers.base import VisionProvider
from eval_pipeline.types import EvalCriterion, EvalScore, PromptVariant, RunResult

console = Console()

JUDGE_SYSTEM_PROMPT = """\
You are an expert evaluator assessing LLM-generated responses to images.
You will be given:
- The prompt that was sent to the model
- The model's response
- A specific evaluation criterion with a scoring rubric

Score the response on a scale of 1-5 according to the criterion.

You MUST respond in exactly this format:

SCORE: <number 1-5>
RATIONALE: <2-4 sentences explaining the score>

Nothing else. No preamble, no markdown."""

JUDGE_USER_TEMPLATE = """\
## Prompt sent to the model

System: {system_prompt}

User: {user_prompt}

## Model response

{response}

## Evaluation criterion: {criterion_name}

{criterion_description}

{scoring_prompt}

Score this response (1-5) according to the criterion above."""


def evaluate_results(
    results: list[RunResult],
    prompts: Sequence[PromptVariant],
    criteria: Sequence[EvalCriterion],
    judge: VisionProvider,
    *,
    judge_model_name: str = "",
) -> list[EvalScore]:
    """Score each result against each criterion using the judge LLM."""

    prompt_map = {p.id: p for p in prompts}
    total = len(results) * len(criteria)

    if not total:
        console.print("[yellow]Nothing to evaluate.[/yellow]")
        return []

    console.print(
        f"\nEvaluating [bold]{len(results)}[/bold] result(s) x "
        f"[bold]{len(criteria)}[/bold] criteria = {total} judgment(s)\n"
    )

    scores: list[EvalScore] = []

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        TimeElapsedColumn(),
        console=console,
    ) as progress:
        task = progress.add_task("Evaluating...", total=total)

        for result in results:
            variant = prompt_map.get(result.prompt_variant_id)
            if not variant:
                progress.advance(task, advance=len(criteria))
                continue

            for criterion in criteria:
                progress.update(
                    task,
                    description=f"[{result.prompt_variant_id}] x [{criterion.id}]",
                )

                user_prompt = JUDGE_USER_TEMPLATE.format(
                    system_prompt=variant.system_prompt,
                    user_prompt=variant.user_prompt,
                    response=result.raw_response,
                    criterion_name=criterion.name,
                    criterion_description=criterion.description,
                    scoring_prompt=criterion.scoring_prompt,
                )

                resp = judge.generate_text(
                    system_prompt=JUDGE_SYSTEM_PROMPT,
                    user_prompt=user_prompt,
                    temperature=0.3,
                    max_tokens=512,
                )

                score_val, rationale = _parse_judge_response(resp.content)

                scores.append(
                    EvalScore(
                        run_result_id=result.id,
                        criterion_id=criterion.id,
                        score=score_val,
                        rationale=rationale,
                        judge_model=judge_model_name or judge.name,
                        source="llm",
                    )
                )
                progress.advance(task)

    console.print(f"\n[green]Completed {len(scores)} evaluation(s).[/green]\n")
    return scores


def _parse_judge_response(text: str) -> tuple[int, str]:
    """Extract score and rationale from the judge's response."""
    score = 0
    rationale = text.strip()

    score_match = re.search(r"SCORE:\s*(\d)", text)
    if score_match:
        score = int(score_match.group(1))
        score = max(1, min(5, score))

    rationale_match = re.search(r"RATIONALE:\s*(.+)", text, re.DOTALL)
    if rationale_match:
        rationale = rationale_match.group(1).strip()

    return score, rationale


def save_scores(run_dir: Path, scores: list[EvalScore]) -> None:
    """Save evaluation scores to the run directory."""
    (run_dir / "scores.json").write_text(
        json.dumps([s.to_dict() for s in scores], indent=2, ensure_ascii=False) + "\n"
    )
    console.print(f"Scores saved to [bold]{run_dir / 'scores.json'}[/bold]")


def scaffold_human_ratings(
    run_dir: Path,
    results: list[RunResult],
    criteria: Sequence[EvalCriterion],
) -> None:
    """Create a human_ratings/ directory with a template JSON for manual scoring.

    The template uses the same EvalScore schema so human and LLM scores can
    be compared directly.
    """
    hr_dir = run_dir / "human_ratings"
    hr_dir.mkdir(exist_ok=True)

    template: list[dict] = []
    for result in results:
        for criterion in criteria:
            template.append(
                EvalScore(
                    run_result_id=result.id,
                    criterion_id=criterion.id,
                    score=0,
                    rationale="",
                    judge_model="human",
                    source="human",
                ).to_dict()
            )

    (hr_dir / "template.json").write_text(
        json.dumps(template, indent=2, ensure_ascii=False) + "\n"
    )
    console.print(
        f"Human rating template saved to [bold]{hr_dir / 'template.json'}[/bold] "
        f"({len(template)} entries to fill in)"
    )
