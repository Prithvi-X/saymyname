# SayMyName.in — Project Decision Register

**Governing Authority:** Document 01 (Product Constitution), Document 04 (§14 Open Decision Register), Document 05 (§17 ADRs), Document 08 (§15.4 Decision Register Fields), Document 09 (§9.2 Approval Boundaries)  
**Last Updated:** 2026-11-24  
**Scope:** Phase 1 Constitutional Baseline + Phase 2 Public Experience, Authentication, Verification & Member Onboarding

---

## 1. Frozen Product Constitution Decisions (Document 01 Reference)

| Decision ID | Question / Principle | Approved Decision | Approver | Date | Affected Docs & Tasks |
|---|---|---|---|---|---|
| `D-01` | Eligible institutional scope | Phase 1 is IIT Madras non-campus BS programmes only (Data Science & Applications; Electronic Systems; Aeronautics & Space Technology; Management & Data Science). | Product Constitution | 2026-11-23 | Doc 01, `ELG-*` |
| `D-02` | Minimum age rule | Member must be at least 18 years old (independent of IITM admissions policy). | Product Constitution | 2026-11-23 | Doc 01, `AGE-*` |
| `D-03` | Product positioning | Platform is dating-first; no generic social network repositioning. | Product Constitution | 2026-11-23 | Doc 01, Doc 03 |
| `D-04` | Relationship support | Relationship Mode is opt-in, mutual (two independent actions), and unilaterally exitable. | Product Constitution | 2026-11-23 | Doc 01, `REL-*` |
| `D-05` | Platform architecture | Build web, Android and iOS on one shared modular-monolith backend. | Product Constitution | 2026-11-23 | Doc 05, `ADR-01..03` |
| `D-06..D-10` | Safety, scope & legal gates | No public feed, random roulette, stranger DMs, exact GPS, or default call recording; public launch requires legal review. | Product Constitution | 2026-11-23 | Doc 01, `SAF-*` |

---

## 2. Phase 2 Approved Decisions (Document 08 §15.4 Format)

### `D-P2-00` — Immediate Pre-Phase-2 Security Hotfix & Existing Account Audit
- **Question:** How should we remediate the unconditional `'123456'` OTP backdoor, self-declared age/student auto-approval in production, and existing accounts created under the prior flow before continuing with broader Phase 2 UI?
- **Options Considered:**
  1. Fix OTP bypass & auto-approval immediately as the first code change after planning; run a read-only non-PII classification of existing Supabase accounts without deleting rows indiscriminately; isolate local tests onto local PostgreSQL/Redis.
  2. Defer security fixes until Phase 2.5–2.8 UI work.
- **Approved Decision:** **Option 1 (Immediate Security Priority)** — Fix unconditional `'123456'` OTP bypass and disable self-declared production age/student auto-approval before broader Phase 2 UI changes; review potentially affected accounts without deleting records indiscriminately; run local database migration baseline first.
- **Approver:** Human Project Owner
- **Rationale:** Leaving an unconditional `'123456'` OTP bypass or self-declared active account escalation exposed violates default-deny security invariants (`AGENTS.md`, Doc 01 §3.5). Existing records must be preserved and inspected carefully rather than wiped.
- **Date:** 2026-11-24
- **Last Responsible Moment:** Prior to any Phase 2.1–2.9 feature edits or deployment.
- **Affected Docs & Tasks:** `docs/decisions/ADR-017`, `docs/decisions/ADR-018`, `docs/implementation/PHASE2_MIGRATION_AND_ROLLBACK_PLAN.md`, `P2-SEC-01`, `P2-SEC-02`, `P2-AUDIT-01`
- **Read-Only Existing Account Audit Summary (2026-11-24, Zero Mutations, Zero PII):**
  - Total accounts inspected in configured Supabase DB: **26** (`100%` on `@*.study.iitm.ac.in` domains; `0` campus `@iitm.ac.in` or external domains).
  - Active discovery-eligible accounts without any `VerificationCase` record: **16** (all `verifiedBy = 'automated_rules_engine'`; `5` with `isPublished = true`).
  - Pending verification accounts: **10** (`9` with `ageStatus = 'rejected'` from under-18 tests that still had `studentStatus = 'approved'`; `1` with `ageStatus = 'not_started'`, `studentStatus = 'not_started'`).
  - Preservation rule: **Zero records deleted or altered**; production/shared quarantine or re-verification requires explicit follow-up approval against `PHASE2_MIGRATION_AND_ROLLBACK_PLAN.md`.

---

### `D-P2-01` — Age and Student Verification Authority (`D04-01`, `D04-02`)
- **Question:** How should 18+ age verification and active IIT Madras non-campus BS enrolment be structured across adapters, evidence storage, and approval gates?
- **Options Considered:**
  - *Option A:* Separate `AgeVerificationAdapter` and `StudentEnrolmentAdapter` boundaries; account remains `pending_verification` / `in_review` until genuine verification is completed and an authorised reviewer or approved provider confirms eligibility; zero automatic verification in `NODE_ENV=production`; no government ID document collection.
  - *Option B:* Keep instant self-declared approval with an audit row only.
