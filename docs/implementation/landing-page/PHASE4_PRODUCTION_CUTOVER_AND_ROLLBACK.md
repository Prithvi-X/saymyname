# Phase 4: Production Cutover & Rollback Runbook

**Project:** SayMyName.in — The First Impression Project
**Target Workstream:** `apps/web` (`LANDING_PAGE_EDITORIAL_ENABLED`)
**Current Production Status:** **`UNCHANGED` (`LANDING_PAGE_EDITORIAL_ENABLED=false`)**
**Execution Authority:** **HUMAN RELEASE OPERATOR ONLY — DO NOT EXECUTE WITHOUT `DEC-LP-07` & `DEC-LP-08`**

---

## 1. Build-Time Compilation Architecture (Critical Deployment Fact)

In `apps/web`, `apps/web/app/page.tsx` and `apps/web/app/layout.tsx` are statically prerendered Next.js App Router pages (`○ /` shown verbatim in `next build` route output).
- `process.env.LANDING_PAGE_EDITORIAL_ENABLED` is evaluated **at build time (`next build`)** and baked into the static HTML/RSC output for `/`.
- **Changing `.env` or Render/hosting runtime environment variables alone without running a fresh build + redeploy will NOT toggle `/`!** Both cutover and rollback **require a full rebuild and deployment of `@saymyname/web`**.

---

## 2. Provenance of Phase 4 Audited Builds

| Build Artifact | Commit Audited | Build Command | Flag Env Value | Timestamp | Route Output (`○ /`) |
| --- | --- | --- | --- | --- | --- |
| **Build A (Baseline Default)** | `7aebe0397a374e35c975597c18d3e9d2083f01e7` | `npm run --workspace=@saymyname/web build` | `LANDING_PAGE_EDITORIAL_ENABLED=false` | `2026-11-26T18:41:11+05:30` | `○ /` (`3.82 kB`, `115 kB` First Load JS) |
| **Build B (Release Candidate)** | `7aebe0397a374e35c975597c18d3e9d2083f01e7` | `npm run --workspace=@saymyname/web build` | `LANDING_PAGE_EDITORIAL_ENABLED=true` | `2026-11-26T18:42:02+05:30` | `○ /` (`3.82 kB`, `115 kB` First Load JS) |

---

## 3. Controlled Cutover Checklist (After Approvals)

1. **Verify Approved Commit:** Confirm target PR commit merged onto `main` matches the audited SHA and clean diff.
2. **Verify Decision Gates (`DEC-LP-01` .. `DEC-LP-09`):** Confirm written human sign-off exists in the canonical decision register for all blocking gates (`DEC-LP-01`, `02`, `03`, `04`, `06`, `07`, `08`, `09`, and `05` if telemetry requested).
3. **Verify Photography Assets (`DEC-LP-02`):** Confirm whether release uses approved `3D-01` Two Lights-only layout (`3d-led`) OR newly delivered commissioned photography with signed adult dating-UI model releases. Never enable placeholder images.
4. **Verify Open Graph Image (`DEC-LP-06`):** If a social preview direction (`A` or `B`) is approved, verify the compressed asset sits inside `apps/web/public/images/landing/og/` and `openGraph.images` / `twitter.images` compile cleanly in `app/page.tsx`.
5. **Verify Content & Product Claims:** Confirm Hero copy matches approved `DEC-LP-01` candidate and `landing-flag.test.ts` passes cleanly (`25/25+`).
6. **Confirm Staging/Production Environment:** Verify target deployment service points to approved `main` commit and correct backend API URL (`API_BACKEND_URL`) without touching DB schemas or secrets.
7. **Confirm Build Mode:** Ensure `LANDING_PAGE_EDITORIAL_ENABLED=true` is configured in the hosting **build environment** (not runtime-only) so `next build` emits the Editorial `/` bundle.
8. **Build Approved Artifact:** Run `npm run build:packages && npm run --workspace=@saymyname/web build`.
9. **Run Pre-Traffic Smoke Tests:** Verify `○ /` renders Editorial Hero H1, `/eligibility`, `/safety`, `/privacy`, `/terms`, `/support`, `/login`, `/onboarding`, `/sitemap.xml`, and `/robots.txt` return HTTP `200`, and `/discover` redirects unauthenticated requests (`307`).
10. **Confirm Release Authorization (`DEC-LP-08`):** Confirm human operator approval for production traffic promotion.
11. **Enable via Approved Deployment Pipeline:** Promote build/deploy through the standard deployment platform UI/pipeline (never hot-edit `.env` on live instances).
12. **Verify Live `/`:** Load `https://saymyname.in` in incognito browser: confirm `200 OK`, self-hosted fonts load (`0` external Google Fonts), Two Lights AVIF/WebP loads, `0` console errors, `Share SayMyName` copies `https://saymyname.in`.
13. **Verify All Secondary & Protected Routes:** Spot-check `/eligibility`, `/safety`, `/login`, `/onboarding`, and unauthenticated redirect on `/discover`.
14. **Monitor Post-Release Telemetry:** Watch Render/CDN error rate (`5xx`), TTFB/LCP, and registration start rate on `/onboarding` cleanly for 24h.
15. **Record Release State:** Log deployed commit SHA, build timestamp, operator name, and `LANDING_PAGE_EDITORIAL_ENABLED=true` state in release notes.

---

## 4. Instant Rollback Checklist

Because legacy components (`LegacyHomePage` + disabled `Navbar`/`PublicFooter` modes) remain preserved intact in `apps/web`, rollback is non-destructive and reversible with **zero database or data migrations**:

1. **Identify Active Deployment:** Record the active Render/hosting deploy ID and git commit hash showing regression or error.
2. **Revert Feature Flag to `false`:** Set `LANDING_PAGE_EDITORIAL_ENABLED="false"` in the deployment build environment (or trigger Rollback to Previous Working Build Image in hosting control panel if available instantaneously).
3. **Rebuild & Redeploy (`if changing env`):** Because `○ /` is statically compiled at `next build` time, **trigger a clean build and deploy** (`npm run --workspace=@saymyname/web build`) after resetting `LANDING_PAGE_EDITORIAL_ENABLED=false` (unless rolling back directly to an immutable pre-built artifact from prior release).
4. **Confirm Old Homepage Restored:** Verify `/` displays `"Intentional dating across distance, built around verified peers and mutual consent."` and zero `/images/landing/*` requests fire.
5. **Verify Route Stability:** Confirm `/login`, `/onboarding`, `/eligibility`, `/safety`, and `/api/auth/csrf` operate cleanly.
6. **Monitor Recovery:** Watch CDN cache invalidation (edge cache may serve stale `/` briefly unless purged cleanly) and confirm 5xx/console errors return to zero.
7. **Preserve Failure Evidence:** Capture browser console trace, HAR/network failures, build logs, and deployed commit SHA before investigating root cause on `landing-page-repositioning`.
