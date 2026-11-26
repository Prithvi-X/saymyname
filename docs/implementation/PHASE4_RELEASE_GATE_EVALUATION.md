# SayMyName.in — Phase 4 Cumulative Release-Gate Evaluation (Web & API)

**Date:** 2026-11-27  
**Branch / Commit Scope:** `phase-4-2-together-experience` (evaluated at commit `940fa1f`, including Phase 4.1 on `phase-4-1-calling-safety` @ `0227c89`)  
**Target Environments:** Local Verification (PASSED) vs **Staging / Production Release Decision (HOLD — Human Gate Owner Required)**  
**Skill Applied:** `saymyname-release-gate` (read/evaluate evidence only; zero unauthorized production flags, provisioning, or self-approval)

---

## 1. Criterion-by-Criterion Evidence Matrix (Documents 01, 07, 08)

| Gate Area | Requirement / Invariant | Status | Direct Verified Evidence (2026-11-27) |
|---|---|---|---|
| **Build & Type Integrity** | Clean API TypeScript, Next.js BFF/App production bundle, and Web typecheck | **PASS** | `npx --workspace=@saymyname/api tsc --noEmit` (0 errors); `npm run --workspace=@saymyname/web build` (`31/31` routes) + `npx --workspace=@saymyname/web tsc --noEmit` (0 errors) |
| **Domain & Security Unit Suites** | Core eligibility (18+, 4 BS families), fail-closed production guards, profiles, dating, calling, eviction relay, together | **PASS** | `npm run --workspace=@saymyname/api test`: **`106/106 PASS`** across `14` suites; Web unit tests: **`21/21 PASS`** across `5` suites |
| **Database Migration Integrity** | Additive Prisma schema changes cleanly applied; zero destructive resets on dev DB | **PASS** | `npx --workspace=@saymyname/database prisma migrate status` (`saymyname_dev` @ `localhost:5433`): `9 migrations`, database schema up to date |
| **Messaging Reliability (Phase 3.5.1)** | Transactional outbox, `FOR UPDATE SKIP LOCKED`, Redis outage recovery, lease reclaim | **PASS** | `node scripts/test-phase3-5-1-outbox-e2e.mjs`: **`PASS`** (5 concurrent claims, Redis outage recovery, expired lease reclaim, unmatch suppression) |
| **Media Privacy & Streaming (Phase 3.5.2)** | Same-origin authenticated voice-note proxy, HTTP `200`/`206`/`416`, zero signed R2 URL exposure, mid-stream abort | **PASS** | `node scripts/test-phase3-5-2-media-e2e.mjs`: **`PASS`** (`11/11` auth checks, mid-stream revocation abort verified) |
| **Audio Calling & `MATCH-22` (Phase 4.1)** | Explicit call invite/accept, audio-only short-lived LiveKit tokens, SFU eviction on unmatch/block/suspension/verification revocation | **PASS (Local Docker SFU)** | `node scripts/test-phase4-1-livekit-e2e.mjs` (**`6/6`** scenarios PASS); `node scripts/test-phase4-1-browser-calling-e2e.mjs` (**PASS** across `1440..375`) |
| **Together Space & Profile Persistence (Phase 4.2)** | Mutual mini-games, virtual dates, dual-opt-in Relationship Mode, unilateral independent exit, zero surveillance, profile interest reload persistence | **PASS** | `node scripts/test-phase4-2-together-e2e.mjs` (**PASS** dual Edge E2E + `375px` 0 overflow) + visual PNG inspection (`01`..`05`) |
| **Secret & Brand Hygiene** | Zero `.env` secrets committed; approved brand components preserved | **PASS** | `git ls-files "*.env*"` returned only `.env.example`; `git diff phase-4-1-calling-safety..HEAD -- apps/web/components/brand` empty |
| **Staging Credentials & Live Smoke** | Resend, private Cloudflare R2, `REVIEWER_API_KEY`, Staging DB/origin confirmed | **NOT EVIDENCED** | `node scripts/smoke-staging-resend-r2.mjs` preflight shows `1/8` staging env vars set locally (`API_BASE` only); `7/8` remote secrets unset locally |
| **LiveKit Cloud Production Readiness** | Managed LiveKit Cloud project credentials, `room.auto_create: false` config, carrier-NAT TURN relay check | **NOT EVIDENCED** | Verified against local Docker LiveKit (`ws://127.0.0.1:7881`); LiveKit Cloud production test out of scope / awaiting credentials ([ADR-024](file:///i:/saymyname/docs/decisions/ADR-024-livekit-audio-calling-and-sfu-eviction.md)) |
| **Mobile App (`apps/mobile`) Parity** | Production-ready iOS/Android interactive calling, messaging, and Together UI | **NOT EVIDENCED** | Out of web+API Phase 4.1/4.2 scope (`apps/mobile` remains Expo scaffold) |
| **Pending Privacy/Retention Governance** | Legal/privacy approval for moderation holds, unmatch/block/deletion purge windows, media limits | **BLOCKED (Human Decision)** | `D-P35-01`, `D-P35-02`, and `D-P35-03` remain `NEEDS HUMAN DECISION` in [DECISION_REGISTER.md](file:///i:/saymyname/docs/decisions/DECISION_REGISTER.md) |

---

## 2. Open Blockers Before Production Launch

| Blocker ID | Owner | Containment Today | Next Required Action | Required Retest After Resolution |
|---|---|---|---|---|
| **BLK-01: Staging vs Production Infrastructure Mapping & Branch Alignment** | Project Owner / DevOps | Zero writes made to remote Supabase (`aws-0-ap-southeast-1`) or Render (`srv-dc2ogom8bjmc738ai63g`) | Confirm Staging Supabase ref vs Production Supabase ref (`STAGING_DEPLOYMENT_CHECKLIST.md` §0) and decide merge strategy from `phase-4-2-together-experience` -> `main` / `master` | Run `npx prisma migrate status` & `prisma migrate deploy` on isolated **Staging DB** first |
| **BLK-02: Legacy 26-Account Remediation Decision (`Phase 2` §5)** | Project Owner / T&S | Non-destructive SQL verified on local synthetic clone `saymyname_remediation_preview` | Approve executing §5 remediation SQL against Staging/Production before public discovery exposure | Re-run legacy account audit aggregate count query post-remediation |
| **BLK-03: Staging Secret Provisioning & Live Smoke** | Project Owner / Infra | Fail-closed checks block insecure boot in `NODE_ENV=production` | Set `JWT_ACCESS_SECRET` (matching Web & API), `JWT_REFRESH_SECRET`, `REVIEWER_API_KEY`, `RESEND_API_KEY`, `EMAIL_FROM`, private `R2_*` creds in Staging | Run `ALLOW_LIVE_STAGING_SMOKE=true ... node scripts/smoke-staging-resend-r2.mjs --confirm-live-quota` |
| **BLK-04: LiveKit Cloud + `room.auto_create: false`** | Infra / Engineering | Local Docker LiveKit enforces `room.auto_create: false` cleanly | Provision LiveKit Cloud project, enforce `room.auto_create: false`, configure TURN fallback | Verify live 2-device WebRTC call + mid-call `MATCH-22` eviction across mobile/cellular network |
| **BLK-05: Governance Sign-Off (`D-P35-01`..`03`)** | Legal / Product / T&S | Immediate `403` access block on unmatch/block/deletion already active; zero destructive auto-purge workers running | Sign off on `D-P35-01` (45s/60s voice note limit), `D-P35-02` (5 MB payload ceiling), `D-P35-03` (DPDP physical purge windows vs safety holds) | Only after sign-off: implement retention purge worker & test legal hold immunity |

---

## 3. Rollback Readiness & Residual Risks

- **Schema Rollback Safety:** Phase 4.1 (`20261126020000_phase4_1_call_sessions_safety`) and Phase 4.2 (`20261126030000_phase4_2_relationship_proposals`) are strictly **additive** (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`). Existing rows retain valid defaults, and application rollback to an earlier API build does not require dropping columns or restoring backups.
- **Transient E2E Timing Note:** During one intermediate local verification run immediately following another container teardown, `test-phase3-5-1-outbox-e2e.mjs` hit a test-harness Redis Pub/Sub subscriber reconnect timing race (`status: 'published'` in 593ms before the test harness subscriber re-subscribed); re-running `test-phase3-5-1-outbox-e2e.mjs` directly exited `0` (`PASS`) cleanly across all scenarios.

---

## 4. Gate Recommendation

- **Production Launch Recommendation:** **HOLD** until `BLK-01` through `BLK-05` are explicitly approved and Staging smoke/LiveKit Cloud checks pass.
- **Branch & Staging Promotion Recommendation:** **GO for Remote Feature-Branch Push (`phase-4-2-together-experience`) & Staging Preflight Setup** upon human go-ahead.
