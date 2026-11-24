# SayMyName.in — Phase 2 Database Migration, Data Preservation & Rollback Plan

**Governance:** Document 05 (§17), Document 06 (§3–5), Document 08, `saymyname-database-change` skill, `docs/decisions/ADR-016..020`  
**Environment Policy (`D-P2-05`):** Execute baseline + Phase 2 migrations on **isolated local Docker PostgreSQL (`saymyname_dev`)** first. Never write synthetic test accounts to shared remote Supabase. Production/shared migration requires explicit separate human approval.

---

## 1. Existing Data Audit (Read-Only Non-PII Summary, Remote Supabase `2026-11-24`)

Executed via read-only count/status projection (zero rows inserted, updated, or deleted; zero PII printed):

| Metric | Observed Value | Preservation / Remediation Assessment |
|---|---|---|
| Total `identity.accounts` | **26** | All 26 retained intact during audit (0 deleted) |
| Email domain classification | **26 / 26** `@*.study.iitm.ac.in` | 0 campus/external accounts found (`D-P2-03` safe) |
| `accountStatus = 'active'` (`discoveryEligible = true`) | **16** | All 16 have `verifiedBy = 'automated_rules_engine'` and **0** `VerificationCase` rows |
| `accountStatus = 'pending_verification'` | **10** | 9 have `ageStatus = 'rejected'` yet still received `studentStatus = 'approved'`; 1 has `not_started` / `not_started` |
| Published profiles (`is_published = true`) | **5** | Existing profiles preserved as-is until operator approves staging/production remediation |

### Safe Non-Destructive Shared-DB Remediation Option (Requires Separate Human Sign-Off Before Running on Shared/Prod)
When/if promoted beyond local dev:
- Never `DELETE` accounts indiscriminately.
- For the 16 accounts marked `verifiedBy = 'automated_rules_engine'` without a `VerificationCase`: transition `account_eligibility.discovery_eligible = false`, `age_status = 'pending'`, `student_status = 'pending'`, `accounts.account_status = 'pending_verification'`, preserving all profile/match records while requiring genuine verification review before live access.
- For the 9 `age_status = 'rejected'` rows with stale `student_status = 'approved'`: reset `student_status = 'not_started'` and `verified_by = NULL` to maintain invariant consistency.

---

## 2. Migration Sequence & Inventory

Because `packages/database/prisma/` previously had **zero migration history**, Phase 2 initializes clean versioned Prisma migrations cleanly:

### Step A — Migration `00000000000000_baseline` (Phase 1 Snapshot)
- **Purpose:** Captures the existing 7-schema baseline (`identity`, `profiles`, `dating`, `messaging`, `together`, `safety`, `platform`) matching existing database state cleanly so `prisma migrate status` tracks forward changes accurately without dropping/recreating tables.
- **On fresh local PostgreSQL (`saymyname_dev`):** Creates all schemas and baseline tables cleanly.
- **On existing database with tables already present:** Marked applied via `prisma migrate resolve --applied 00000000000000_baseline` **only after** verifying baseline diff parity.

### Step B — Migration `20261124000000_phase2_identity_auth_verification_profiles` (Additive Expand Only)
All changes are **strictly additive (`ADD COLUMN` / `CREATE TABLE` with safe defaults)** — zero column drops, zero table truncations:

1. **`identity.accounts`:**
   - `password_hash TEXT NULL` (allows legacy rows to exist cleanly; required for password login / new registrations; legacy accounts guided to password reset)
   - `email_verified_at TIMESTAMPTZ NULL` (backfilled conservatively to `created_at` only if `account_status != 'registered'`, otherwise `NULL`)
2. **`identity.otp_challenges` (new table):**
   - `id UUID PK`, `account_id UUID NULL FK -> identity.accounts(id) ON DELETE CASCADE`, `email TEXT NOT NULL`, `purpose TEXT NOT NULL DEFAULT 'email_verification'`, `code_hash TEXT NOT NULL`, `attempts INT NOT NULL DEFAULT 0`, `max_attempts INT NOT NULL DEFAULT 5`, `expires_at TIMESTAMPTZ NOT NULL`, `consumed_at TIMESTAMPTZ NULL`, `last_sent_at TIMESTAMPTZ NOT NULL DEFAULT now()`, `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
   - Indexes: `(email, purpose, created_at)`, `(expires_at)`
3. **`identity.password_reset_tokens` (new table):**
   - `id UUID PK`, `account_id UUID NOT NULL FK -> identity.accounts(id) ON DELETE CASCADE`, `token_hash TEXT UNIQUE NOT NULL`, `expires_at TIMESTAMPTZ NOT NULL`, `consumed_at TIMESTAMPTZ NULL`, `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
   - Index: `(account_id, expires_at)`