- **Approved Decision:** **APPROVED — Option A (Strict Conditions)**
  - Implement separate `AgeVerificationAdapter` and `StudentEnrolmentAdapter` boundaries (`services/api/src/modules/verification/`).
  - Keep accounts `pending_verification` / `in_review` until genuine verification is completed and an authorised reviewer or approved provider confirms eligibility.
  - **No automatic verification in production.** Do not treat self-declared DOB as verified age.
  - Minimise collection of sensitive information. **Do NOT collect government ID documents** (no Aadhaar, PAN, Passport, or government ID file uploads) until the verification method and lawful data-handling requirements are separately approved.
  - Any verification evidence stored in R2 must be private, access-controlled, auditable (`sha256`, `VerificationEvidenceRef`), and subject to an approved retention and deletion policy (`retention_until`).
- **Approver:** Human Project Owner
- **Rationale:** Aligns with Document 01 §3.1/§3.5, Document 05 §9.2, and Indian DPDP data minimization obligations. Prevents collecting high-risk government IDs without lawful governance.
- **Date:** 2026-11-24
- **Last Responsible Moment:** Before `POST /identity/age-check` or `POST /identity/verify-student` modifications (`Phase 2.0 / 2.7 / 2.8`).
- **Affected Docs & Tasks:** `ADR-017`, Doc 04 (`D04-01`, `D04-02`), Doc 06 (`§5.2–5.4`), `P2-VER-01..06`

---

### `D-P2-02` — Authentication, Password Policy, Email OTP & Browser Session Architecture (`D04-04`)
- **Question:** Which authentication methods, OTP constraints, and web session mechanism are approved for Phase 2?
- **Options Considered:**
  1. Email + password credential login, persistent hashed Email OTP for verification, Forgot/Reset Password, Next.js BFF `HttpOnly` cookie session with CSRF protection and rotation/revocation, zero `localStorage` tokens, and immediate removal of `'123456'` OTP fallback in production.
  2. Passwordless OTP login alongside password login, or keeping client `localStorage` JWTs.
- **Approved Decision:** **APPROVED — Option 1**
  - Implement PBKDF2/Argon2/scrypt password hashing (`password_hash`), persistent hashed `otp_challenges` (expiry, attempt limits, resend cooldown, single-use consumption), and `password_reset_tokens` / recovery flow.
  - Disable the `'123456'` OTP fallback in `production` immediately (`NODE_ENV === 'production'` never accepts static OTPs).
  - Implement Next.js BFF (`/api/auth/*`) with `HttpOnly; SameSite=Lax; Path=/` (and `Secure` in HTTPS/production) cookies, CSRF protection on cookie-authenticated browser mutations, session rotation, and session revocation (`revoke-others`, `logout`).
  - **Never store authentication tokens in `localStorage`.**
  - **Keep password login and email OTP verification. Do NOT introduce passwordless OTP login as an additional feature without separate approval.** Legacy accounts lacking `password_hash` must set a password via the password-reset / recovery path rather than passwordless OTP sign-in.
- **Approver:** Human Project Owner
- **Rationale:** Enforces Document 05 §6.2 / §17 (`ADR-09`) browser security rules, eliminates credential bypasses, and avoids unapproved auth surface expansion.
- **Date:** 2026-11-24
- **Last Responsible Moment:** Before `Phase 2.5`, `2.6`, `2.10`.
- **Affected Docs & Tasks:** `ADR-018`, Doc 04 (`D04-04`, `AUTH-01..25`), Doc 05 (`§6.2`), `P2-AUTH-01..09`

---

### `D-P2-03` — Institutional Email Allowlist Refinement
- **Question:** Which email domains should be accepted during registration, and how must domain boundaries be enforced?
- **Options Considered:**
  1. Central strict allowlist restricted strictly to officially approved non-campus BS study domains with proper hostname boundary parsing; reject general `@iitm.ac.in` campus/faculty domains; domain match never grants student verification.
  2. Permissive `.iitm.ac.in` / `@iitm.ac.in` suffix matching.
- **Approved Decision:** **APPROVED WITH REFINEMENT — Option 1**
  - Maintain one central allowlist in `@saymyname/validation` (consumed by both API and Web) covering officially approved non-campus IITM BS study domains (`study.iitm.ac.in`, `ds.study.iitm.ac.in`, `es.study.iitm.ac.in`, and explicitly approved BS track subdomains under `study.iitm.ac.in`).
  - Reject `@iitm.ac.in`, `@smail.iitm.ac.in`, and arbitrary campus/faculty subdomains as non-eligible domains.
  - Validate exact local-part + `@` + exact domain boundary (preventing partial-string attacks such as `user@evilstudy.iitm.ac.in` or multiple `@` symbols).
  - Explicitly enforce and communicate that email-domain validation **never independently grants student verification**.
