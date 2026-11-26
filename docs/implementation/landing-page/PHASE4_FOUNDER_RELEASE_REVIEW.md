# Phase 4: Founder Release Review Pack — SayMyName.in

**Purpose:** Concise founder briefing to review what visitors will see, approve open human decisions (`DEC-LP-01` .. `DEC-LP-09`), and decide whether to authorize controlled launch preparation.
**Visual Review Folder:** `docs/implementation/landing-page/phase4-release-review/` (`14` live application screenshots + `INDEX.md`)

---

## 1. What Is Implemented Today (Behind `LANDING_PAGE_EDITORIAL_ENABLED=true`)
- Eight-band **Editorial Romance** homepage inside the real Next.js application (`apps/web`):
  1. Scoped Visitor Header (`How It Works`, `Eligibility`, `Safety`, `Sign In`, `Create Account`) + mobile accessible drawer.
  2. Two Lights Hero (`3D-01` static AVIF/WebP atmospheric study, editorial H1, `Create Account` & `See how it works` CTAs, trust line, explicit IIT Madras non-affiliation disclosure).
  3. Across Cities Narrative Band with architectural Mineral Night meridian illustration.
  4. `Inside SayMyName` Interactive Preview (`01. Discover` -> `02. Mutual Match` -> `03. Private 1:1 Chat`) marked `"Sample product preview · Illustrative layout"`.
  5. Five-step `How It Works` onboarding sequence accurately noting manual 18+ & BS enrolment review.
  6. `Eligible Cohorts` ruled ledger strictly showing the four approved IITM non-campus BS tracks.
  7. `Safety & Consent` three trust commitments.
  8. Peer Sharing closing band copying clean `https://saymyname.in` + updated Public Footer.

## 2. What Visitors Currently See in Production
**Nothing changed yet.** Production and default builds have `LANDING_PAGE_EDITORIAL_ENABLED=false`, serving the exact existing homepage verbatim.

## 3. What Remains Provisional (Requires Your Explicit Decisions)
Review the screenshots inside `docs/implementation/landing-page/phase4-release-review/` and resolve:

1. **`DEC-LP-01` (Headline & Primary CTA):** Keep Candidate A (*"Same world. Different cities. A chance to meet."*) + `Create Account` vs Candidate B (*"Built for real connection across your BS world."*) vs Candidate C (*"A calmer place to meet someone who shares your pace."*).
2. **`DEC-LP-02` (Visual Composition & Photography Budget):** Approve releasing with the interim **Two Lights 3D-only + architectural visual (`3d-led`)** seen in `01-desktop-hero-1440x900.png` OR commission the ₹32,000–₹65,000 editorial photoshoot (`IMG-01..03`) with adult dating-UI model releases before launch.
3. **`DEC-LP-03` (Header Navigation Labels):** Approve replacing `Eligibility Guide` / `Safety & Consent` / `Register` on `/` with `How It Works`, `Eligibility`, `Safety`, `Sign In`, `Create Account`.
4. **`DEC-LP-04` (Feature Omission Rule):** Confirm strict Phase 1 honesty (omit calling, voice notes, mini-games, Relationship Space UI until shipped on `main`).
5. **`DEC-LP-05` (Peer Share Attribution & Analytics):** Approve keeping `?src=peer` disabled (clean `https://saymyname.in`, zero analytics) OR defer optional cookie-less funnel telemetry until formal legal counsel approval (`Doc 01 §01`).
6. **`DEC-LP-06` (Open Graph Social Preview Card):** Choose `12-og-direction-a-draft.png` (horizontal X/LinkedIn clarity) vs `13-og-direction-b-draft.png` (WhatsApp 1:1 square-safe centered frame), or launch without `og:image` until chosen.
7. **`DEC-LP-09` (`3D-01` Asset Sign-Off):** Confirm shipping the compressed Phase 2 shader AVIF/WebP suite (`2.97 KB` / `1.48 KB`) vs ordering a Cycles GPU re-render.
8. **`DEC-LP-07` & `DEC-LP-08` (Flag Activation & Release Authorization):** Explicit launch authorization specifying commit hash and target environment (`staging` or `production`).

## 4. Cleared vs Unreleased Assets
- **Technically Cleared:** Self-hosted `Instrument Sans` (`SIL OFL 1.1`), `3D-01` Two Lights AVIF/WebP suite (verified `yuv420p10le` / `yuv420p` + Chromium decoding).
- **Not Cleared / Blocked:** Commissioned photography (`IMG-01..03`) — zero stock or placeholder photos are used; Open Graph image wiring (`DEC-LP-06`); any tracking or attribution code (`DEC-LP-05`).
