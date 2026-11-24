---
trigger: model_decision
description: Apply when implementing, reviewing, testing or releasing any feature, API, database change, mobile behaviour, real-time flow or deployment.
---

# Testing and evidence rules

Read Document 07 and the relevant acceptance criteria before claiming completion.

- Discover actual repository scripts and CI workflows. Do not invent command names.
- Run relevant unit, integration, contract, E2E, security, accessibility and performance tests according to change risk.
- Test denied and failure paths, not only the happy path. Include duplicate/retry/offline/concurrency cases when relevant.
- Use synthetic data. Keep test logs and screenshots free of personal or private content.
- Report exact commands, environment/build identifier and PASS/FAIL/NOT RUN/BLOCKED status.
- Never change or remove a failing test merely to achieve a green result without an approved test/requirement change.
- Do not report a check as passed if it was skipped, mocked at the wrong layer or not executed.
