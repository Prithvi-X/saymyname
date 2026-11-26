# Phase 5: Pre-Agreed Post-Launch Stabilization & Rollback Plan

**Project:** SayMyName.in — The First Impression Project
**Execution Status:** **PLANNED / NOT EXECUTED** (Production deployment and rollback were NOT exercised because live launch is held under `DEC-LP-08`).

---

## 1. Immediate Post-Launch Verification Checklist (When Authorized)

Execute once live production deploys with build-time `LANDING_PAGE_EDITORIAL_ENABLED=true`:
- [ ] `GET https://saymyname.in` returns HTTP `200 OK` and displays Hero H1 `"Same world. Different cities. A chance to meet."`.
- [ ] Hero Two Lights `<picture>` loads `10-bit AVIF` / `WebP` (`0` 404s, `0` uncommissioned photos).
- [ ] Self-hosted `Instrument Sans` WOFF2 renders with `0` external Google Fonts requests.
- [ ] `<meta property="og:image">` resolves HTTP `200` at `https://saymyname.in/images/landing/og/saymyname-og-direction-a.png`.
- [ ] Mobile (`390×844`) visitor drawer, `Create Account` (`/onboarding`), `#how-it-works`, `/eligibility`, `/safety`, `/privacy`, `/terms`, `/support`, `/login`, `/sitemap.xml`, and `/robots.txt` operate cleanly.
- [ ] Unauthenticated `/discover`, `/likes`, `/matches`, `/chats`, `/profile` redirect `307` -> `/login`.
- [ ] `Share SayMyName` copies exact `https://saymyname.in` with `0` `?src=peer`, cookies, or analytics calls.

---

## 2. Planned 24-Hour Operational Monitoring Targets

*(Note: Because production launch did NOT happen, no post-launch metrics were monitored or collected.)*
- **Designated Owner:** Release Owner / Product Founder (to be confirmed at `DEC-LP-08` execution).
- **Metrics to Review During First 24 Hours Post-Launch:** Host HTTP `5xx` rate (`0%`), homepage TTFB/LCP (`<= 2.5 s` mobile), CLS (`<= 0.1`), zero console/JS runtime errors, `GET /api/auth/csrf` `200`, and normal `/onboarding` conversion funnel entry rate.

---

## 3. Verified Rollback Posture (`Not Exercised in Production`)

Per `PHASE4_PRODUCTION_CUTOVER_AND_ROLLBACK.md`, `LANDING_PAGE_EDITORIAL_ENABLED` is evaluated **at Next.js static build time (`○ /`)**, so toggling `.env` without rebuilding does not switch `/`.
- **No rollback occurred** because production stayed untouched on legacy `/`.
- **Pre-verified Rollback Method:** Either promote the previous immutable deployment image OR set `LANDING_PAGE_EDITORIAL_ENABLED=false` in the build environment, run `npm run --workspace=@saymyname/web build`, redeploy, purge CDN cache if applicable, and verify `/` renders `"Intentional dating across distance..."` with zero `/images/landing/3d/*` requests.
