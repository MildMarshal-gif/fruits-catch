---
name: prompt-level-recommender
description: |
  Create high-quality prompts for general use.
  Recommend a Codex level (`低`, `中`, `高`, `超高`) only when the request is Codex-targeted.
  Use when the user asks things like "プロンプトを作って", "promptを作成して", "この依頼向けのプロンプトを作って",
  including both Codex and non-Codex use cases.
---

# Prompt Level Recommender

Generate a high-quality prompt for the user's request.
Add one recommended Codex level (`低`/`中`/`高`/`超高`) only when the request is Codex-targeted.

## Scope

- In scope:
  - General prompt creation requests.
  - Codex-targeted prompt creation requests.
- Out of scope:
  - Tasks that are not prompt creation.

## Workflow

1. Determine request type (`Route A` or `Route B`).
- `Route A: Codex-targeted`
  - Trigger when the user explicitly mentions Codex (e.g., "Codex", "コーデックス"), or
  - The context clearly indicates implementation work to be executed by Codex.
- `Route B: Non-Codex`
  - Any prompt creation request that does not match Route A.
- Default rule:
  - If ambiguous, use Route B.

2. Clarify objective and constraints.
- Ask up to 3 short questions only when critical details are missing.
- If the user wants speed, provide a draft immediately and state assumptions.
- Prefer constraints relevant to the target context.
  - Route A examples: target files, acceptance criteria, forbidden changes, validation commands.
  - Route B examples: audience, language, tone, format, output length.

3. Draft the prompt.
- Make it copy-paste ready.
- Include role, task, inputs, constraints, and expected output format.
- Prefer explicit instructions and checklists over vague guidance.

4. For Route A only: choose exactly one recommended level.
- `低`: Simple rewrites, translations, short summaries, light formatting.
- `中`: Multi-constraint writing, common coding tasks, moderate structure requirements.
- `高`: Non-trivial coding/design/debugging, strict output constraints, trade-off analysis.
- `超高`: High-stakes or deeply complex work (architecture decisions, security/privacy-sensitive logic, large refactors, mission-critical correctness).

5. For Route A only: explain recommendation.
- Provide 1-3 concrete reasons tied to complexity, risk, and required depth.
- Mention uncertainty when assumptions are heavy.

## Output Template

Use the matching structure unless the user requests another format.

### Route A: Codex-targeted

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

### Route B: Non-Codex

```markdown
## 作成プロンプト
<copy-paste prompt>
```

## Input/Output Examples

### Route A Examples (Codex-targeted)

- Input: `このバグ修正をCodexに依頼するプロンプト作って`
  - Output: `作成プロンプト` + `Codex推奨レベル` + `理由`
- Input: `CodexでReactリファクタを依頼する文面を作って`
  - Output: `作成プロンプト` + `Codex推奨レベル` + `理由`
- Input: `コーデックス向けに、テスト追加依頼のプロンプトを作って`
  - Output: `作成プロンプト` + `Codex推奨レベル` + `理由`

### Route B Examples (Non-Codex)

- Input: `画像生成のプロンプトを作って`
  - Output: `作成プロンプト` only
- Input: `LPコピー作成用のプロンプトを作って`
  - Output: `作成プロンプト` only
- Input: `この依頼向けのプロンプトを作って`
  - Output: `作成プロンプト` only

## Guardrails

- Always return `作成プロンプト`.
- Return `Codex推奨レベル` and `理由` only for Route A.
- For Route B, do not output any of the following:
  - `Codex推奨レベル`
  - Out-of-scope notifications
  - Codex paraphrase/switch suggestions
- Never return multiple levels as the final recommendation.
- Do not inflate level without concrete reasons.
- If user explicitly fixes a level in Route A, respect it and optionally suggest adjustments as a note.
