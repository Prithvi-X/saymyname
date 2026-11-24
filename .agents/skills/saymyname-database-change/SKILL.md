---
name: saymyname-database-change
description: Plans and implements SayMyName PostgreSQL schema, data migration, API contract and event changes with compatibility, privacy and recovery checks. Use for database or persistent data changes.
---

# SayMyName Database and Contract Change

## Mandatory inputs

Read Documents 05 and 06, relevant Document 04 feature behaviour, Document 07 tests and current ADRs. Check current migration history and production compatibility policy without accessing production data.

## Procedure

1. Define the data/API contract change and owning domain module.
2. Check constraints, foreign keys, unique invariants, indexes, object ownership, retention and deletion behaviour.
3. Identify affected clients, workers, WebSocket events, notifications, analytics and integrations.
4. Use `/plan` and obtain Engineering + QA review. Escalate sensitive-data/retention/encryption questions to Privacy/Security/Legal.
5. Prefer additive expand-and-contract migrations for incompatible changes.
6. Make the migration idempotent where applicable; define backfill, batches, locks, timeouts and observability.
7. Never hold a database transaction open while awaiting an external provider or network delivery.
8. Test migration on isolated synthetic data and supported previous/new application versions.
9. Verify rollback or documented forward-fix. Do not run destructive reset/drop against shared or production systems.
10. Update OpenAPI/event schemas, generated types, data dictionary, traceability and ADRs.

## Output

Report migration ID, schema objects affected, compatibility window, test fixtures, migration test results, rollback/forward-fix, consumer impact, unresolved risks and approvals. Production migration requires a separate human-controlled release action.
