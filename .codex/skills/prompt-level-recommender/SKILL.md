---
name: prompt-level-recommender
description: |
  Create high-quality prompts and recommend the appropriate Codex level (`低`, `中`, `高`, `超高`) for the task.
  Use when the user asks things like "プロンプトを作って", "promptを作成して", "この依頼向けのプロンプトを作って",
  or requests prompt tuning plus a suggested Codex effort level.
---

# Prompt Level Recommender

Generate a prompt and always pair it with one recommended Codex level (`低`/`中`/`高`/`超高`).

## Workflow

1. Clarify objective and constraints.
- Ask up to 3 short questions if critical details are missing (audience, language, tone, length, tools, acceptance criteria).
- If the user wants speed, provide a draft immediately and state assumptions.

2. Draft the prompt.
- Make it copy-paste ready.
- Include role, task, inputs, constraints, and expected output format.
- Prefer explicit instructions and checklists over vague guidance.

3. Choose exactly one recommended level.
- `低`: Simple rewrites, translations, short summaries, light formatting.
- `中`: Multi-constraint writing, common coding tasks, moderate structure requirements.
- `高`: Non-trivial coding/design/debugging, strict output constraints, trade-off analysis.
- `超高`: High-stakes or deeply complex work (architecture decisions, security/privacy-sensitive logic, large refactors, mission-critical correctness).

4. Explain recommendation.
- Provide 1-3 concrete reasons tied to complexity, risk, and required depth.
- Mention uncertainty when assumptions are heavy.

## Output Template

Use this structure unless the user requests another format:

```markdown
## 作成プロンプト
<copy-paste prompt>

## Codex推奨レベル
<低 | 中 | 高 | 超高>

## 理由
- <reason 1>
- <reason 2>
- <optional reason 3>

## 前提（必要なときだけ）
- <assumption>
```

## Guardrails

- Always return both items: prompt and recommended level.
- Never return multiple levels as the final recommendation.
- Do not inflate level without concrete reasons.
- If user explicitly fixes a level, respect it and optionally suggest adjustments as a note.
