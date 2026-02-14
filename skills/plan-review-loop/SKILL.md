---
name: plan-review-loop
description: |
  Use when the user asks for plan creation and wants iterative quality checks by repeating
  "plan drafting" and "plan review" until issues are resolved or the loop limit is hit.
  Trigger phrases (examples): "プランを作って", "計画を作って", "実装プラン作って", "ロードマップ作って",
  "タスク分解して", "WBS作って", "レビュー付きでプラン作成", "プラン作成してレビューして",
  "計画立てて", "段取り作って".
---

# Plan Review Loop

Build a high-quality plan by enforcing this loop:
1. Draft the plan.
2. Review the plan with severity-ranked findings.
3. Revise the plan.
4. Repeat until pass criteria are met.

## When to Apply

Use this skill when:
- The user asks for planning and expects review quality.
- The work includes multiple requirements, dependencies, or milestones.
- The user wants explicit findings before implementation.

## Output Artifacts

Create and update two files each iteration:
- `docs/<topic>-plan-vN.md`
- `docs/<topic>-plan-vN-review.md`

Use increasing versions (`v1`, `v2`, `v3`...).

## Loop Workflow (Max 3 Iterations)

### Step 1: Normalize Inputs

- Extract scope, constraints, requirements, and timeline.
- If input is ambiguous, state assumptions explicitly.
- Define acceptance criteria and DoD before WBS.

### Step 2: Draft Plan

Create `docs/<topic>-plan-vN.md` with:
- Goal and completion criteria.
- Milestones and sequence.
- WBS tasks with estimates and dependencies.
- Risks and mitigations.
- QA scenarios and pass/fail conditions.

### Step 3: Review Plan

Create `docs/<topic>-plan-vN-review.md` and list findings first.

Severity classes:
- `重大`: execution should not start.
- `中`: must be fixed before implementation.
- `軽微`: optional improvement.

Required checks:
- Requirement traceability is complete.
- Estimate math is consistent across sections.
- Dependencies are coherent and executable.
- DoD and QA are testable and concrete.
- Scope boundaries and assumptions are explicit.

### Step 4: Gate Decision

Pass condition:
- `重大 = 0` and `中 = 0`

If fail:
- Produce `vN+1` plan with fixes for findings.
- Re-run review on the updated plan.

Stop rules:
- Stop immediately when pass condition is met.
- Hard stop at 3 loops. If unresolved, output remaining risks and decisions required from the user.

## Response Contract

Always report in this order:
1. Final judgment (Pass / Needs another loop)
2. Findings summary (severity order)
3. What changed in this iteration
4. Next action

## Guardrails

- Do not start coding in this skill.
- Keep plan and review in separate files.
- Never hide unresolved issues.
- Prefer conservative estimates when uncertain.