- **Approver:** Human Project Owner
- **Rationale:** Preserves Document 01 §3.1 Phase 1 boundary (non-campus BS cohort only) while closing suffix-matching vulnerabilities.
- **Date:** 2026-11-24
- **Last Responsible Moment:** Before `Phase 2.0` / `2.3` / `2.5`.
- **Affected Docs & Tasks:** `ADR-019`, `packages/validation`, `services/api/src/modules/identity/`, `services/api/test/identity.test.ts`

---

### `D-P2-04` — Profile Onboarding Gate & Private Portrait Media (`D04-05`)
- **Question:** What are the completeness and photo requirements to publish a member profile into Discover, and how are portrait photos stored and served?
- **Options Considered:**
  1. Profiles remain `draft` (`isPublished = false`) until guided onboarding completes; **at least one genuine portrait photograph is required to publish into Discover**; photo upload remains **optional during registration and verification** so incomplete drafts can be saved; private R2 storage + short-lived signed GET URLs; remove raw URL input and all Unsplash/demo portrait fallbacks.
  2. Photo optional at publish time (monogram allowed in Discover).
- **Approved Decision:** **APPROVED — Option 1**
  - Default `Profile.profileStatus = 'draft'` (`isPublished = false`).
  - **At least one genuine portrait photo is required** inside `ProfilePhoto` (`Object` stored in private R2) before `POST /profiles/me/publish` transitions a profile to `live` in Discover.
  - Photo upload remains optional during account creation, email OTP verification, eligibility verification, and draft saving.
  - Serve portraits exclusively via private R2 presigned uploads and authorised, short-lived presigned GET URLs (`GET /profiles/me/photos/:id/url`, signed candidate views); remove raw URL inputs and all `unsplash.com` / demo portrait fallbacks from both frontend and backend.
- **Approver:** Human Project Owner
- **Rationale:** Ensures authentic dating profiles in Discover while preventing orphan external URLs, third-party tracking, and broken `media.saymyname.in` links.
- **Date:** 2026-11-24
- **Last Responsible Moment:** Before `Phase 2.9` (`Onboarding` & `ProfilesService`).
- **Affected Docs & Tasks:** `ADR-020`, Doc 04 (`D04-05`), Doc 05 (`§8.4`), Doc 06 (`§5.6–5.7`), `P2-ONB-01..06`

---

### `D-P2-05` — Database Isolation, Public Legal Disclosures & Support Configuration
- **Question:** Which database/cache infrastructure is used for local dev and tests, and how should unconfirmed legal entity / support email fields appear publicly?
- **Options Considered:**
  1. Strictly isolate local development, migrations, and automated tests to local Docker PostgreSQL + Redis (`docker-compose.yml`); write zero synthetic test data to shared remote Supabase; track legal entity/address as internal pending items without publishing bracketed placeholders or invented entities; configure support email strictly via environment variables (`SUPPORT_EMAIL` / `NEXT_PUBLIC_SUPPORT_EMAIL`) and omit unconfigured mailboxes publicly.
  2. Test directly against remote Supabase or display `[Pending Legal Review]` / `support@saymyname.in` strings in public UI.
- **Approved Decision:** **APPROVED WITH CONDITIONS — Option 1**
  - Local development, migrations, and automated tests MUST run exclusively against isolated local PostgreSQL (`saymyname_dev`) and Redis (`localhost:6379`). Never write synthetic test accounts or test runs to remote Supabase.
  - Keep unconfirmed operating entity name and registered physical address in internal governance records (`docs/`) until legal review completes. **Never publish bracketed placeholders** (such as `[Pending Legal Review]`) or invented legal facts on `/privacy`, `/terms`, `/support`, or `/`.
  - **Do not invent or publish a support email address until a monitored mailbox is configured.** Support contact email is read dynamically from `SUPPORT_EMAIL` / `NEXT_PUBLIC_SUPPORT_EMAIL` environment configuration; when unset, public pages state clearly that formal support intake / grievance channel configuration is being finalised without inventing an email address.
  - **No production deployment** without separate explicit human approval.
- **Approver:** Human Project Owner
- **Rationale:** Protects shared/staging databases from synthetic test contamination, avoids misleading unmonitored contact addresses, and maintains clean public UX copy per `Document 10` editorial standards.
- **Date:** 2026-11-24
- **Last Responsible Moment:** Before local migration execution and Phase 2.1–2.4 public page edits.
- **Affected Docs & Tasks:** `ADR-016`, `PHASE2_MIGRATION_AND_ROLLBACK_PLAN.md`, `.env.local` (local dev isolation), `apps/web/app/(public|privacy|terms|support)`
