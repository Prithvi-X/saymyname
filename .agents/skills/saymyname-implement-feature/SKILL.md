---
name: saymyname-implement-feature
description: Implements one approved SayMyName feature or bounded vertical slice across UI, API, data and tests while following Documents 01-09. Use for feature development after task readiness and plan approval.
---

# SayMyName Feature Implementation

## Preconditions

- Task has an ID, approved scope, owner, dependencies and observable acceptance criteria.
- Read the relevant sections of Documents 01-08 and current ADRs.
- Check Git status and preserve existing work.
- For non-trivial work, create `/plan` and wait for human review where required.

## Procedure

1. State the user/system outcome and traceability IDs.
2. Inspect existing patterns and identify the smallest vertical slice.
3. List UI, API, domain, database, event, notification and test impact.
4. Identify security, privacy, consent, abuse, accessibility and operational risks.
5. Confirm needed decisions. Do not invent a vendor, policy or product behaviour.
6. Implement only the approved plan. Keep controllers thin and module ownership explicit.
7. Add tests for success, denial, invalid input, duplicates/retries and relevant failure states.
8. Run the actual repository checks discovered in the audit. Do not assume script names.
9. Review the full diff for scope creep, secrets, logging leaks, generated-file drift and migration hazards.
10. Update traceability and affected documentation or ADRs.

## Output

Use the agent report template. List changed files, tests run with exact results, tests not run, remaining risks, decisions, rollback and recommended next state. Never report completion without acceptance evidence.
