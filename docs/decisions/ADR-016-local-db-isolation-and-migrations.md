# ADR-016: Isolated Local Database & Additive Prisma Migration Baseline

- **Status:** Accepted
- **Date:** 2026-11-24
- **Decision owner:** Engineering Lead / Human Project Owner (`D-P2-05`)
- **Reviewers:** Application Security, Backend/Database Engineering
- **Related tasks / documents:** Document 05 (§17 `ADR-04`, `ADR-05`), Document 06 (§3–5), Document 08 (§9), `docs/decisions/DECISION_REGISTER.md`, `docs/implementation/PHASE2_MIGRATION_AND_ROLLBACK_PLAN.md`

## Context
Previously, `packages/database/prisma/` had no committed `migrations/` directory (schema changes had only been synced directly), while `.env.local` and `services/api/.env.local` pointed `DATABASE_URL` directly to a shared remote Supabase pooler. As a result, automated scripts created 26 test/synthetic accounts on the remote Supabase database.

## Decision drivers
- Protect shared remote Supabase databases from synthetic test accounts, test runs, and schema experimentation.
- Establish reproducible, auditable Prisma migrations with a documented rollback SQL plan per `saymyname-database-change` and Document 06.
- Preserve all existing accounts and schema compatibility while introducing Phase 2 fields (`password_hash`, `otp_challenges`, `password_reset_tokens`, `pathway_code`, `verification_cases` provider metadata, `profile_status`).

## Options considered
1. **Isolated Local Docker PostgreSQL + Redis + Additive Prisma Migrations:** Configure local workspace dev/test workflows to point exclusively to `docker-compose.yml` (`postgres:17-alpine`, `redis:7-alpine`) and manage all schema evolution via committed SQL migrations under `packages/database/prisma/migrations/` with matching rollback scripts.
2. **Continue pushing via `prisma db push` against shared remote Supabase:** Rejected due to contamination risk and lack of auditability/rollback history.

## Decision
Adopt Option 1 (`Accepted`).
- All local development, Prisma migration creation (`prisma migrate`), and automated test execution MUST run exclusively against isolated local PostgreSQL (`postgresql://saymyname_user:saymyname_password@localhost:5432/saymyname_dev`) and local Redis (`localhost:6379`).
- **Zero synthetic test data or automated test runs may target the remote Supabase instance.**
- Maintain `00000000000000_baseline` + `20261124000000_phase2_identity_auth_verification_profiles` additive migrations, ensuring zero destructive column/table drops and full reversibility via `PHASE2_MIGRATION_AND_ROLLBACK_PLAN.md`.
- Production or shared-database deployment remains locked pending separate explicit human approval.

## Consequences and trade-offs
- Local development requires Docker Desktop (or local PostgreSQL 17 + Redis 7) to be running; cannot silently hit remote staging DB when Docker is stopped.
- Staging/Supabase URL must never be left active in test scripts or default local `.env.local`.

## Security, privacy, safety and operations impact
Eliminates cross-environment PII/synthetic-data mixing and accidental destructive schema commands on shared environments.

## Migration / rollback / compatibility
See [PHASE2_MIGRATION_AND_ROLLBACK_PLAN.md](file:///i:/saymyname/docs/implementation/PHASE2_MIGRATION_AND_ROLLBACK_PLAN.md). All Phase 2 columns/tables are nullable or carry safe non-breaking defaults so existing rows remain valid without downtime.

## Evidence and review date
- Target Verification: Clean application of baseline + Phase 2 migration on `saymyname_dev`, synthetic row preservation check, and rollback verification script.
- Next review: Phase 2 Release Gate (`2.12`).
