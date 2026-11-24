---
name: saymyname-release-gate
description: Evaluates SayMyName phase, alpha, beta or production release evidence against Documents 01, 07 and 08. Use when preparing a phase exit or release decision.
---

# SayMyName Release Gate Verification

## Safety

Read and evaluate evidence only. Do not deploy, change production flags, provision resources or make the final Go/No-Go decision.

## Procedure

1. Identify the exact phase/release scope, build ID, environment and named human gate owner.
2. Read applicable exit criteria in Document 08, product constraints in Document 01 and quality gates in Document 07.
3. Collect links to tasks, traceability, CI, test reports, security/privacy reviews, incidents, restore/rollback evidence and operational readiness.
4. Mark each criterion PASS, FAIL, NOT EVIDENCED or APPROVED EXCEPTION. Do not infer pass from task state or verbal statement.
5. Check P0/P1 defects, critical/high findings, eligibility/consent bypasses, report/block safety, data integrity, backup/restore, monitoring, moderation/support coverage and legal/store checks as applicable.
6. List blockers with owner, containment, next action and required retest.
7. Recommend GO, HOLD or REPLAN to the human gate owner. The agent cannot approve its own release.

## Output

Provide a criterion-by-criterion evidence matrix, open blockers, approved exceptions, residual risks, rollback readiness and a clear human decision request.