4. **`identity.account_eligibility`:**
   - `pathway_code TEXT NULL` (`foundation`, `diploma`, `degree`)
   - `age_verified_at TIMESTAMPTZ NULL`
   - `student_verified_at TIMESTAMPTZ NULL`
   - `valid_until TIMESTAMPTZ NULL`
5. **`identity.verification_cases`:**
   - `check_type TEXT NOT NULL DEFAULT 'student_enrolment'` (`age` | `student_enrolment`)
   - `provider_code TEXT NOT NULL DEFAULT 'manual_review'`
   - `provider_reference TEXT NULL`
   - `reason_code TEXT NULL`
   - `decided_at TIMESTAMPTZ NULL`
   - `reviewer_principal_id TEXT NULL`
   - Indexes: `(account_id, created_at)`, partial unique `(provider_code, provider_reference)` where `provider_reference IS NOT NULL`
6. **`identity.verification_evidence_refs`:**
   - `sha256 TEXT NULL`
   - `uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()`
   - `retention_until TIMESTAMPTZ NULL`
   - `deleted_at TIMESTAMPTZ NULL`
7. **`identity.app_sessions`:**
   - `token_family_id UUID NULL`
   - `rotated_from_session_id UUID NULL`
   - `last_seen_at TIMESTAMPTZ NULL`
   - Indexes: `(account_id, revoked_at, expires_at)`, `(token_family_id)`
8. **`profiles.profiles` & `profiles.profile_photos`:**
   - `profiles.profiles`: `profile_status TEXT NOT NULL DEFAULT 'draft'`, `age_display_mode TEXT NOT NULL DEFAULT 'show_calculated_age'`, `published_at TIMESTAMPTZ NULL`, `consent_accepted_at TIMESTAMPTZ NULL`. Non-destructive backfill sets existing `is_published = true` & `is_paused = false` to `'live'` and `is_paused = true` to `'paused'`.
   - `profiles.profile_photos`: relax `photo_url` to nullable (`DROP NOT NULL`) so R2-only private keys never require a dummy public URL; add `mime_type TEXT NULL`, `width_px INTEGER NULL`, `height_px INTEGER NULL`, `deleted_at TIMESTAMPTZ NULL`.

---

## 3. Verification Procedure (Isolated Local DB)

1. Start local PostgreSQL & Redis (`docker compose up -d postgres redis`).
2. Apply baseline + Phase 2 migration cleanly to fresh `saymyname_dev`.
3. Insert synthetic legacy test fixture rows mimicking pre-Phase-2 state (`password_hash IS NULL`, existing `is_published = true` profile, rejected-age row) -> verify backfill & constraint integrity without data loss.
4. Regenerate Prisma client (`npm run build --prefix packages/database`) and run typechecks + API unit/integration tests against local `saymyname_dev`.
5. Test rollback script cleanly on a disposable verification schema/database clone, confirming zero orphaned dependencies when reverting `20261124000000`.

---

## 4. Explicit SQL Rollback Plan (For `20261124000000_phase2_identity_auth_verification_profiles`)

> [!CAUTION]
> Because additive columns/tables store new Phase 2 credentials (`password_hash`, `otp_challenges`, `password_reset_tokens`), rolling back discards Phase 2 credential columns/tables cleanly while leaving Phase 1 `identity.accounts`, `account_eligibility`, `app_sessions`, and `profiles.profiles` data intact. Take a `pg_dump` snapshot before running rollback outside disposable local tests.

