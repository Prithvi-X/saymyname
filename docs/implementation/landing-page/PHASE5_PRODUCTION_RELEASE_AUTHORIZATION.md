# Phase 5: Production Release Authorization & PR Preparation

**Project:** SayMyName.in — The First Impression Project
**Feature Branch:** `landing-page-repositioning`
**Verified Release Candidate Commit:** `1cfc3e2f1c94e0f5236682460610f63976738d0d`
**Target Main Branch Status:** `3e13859021f56b0e8eb6277e920eaf55eebf9a70` (Untouched)
**Authorization Status:** **`HOLD LIVE PRODUCTION LAUNCH / PR CANDIDATE READY`**

---

## 1. Explicit Release Authorization Record (`DEC-LP-07` & `DEC-LP-08`)

- **Approver Role:** Founder / Product Owner (recorded `2026-11-26T19:03:16+05:30`)
- **Explicit Founder Authorization Granted (Interaction A4):** *"Authorize PR creation/review readiness with `LANDING_PAGE_EDITORIAL_ENABLED=true` candidate build, but hold live production merge/deploy."*
- **Approved Visual Direction:** `DEC-LP-01` Candidate A (*"Same world. Different cities. A chance to meet."* + `Create Account`), `DEC-LP-02` Option A (`3D-01` Two Lights-only hero, `₹0` photo commission), `DEC-LP-09` compressed WebGL2 SDF shader `AVIF`/`WebP` suite, `DEC-LP-03` simplified visitor nav, `DEC-LP-04` strict Phase 1 feature omission.
- **Approved OG Asset:** `DEC-LP-06` Direction A (`apps/web/public/images/landing/og/saymyname-og-direction-a.png`, SHA-256 `79AB84C400C80A3D9D90CDE65DDFC7DF913F322CD0A7431216331A80D190A4D3`).
- **Deferred Decisions:** `DEC-LP-05` (cookie-less funnel analytics & `?src=peer` disabled cleanly until legal/privacy sign-off); **`DEC-LP-08` (actual merge to `main` & live deployment explicitly HELD)**.
- **Production Environment Variable (`LANDING_PAGE_EDITORIAL_ENABLED`):** Remains `'false'` in `.env.example` and unconfigured live production. Must be set to `'true'` **at build time (`next build`)** only when `DEC-LP-08` is later issued.

---

## 2. Pull Request Preparation Package (`gh` CLI unavailable in workspace)

Because `gh` CLI is not installed locally (`not recognized`), open the protected PR manually via GitHub Compare URL:
- **Compare URL:** `https://github.com/Prithvi-X/saymyname/compare/main...landing-page-repositioning`
- **PR Title:** `feat(landing): Editorial Romance repositioning behind LANDING_PAGE_EDITORIAL_ENABLED flag`
- **PR Review Summary:**
  - Integrates the 8-band *Editorial Romance* landing experience behind fail-closed `LANDING_PAGE_EDITORIAL_ENABLED === 'true'`, preserving legacy `/` verbatim when `false`.
  - Includes approved `3D-01` Two Lights `AVIF`/`WebP` suite (`DEC-LP-02` / `09`), self-hosted `Instrument Sans` (`SIL OFL 1.1`), and approved `1200×630` OG Direction A artwork (`DEC-LP-06`).
  - Fixes `Navbar` mobile drawer button target to `44×44 px` and footer editorial text to `>= 12 px`.
  - Passes `@saymyname/web` typecheck (`0` errors), `26/26` unit tests, dual production builds (`disabled` & `enabled`), 8-viewport Playwright verification, and scoped security/SEO checks.
- **Required Before Merging (`DEC-LP-08` Gate):**
  1. Human reviewer approval on GitHub PR.
  2. Staging URL preview check & Lighthouse CI verification (if configured).
  3. Explicit founder go-ahead (`DEC-LP-08`) authorizing build/deploy with `LANDING_PAGE_EDITORIAL_ENABLED=true`.
