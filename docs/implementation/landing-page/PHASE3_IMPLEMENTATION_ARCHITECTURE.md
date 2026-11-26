# Phase 3: Implementation Architecture

**Project:** SayMyName.in — The First Impression Project
**Phase:** 3 of 6 (Production Landing Page Integration, Implementation & Acceptance)
**Branch:** `landing-page-repositioning`
**Status:** Feature-gated implementation complete; awaiting human review of `DEC-LP-01`..`DEC-LP-06` before default activation

---

## 1. Architectural Strategy & Feature Gating

The redesigned 8-band **Editorial Romance** landing experience is integrated into `apps/web` behind an explicit, fail-closed build/server feature flag:

- **Helper:** `apps/web/lib/landing-flag.ts` -> `isEditorialLandingEnabled(rawValue = process.env.LANDING_PAGE_EDITORIAL_ENABLED)`
- **Contract:** Returns `true` **only** when `rawValue === 'true'`. Unset, empty string, `'false'`, `'1'`, `'TRUE'`, or whitespace-padded strings resolve to `false`.
- **Fallback Parity:** When disabled (default across `.env.example` and unconfigured environments), `apps/web/app/page.tsx` renders `<LegacyHomePage />` verbatim while `Navbar` and `PublicFooter` maintain legacy Phase 2 behaviour with zero landing asset requests (`/images/landing/3d/*` is never fetched).
- **Static Rendering Preserved:** Passing the boolean computed at build/render time inside `RootLayout` and `HomePage` avoids `cookies()` / `headers()` dynamic bailout, keeping `○ /` static (`3.82 kB` route payload, `115 kB` First Load JS).

---

## 2. Module & Component Tree

| File | Responsibility | Execution Mode |
| --- | --- | --- |
| `apps/web/lib/landing-flag.ts` | Opt-in feature flag helper (`LANDING_PAGE_EDITORIAL_ENABLED === 'true'`) | Shared / Server-safe |
| `apps/web/components/landing/landing-types.ts` | TypeScript interfaces for copy candidates, preview tabs, steps, tracks, trust cards | Types only |
| `apps/web/components/landing/landing-content.ts` | Approved factual Phase 1 truth copy, `HERO_CANDIDATES` (`A`, `B`, `C`), `PEER_SHARE_CANONICAL_URL` | Static module |
| `apps/web/components/landing/LandingHero.tsx` | Band 1: Responsive `<picture>` (`10-bit AVIF` -> `WebP`) Two Lights hero, H1, dual CTAs, trust line, IITM independence note | Server Component |
| `apps/web/components/landing/AcrossCitiesSection.tsx` | Band 2: Non-campus narrative + architectural meridian SVG + city chips (zero stock placeholders) | Server Component |
| `apps/web/components/landing/ProductPreview.tsx` | Band 3: Accessible `role="tablist"` preview (`Discover` / `Mutual Match` / `Private 1:1 Chat`) with roving focus & local state | Client Component |
| `apps/web/components/landing/HowItWorksSection.tsx` | Band 4: `#how-it-works` 5-step onboarding ledger accurately stating manual 18+ and BS student review | Server Component |
| `apps/web/components/landing/ProgrammeSection.tsx` | Band 5: `#community` ruled ledger strictly scoped to the four IITM non-campus BS programme families | Server Component |
| `apps/web/components/landing/TrustSection.tsx` | Band 6: `#trust` three privacy/consent invariants (no unsolicited DMs, default-deny privacy, independence) | Server Component |
| `apps/web/components/landing/ShareSection.tsx` | Band 7: `#share` final `Create Account` CTA and clean `Share SayMyName` (`https://saymyname.in`, no `?src=peer`) | Client Component |
| `apps/web/components/landing/LandingPage.tsx` | Orchestrates Bands 1–7 inside Mineral Night alternating `Void` (`#0B0D10`) / `Coal` (`#12161B`) rhythm | Server Component |
| `apps/web/components/Navbar.tsx` | Scoped `editorialEnabled && pathname === '/'` unauthenticated visitor header + Escape-close focus-returning mobile drawer | Client Component |
| `apps/web/components/PublicFooter.tsx` | Scoped `editorialEnabled && pathname === '/'` anchor navigation (`#inside-saymyname`, `#how-it-works`) | Client Component |
| `apps/web/app/layout.tsx` | Accessible `"Skip to main content"` link + `id="main-content"` target + flag propagation | Server Component |

---

## 3. Asset & Privacy Isolation Boundaries

- **Approved Visual Assets (`3D-01`):** Only the six compressed Two Lights renders (`two-lights-desktop-10bit.avif`, `two-lights-desktop-8bit.avif`, `two-lights-desktop.webp`, `two-lights-mobile-10bit.avif`, `two-lights-mobile.webp`, `two-lights-detail.webp`) reside in `apps/web/public/images/landing/3d/`. The `810 KB` uncompressed PNG master remains archived solely in `docs/implementation/landing-page/phase2-preview/assets/3d/`.
- **Deferred Assets Excluded:** No uncommissioned placeholder photography (`img-01..03-placeholder.webp`) or unapproved OG images (`og-direction-a`/`b`) were copied into `apps/web/public/`.
- **No Attribution Parameters:** Peer sharing copies clean `https://saymyname.in` via Web Share API or Clipboard API without `?src=peer`, cookies, or tracking endpoints (`DEC-LP-05`).
- **Standalone Typecheck Fix (`TS5097`):** Added `"allowImportingTsExtensions": true` alongside existing `"noEmit": true` in `apps/web/tsconfig.json` so `tsc --noEmit` typechecks `apps/web/test/*.test.ts` cleanly without modifying `node --experimental-strip-types --test` compatibility.