```sql
BEGIN;

ALTER TABLE profiles.profile_photos
  DROP COLUMN IF EXISTS deleted_at,
  DROP COLUMN IF EXISTS height_px,
  DROP COLUMN IF EXISTS width_px,
  DROP COLUMN IF EXISTS mime_type;

ALTER TABLE profiles.profiles
  DROP COLUMN IF EXISTS consent_accepted_at,
  DROP COLUMN IF EXISTS published_at,
  DROP COLUMN IF EXISTS age_display_mode,
  DROP COLUMN IF EXISTS profile_status;

DROP INDEX IF EXISTS identity.app_sessions_token_family_id_idx;
DROP INDEX IF EXISTS identity.app_sessions_account_id_revoked_at_expires_at_idx;
ALTER TABLE identity.app_sessions
  DROP COLUMN IF EXISTS last_seen_at,
  DROP COLUMN IF EXISTS rotated_from_session_id,
  DROP COLUMN IF EXISTS token_family_id;

ALTER TABLE identity.verification_evidence_refs
  DROP COLUMN IF EXISTS deleted_at,
  DROP COLUMN IF EXISTS retention_until,
  DROP COLUMN IF EXISTS uploaded_at,
  DROP COLUMN IF EXISTS sha256;

DROP INDEX IF EXISTS identity.verification_cases_provider_ref_uq;
DROP INDEX IF EXISTS identity.verification_cases_account_id_created_at_idx;
ALTER TABLE identity.verification_cases
  DROP COLUMN IF EXISTS reviewer_principal_id,
  DROP COLUMN IF EXISTS decided_at,
  DROP COLUMN IF EXISTS reason_code,
  DROP COLUMN IF EXISTS provider_reference,
  DROP COLUMN IF EXISTS provider_code,
  DROP COLUMN IF EXISTS check_type;

ALTER TABLE identity.account_eligibility
  DROP COLUMN IF EXISTS valid_until,
  DROP COLUMN IF EXISTS student_verified_at,
  DROP COLUMN IF EXISTS age_verified_at,
  DROP COLUMN IF EXISTS pathway_code;

DROP TABLE IF EXISTS identity.password_reset_tokens;
DROP TABLE IF EXISTS identity.otp_challenges;

ALTER TABLE identity.accounts
  DROP COLUMN IF EXISTS email_verified_at,
  DROP COLUMN IF EXISTS password_hash;

COMMIT;
```

---

## 5. Non-Destructive Shared Supabase Remediation Preview & Environment Blocker (26 Accounts)

### 5.1 Staging vs Production Environment Identification Status (BLOCKER)
- Repository metadata and tracked documentation contain **no mapping distinguishing Staging vs Production Supabase project refs**.
- Prior local `.env.local` referenced a single remote Supabase transaction pooler (`aws-0-ap-southeast-1.pooler.supabase.com`), and Render service `saymyname-ri9e.onrender.com` (`srv-dc2ogom8bjmc738ai63g`) currently deploys branch `master` (`761ef79`) with a hidden `DATABASE_URL` secret while Vercel/Cloudflare serves `saymyname.in`.
- **Required Human Approval Before Any Remote Execution:** Confirm exact Supabase project ref for Staging separately from Production, confirm branch alignment (`main` vs `master`), and authorise Phase 2 migration + remediation on Staging first. **Zero remote rows were modified during this audit or preview.**

### 5.2 SQL-Verified Before & After Aggregate Consequences (Zero PII, Zero Deletions)
Executed via `node scripts/test-remediation-preview.mjs` against a disposable local PostgreSQL mirror (`saymyname_remediation_preview`) seeded identically to the non-PII 26-account Supabase snapshot (`16` auto-approved active accounts including `5` published profiles; `9` rejected-age accounts with stale `student_status = 'approved'`; `1` unstarted account):

| Aggregate Metric | Before Remediation | After Remediation | After Rollback | Operational Impact |
|---|---|---|---|---|
| Total `identity.accounts` | **26** | **26** (0 deleted) | **26** | All 26 accounts & credentials preserved |
| `accounts.account_status = 'active'` | **16** | **0** | **16** | All 16 auto-approved accounts require human verification review before live access |
| `accounts.account_status = 'pending_verification'` | **10** | **26** | **10** | Existing 10 remain pending; 16 auto-approved moved safely to pending |
| `eligibility.discovery_eligible = true` | **16** | **0** | **16** | `EligibilityGuard` blocks Discover/chat/calls until approved |
| `eligibility.age_status` (`approved` / `pending` / `rejected` / `not_started`) | `16 / 0 / 9 / 1` | **`0 / 16 / 9 / 1`** | `16 / 0 / 9 / 1` | 16 enter pending age review; 9 minors stay strictly `rejected`; 1 stays `not_started` |
| `eligibility.student_status` (`approved` / `pending` / `not_started`) | `25 / 0 / 1` | **`0 / 16 / 10`** | `25 / 0 / 1` | Contradictory `student_status = 'approved'` cleared on all 9 rejected-age rows |
| `eligibility.verified_by = 'automated_rules_engine'` | **25** | **0** | **25** | Eliminates all non-compliant legacy auto-approvals |
| `identity.verification_cases` (`pending`) | **0** | **32** (`16` age + `16` student) | **0** | Every remediated active account immediately enters the operable manual reviewer queue |
| `profiles.profiles` total rows | **5** | **5** (0 deleted) | **5** | All 5 profile bios, programme tracks, interests & media preserved intact |
| `profiles.profiles` (`is_published = true` / `profile_status = 'live'`) | **5 / 5** | **`0 / 0`** (`5 paused`) | **5 / 5** | All 5 published profiles pause cleanly (`profile_status = 'paused'`) so pending accounts never appear in Discover |

