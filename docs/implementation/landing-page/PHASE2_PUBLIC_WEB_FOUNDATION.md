# Phase 2 Public Website Technical Foundation Report — SayMyName.in

**Project:** SayMyName.in — The First Impression Project
**Phase:** 2 of 6 (`Workstream F`)
**Delivered Commits on `landing-page-repositioning`:** `ade2e3e`, `08e066c`, `c14ca8e`
**Landing Page Content Boundary:** Public homepage visible layout and copy inside `apps/web/app/page.tsx` remain **100% unchanged** (`Phase 3` integration deferred).

---

## 1. Self-Hosting `Instrument Sans` (`ade2e3e`)

- **License & Source Verification:**
  - Verified directly from Google Fonts official upstream repository (`https://raw.githubusercontent.com/google/fonts/main/ofl/instrumentsans/OFL.txt`): **Copyright 2022 The Instrument Sans Project Authors — SIL Open Font License Version 1.1** (`True`). Permits bundling and self-hosting with license preservation.
  - Bundled verified official variable `WOFF2` assets (`latin` & `latin-ext`, `normal` & `italic`, weights `400..700`) plus upstream [OFL.txt](file:///i:/saymyname-landing/apps/web/app/fonts/OFL.txt) under `apps/web/app/fonts/` (`~84.7 KB` total across all 4 font subsets).
- **Duplicate Import Elimination & Next.js Wiring:**
  - Removed external `@import url('https://fonts.googleapis.com/...')` from [tokens.css](file:///i:/saymyname-landing/packages/design-tokens/styles/tokens.css).
  - Removed manual `fonts.googleapis.com` / `fonts.gstatic.com` `<link>` tags from [layout.tsx](file:///i:/saymyname-landing/apps/web/app/layout.tsx).
  - Configured `next/font/local` (`variable: '--font-instrument-sans'`, `display: 'swap'`) on `<html>`, mapped `--font-ui`, `--font-body`, `--font-display` in `tokens.css` and `tailwind.config.ts`.
- **Live Verification (`http://127.0.0.1:3105/`):**
  - `externalGoogleFontRequests`: `[]` (**`0`** external font connections).
  - `localWoff2Requests`: served cleanly from `/_next/static/media/*.woff2`; `loadedFontsCount: 3`.

---

## 2. Anonymous Visitor `401` Console Error Resolution (`08e066c`)

- **Root Cause:** `AuthProvider` (`auth-context.tsx`) previously invoked `GET /api/auth/me` unconditionally on public mount; when no `smn_access_token` / `smn_refresh_token` cookies existed, `me/route.ts` returned `401`, causing Chrome/Edge DevTools to emit a noisy `401` resource error on every guest visit (`~2s` overhead observed in Phase 0), while `scripts/test-phase2-e2e.mjs:119` intentionally relies on direct unauthenticated `/api/auth/me` returning `401`.
- **Security-Preserving Fix (`Zero Weakening`):**
  - Updated [csrf/route.ts](file:///i:/saymyname-landing/apps/web/app/api/auth/csrf/route.ts) (`GET /api/auth/csrf`, `200 OK`) to include `{ hasSession: Boolean(ACCESS_COOKIE || REFRESH_COOKIE) }` alongside strict `Cache-Control: private, no-store, no-cache, must-revalidate, max-age=0`, `Pragma: no-cache`, and `Vary: Cookie` (never exposing cookie values or JWT claims).
  - Kept [me/route.ts](file:///i:/saymyname-landing/apps/web/app/api/auth/me/route.ts) failing closed (`401`) on direct unauthenticated requests (`evaluateAuthMeSessionPrecheck`), and always forwarding to backend `/identity/me` whenever ANY `smn_access_token` or `smn_refresh_token` cookie exists.
  - Updated [auth-context.tsx](file:///i:/saymyname-landing/apps/web/lib/auth-context.tsx) & [auth-session-status.ts](file:///i:/saymyname-landing/apps/web/lib/auth-session-status.ts) so `AuthProvider` probes `/api/auth/csrf` first and enters clean `UNAUTHENTICATED` state when `hasSession === false`. If `hasSession === true` or probe is unavailable, it strictly fetches `/api/auth/me` so expired, revoked, or tampered cookies still trigger `401` + `clearAuthCookies`.
- **Verification Results (`PASS`):**
  - Unit tests ([auth-session-status.test.ts](file:///i:/saymyname-landing/apps/web/test/auth-session-status.test.ts)): **`6/6` passed** (anonymous, valid, expired-with-refresh, tampered/invalid, malformed payload, post-logout); **`19/19` passed** across all `4` web test suites.
  - Live built Next server (`127.0.0.1:3105`): Guest `/` yielded **`consoleErrors: []`** (`0` console errors), `GET /api/auth/csrf -> 200 { hasSession: false }`, and direct `GET /api/auth/me -> 401` security check preserved intact.

---

## 3. Per-Route Metadata, Canonical URLs, Sitemap & Robots (`c14ca8e`)

- **Metadata Base & Canonical Normalization:** Added `metadataBase: new URL('https://saymyname.in')` in `layout.tsx` and explicit `alternates.canonical` across indexable pages.
- **Unique Accurate Route Metadata Verified on Built App (`10` Routes):**
  - `/` (`SayMyName.in — Intentional dating for verified IIT Madras non-campus BS adults`), `/eligibility`, `/safety`, `/privacy`, `/terms`, `/support`: distinct titles, non-misleading descriptions, `index` enabled, `og:title` / `twitter:card` configured cleanly *(Note: `og:image` link withheld from live `<meta>` until Phase 3 approves & copies `og-direction-a` vs `og-direction-b` into `public/` so zero `404` OG asset URL is served today)*.
  - Client utility routes (`/login`, `/onboarding`, `/forgot-password`, `/reset-password`): distinct titles wrapped in server `layout.tsx` metadata exports with `robots: noindex, follow` (and `noindex, nofollow` on password reset utilities).
- **Dynamic Crawl Routes:**
  - [sitemap.ts](file:///i:/saymyname-landing/apps/web/app/sitemap.ts) -> Verified `200 OK` XML listing strictly `/`, `/eligibility`, `/safety`, `/privacy`, `/terms`, `/support`.
  - [robots.ts](file:///i:/saymyname-landing/apps/web/app/robots.ts) -> Verified `200 OK` permitting `/` while disallowing `/api/`, `/discover`, `/likes`, `/matches`, `/chats`, `/profile` as crawl hygiene (authentication continues enforcing real access control).

---

## 4. Build, Typecheck & Known Pre-Existing Observation

- `npm run build:packages` -> Exit `0` (`contracts`, `database` Prisma generate, `design-tokens`, `validation`).
- `npm run --workspace=@saymyname/web build` -> Exit `0`, **`32/32` Next.js routes compiled** cleanly (including Next internal lint & strict TypeScript validation across `app/` & `lib/`).
- `node --experimental-strip-types --test apps/web/test/*.test.ts` -> **`19/19` passed** (`4` suites, `0` failed, `0` skipped).
- **Pre-Existing Standalone `tsc --noEmit` Observation (`Not Weakened`):** Running standalone `npm run --workspace=@saymyname/web typecheck` flags `TS5097` solely on `test/*.test.ts` (`auth-session-status.test.ts`, `discover-state.test.ts`, `likes-state.test.ts`, `matches-state.test.ts`) because Node native TS runner imports `.ts` suffixes while `apps/web/tsconfig.json` includes `**/*.ts` without `allowImportingTsExtensions`. Zero errors exist in any application route or library file, and `tsconfig.json` / existing tests were intentionally not weakened.
