---
name: saymyname-repository-audit
description: Performs a read-only Phase 0 audit of the SayMyName repository, source specifications, toolchain, test commands, risks and implementation gaps. Use before the first implementation task or after a major repository change.
---

# SayMyName Repository Audit

## Safety

This skill is read-only. Do not create, edit, delete, move, install, provision, deploy or reset anything during the audit. Do not read production secrets or real user data.

## Procedure

1. Confirm workspace root and inspect Git branch/status. Preserve uncommitted work.
2. Read root instructions, `.agents/rules/`, relevant skills and `docs/product/SPECIFICATION_INDEX.md`.
3. Confirm Documents 01-09 versions/status. Read enough content to understand the relevant approved scope and decisions.
4. Map the repository tree, package managers, runtime versions, framework versions, apps, services, shared packages and infrastructure.
5. Inspect CI files and package scripts to discover real build/lint/typecheck/test commands. Do not execute destructive scripts.
6. Inspect environment templates and secret scanning configuration without opening secret values.
7. Map implemented components to product requirements and current implementation phases. Mark each fact observed, inferred or not known.
8. Identify architecture deviations, risky dependencies, missing tests, data/privacy concerns, unknown vendors and blocking decisions.
9. Create a suggested Phase 0 task list in the report only. Do not create tracker files unless separately requested and approved.

## Output

Return:
- repository summary and commit/branch state
- source document versions/status
- app/service/package map
- versions and discovered safe commands
- requirement-to-code gap map
- security/privacy findings
- open decisions and blockers with owners suggested
- recommended first two work cycles
- explicit statement: `No files were modified`