> [!NOTE]
> Legacy accounts have `password_hash IS NULL` until the member completes `/forgot-password` -> `/reset-password` or re-registers password credentials cleanly. If active JWT sessions exist on the 16 auto-approved accounts during rollout, optional session invalidation (`UPDATE identity.app_sessions SET revoked_at = now() WHERE revoked_at IS NULL`) can be appended inside the same transaction so Next.js cookies refresh immediately.

### 5.3 Approved Non-Destructive Remediation & Rollback SQL
```sql
BEGIN;

CREATE SCHEMA IF NOT EXISTS _remediation_backup;
CREATE TABLE _remediation_backup.accounts_snapshot AS
  SELECT id, account_status FROM identity.accounts;
CREATE TABLE _remediation_backup.eligibility_snapshot AS
  SELECT account_id, age_status, student_status, discovery_eligible,
         age_verified_at, student_verified_at, verified_by, verified_at
  FROM identity.account_eligibility;
CREATE TABLE _remediation_backup.profiles_snapshot AS
  SELECT id, is_published, profile_status FROM profiles.profiles;

-- 1. Move 16 automated_rules_engine active accounts to manual review
UPDATE identity.account_eligibility ae
SET age_status = 'pending',
    student_status = 'pending',
    discovery_eligible = false,
    age_verified_at = NULL,
    student_verified_at = NULL,
    verified_by = NULL,
    verified_at = NULL,
    updated_at = now()
WHERE ae.verified_by = 'automated_rules_engine'
  AND ae.age_status = 'approved'
  AND ae.student_status = 'approved'
  AND NOT EXISTS (
    SELECT 1 FROM identity.verification_cases vc
    WHERE vc.account_id = ae.account_id AND vc.status = 'approved'
  );

UPDATE identity.accounts a
SET account_status = 'pending_verification', updated_at = now()
FROM identity.account_eligibility ae
WHERE ae.account_id = a.id
  AND a.account_status = 'active'
  AND ae.discovery_eligible = false;

-- 2. Pause the 5 published profiles without deleting content
UPDATE profiles.profiles p
SET is_published = false, profile_status = 'paused', updated_at = now()
FROM identity.account_eligibility ae
WHERE ae.account_id = p.account_id
  AND ae.discovery_eligible = false
  AND p.is_published = true;

-- 3. Clear contradictory student_status='approved' on the 9 rejected-age rows
UPDATE identity.account_eligibility ae
SET student_status = 'not_started',
    student_verified_at = NULL,
    verified_by = NULL,
    verified_at = NULL,
    discovery_eligible = false,
    updated_at = now()
WHERE ae.age_status = 'rejected'
  AND (ae.student_status = 'approved' OR ae.verified_by = 'automated_rules_engine');

-- 4. Enqueue pending manual_review cases (16 age + 16 student = 32 cases)
INSERT INTO identity.verification_cases
  (id, account_id, check_type, provider_code, status, reason_code, submitted_at, created_at)
SELECT gen_random_uuid(), ae.account_id, t.check_type, 'manual_review', 'pending',
       'phase2_legacy_remediation', now(), now()
FROM identity.account_eligibility ae
CROSS JOIN (VALUES ('age'), ('student_enrolment')) AS t(check_type)
WHERE ae.age_status = 'pending'
  AND ae.student_status = 'pending'
  AND NOT EXISTS (
    SELECT 1 FROM identity.verification_cases vc
    WHERE vc.account_id = ae.account_id
      AND vc.check_type = t.check_type
      AND vc.status IN ('pending', 'approved')
  );

COMMIT;
```
**Reversible Rollback (`_remediation_backup`):** restores exact pre-remediation `accounts.account_status`, `account_eligibility.*`, and `profiles.is_published`/`profile_status`, and deletes only `reason_code = 'phase2_legacy_remediation'` cases.

