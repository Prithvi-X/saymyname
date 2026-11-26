# Phase 4: Canonical Decision Register — SayMyName.in

**Project:** SayMyName.in — The First Impression Project
**Workstream:** Agent 2, Landing Page
**Phase:** 4 of 6 (Production Release Readiness, Decision Closure & Controlled Launch Preparation)
**Branch:** `landing-page-repositioning`
**Governance Authority:** `Document 08`, `Document 09`, `AGENTS.md`, Phase 1 Decision Register, Phase 2 Decision Register

---

## 1. Purpose & Governance Reconciliation Note

During Phase 3 audit, an ID-drift discrepancy occurred inside `PHASE3_DECISION_AND_RELEASE_REGISTER.md` and `PHASE3_COMPLETION_AND_PHASE4_HANDOFF.md`:
- Phase 3 reused `DEC-LP-03` for *"Two Lights 3D asset final sign-off"* instead of its canonical meaning (*"Visitor header navigation labels"*).
- Phase 3 reused `DEC-LP-04` for *"Flag cutover (`LANDING_PAGE_EDITORIAL_ENABLED=true`)"* instead of its canonical meaning (*"Continued omission of deferred and unshipped product features"*).
- Phase 3 code (`apps/web/components/landing/landing-content.ts`) had also drifted on `HERO_CANDIDATES.B` and `.C` headlines compared to Phase 1/2 `DEC-LP-01`.

**Resolution in Phase 4:**
1. Restored canonical meanings from `PHASE1_DECISION_REGISTER.md` and `PHASE2_DECISION_REGISTER.md` for `DEC-LP-01` through `DEC-LP-06`.
2. Restored canonical `HERO_CANDIDATES.B` and `.C` strings inside `apps/web/components/landing/landing-content.ts`.
3. Created distinct non-overlapping decision IDs **`DEC-LP-07`** (Production feature-flag activation), **`DEC-LP-08`** (Final production release authorization), and **`DEC-LP-09`** (Final `3D-01` rendering source sign-off: current compressed shader renders vs commissioning Blender Cycles re-render).
4. Retained strict `PROPOSED` status across every decision where no explicit founder/legal approval artifact exists in the repository.

Allowed Status Vocabulary: `PROPOSED` | `APPROVED` | `REJECTED` | `DEFERRED` | `SUPERSEDED`

---

## 2. Reconciled Canonical Decision Register (`DEC-LP-01` .. `DEC-LP-09`)

### `DEC-LP-01`: Hero Headline, Positioning Framing & Primary CTA
- **Canonical Definition:** Final selection of landing hero headline variant, explicit dating positioning eyebrow, and unified primary CTA copy across Header, Hero, and closing Share CTA.
- **Original Alternatives:**
  - Headline **Candidate A:** *"Same world. Different cities. A chance to meet."*
  - Headline **Candidate B:** *"Built for real connection across your BS world."*
  - Headline **Candidate C:** *"A calmer place to meet someone who shares your pace."*
  - CTA Options evaluated: **`Create Account`** (`/onboarding`, recommended), `Join SayMyName`, `Join Cohort`.
  - Secondary CTA: **`See how it works`** (`#how-it-works`).
- **Phase 3 / Phase 4 Implementation Status:** Implemented behind `LANDING_PAGE_EDITORIAL_ENABLED=true` with `HERO_CANDIDATES` configurable map (`Candidate A` wired as preview default; `Candidate B` & `C` restored verbatim in Phase 4).
- **Current Approval Status:** `PROPOSED`
- **Evidence of Approval:** None in repository (`PHASE1_DECISION_REGISTER.md` & `PHASE2_DECISION_REGISTER.md` both record `PROPOSED - HUMAN APPROVAL REQUIRED`).
- **Required Approver:** Founder / Human Project Owner.
- **Dependencies:** `n >= 10` student clarity check (recommended pre-launch confirmation) and `DEC-LP-06` OG headline alignment.
- **Consequences of Remaining Unresolved:** Release defaults to Candidate A only inside flag-gated candidate; live cutover (`DEC-LP-08`) stays blocked.

### `DEC-LP-02`: Hero Focal Visual Composition & Photography Commissioning Budget
- **Canonical Definition:** Visual composition strategy for Hero Band 1 (`Two Lights` 3D sculpture vs editorial photography vs paired layout) and whether to commission an external photography shoot (`IMG-01`, `IMG-02`, `IMG-03`).
- **Original Alternatives:**
  - **Option C (Paired):** Pre-rendered `3D-01` (*Two Lights*) + commissioned `IMG-01` campaign photo (non-binding Phase 2 budget estimate: **₹32,000 – ₹65,000 INR**; zero spend committed).
  - **Option A (3D-Led Interim / Sculpture-Only):** `3D-01` compressed static renders (`AVIF`/`WebP`) + architectural `AcrossCities` SVG + Document 10 initial badge in `ProductPreview`.
  - **Option B (Photo-Only):** `IMG-01` editorial photography without `3D-01`.
- **Phase 3 / Phase 4 Implementation Status:** Implemented strictly with **Option A (`3d-led`)** interim configuration. Zero placeholder photography (`img-01..03-placeholder.webp`) exists inside `apps/web/public/`. Zero photography spend committed.
- **Current Approval Status:** `PROPOSED`
- **Evidence of Approval:** None in repository; no commissioned portrait releases or invoices exist.
- **Required Approver:** Founder / Human Project Owner + Visual Asset Budget Sign-off.
- **Dependencies:** Model releases (18+ ID check + explicit dating-UI demonstration clause) if Option C/B commissioned; no dependencies if Option A explicitly approved for initial release.
- **Consequences of Remaining Unresolved:** Production release cannot imply human photography is cleared; Option C cannot be wired until commissioned, released assets are delivered.

### `DEC-LP-03`: Visitor Header Navigation Labels & Structure
- **Canonical Definition:** Approval of simplified visitor navigation labels on the homepage navbar and mobile visitor drawer, unifying `Register` -> `Create Account`.
- **Original Alternatives:**
  - **Legacy Current Header:** `Eligibility Guide`, `Safety & Consent`, `Sign In`, `Register`.
  - **Proposed Editorial Header:** `How It Works` (`#how-it-works`), `Eligibility` (`/eligibility`), `Safety` (`/safety`), `Sign In` (`/login`), **`Create Account`** (`/onboarding`).
- **Phase 3 / Phase 4 Implementation Status:** Scoped cleanly inside `Navbar.tsx` (`useEditorialVisitorNav`) when `LANDING_PAGE_EDITORIAL_ENABLED=true` and `pathname === '/'`; legacy routes retain existing labels cleanly when disabled or on secondary pages.
- **Current Approval Status:** `PROPOSED`
- **Evidence of Approval:** None in repository. *(Note: Phase 3 register erroneously mapped Two Lights 3D sign-off to `DEC-LP-03`; restored cleanly here, with 3D render method moved to `DEC-LP-09`.)*
- **Required Approver:** Founder / Human Project Owner.
- **Dependencies:** `DEC-LP-01` CTA terminology alignment (`Create Account`).
- **Consequences of Remaining Unresolved:** Proposed visitor navigation remains isolated behind feature flag until founder sign-off.

### `DEC-LP-04`: Continued Omission of Deferred & Unshipped Product Features
- **Canonical Definition:** Binding product-honesty rule requiring the public landing page and Open Graph metadata to omit capabilities not yet implemented, integrated, and accepted on `main`.
- **Original Alternatives:**
  - **Option 1 (Strict Omission):** Showcase only implemented Phase 1 flows (`Registration + OTP`, `Manual 18+/BS Review`, `Discover`, `Likes/Pass`, `Mutual Match`, `Private 1:1 Text Chat`, `Unmatch/Block/Report`). Exclude audio calls, voice notes, video calls, cohort mini-games, virtual dates, Relationship Space UI, group calling, and native mobile apps.
  - **Option 2:** Mention future calling/games/Relationship Space features as `"Coming soon"`.
- **Phase 3 / Phase 4 Implementation Status:** **Option 1 (Strict Omission)** enforced in components and automated assertions in `apps/web/test/landing-flag.test.ts`. *(Note: Phase 3 register erroneously mapped feature-flag cutover to `DEC-LP-04`; restored cleanly here, with flag activation moved to `DEC-LP-07`.)*
- **Current Approval Status:** `PROPOSED`
- **Evidence of Approval:** None in repository as a standalone sign-off record, though required by `AGENTS.md` / Document 09 baseline policy pending formal founder ratification for launch.
- **Required Approver:** Founder / Human Project Owner.
- **Dependencies:** Must remain aligned with whatever backend modules are merged into `main` at launch time.
- **Consequences of Remaining Unresolved:** Option 1 stays enforced by default in candidate build to prevent overclaiming.

### `DEC-LP-05`: Aggregate Funnel Telemetry & `?src=peer` Share Attribution
- **Canonical Definition:** Authorization and legal clearance for optional cookie-less aggregate funnel counts (`lp_page_viewed`, `lp_cta_clicked`, `lp_share_clicked`, `onboarding_stage_entered`) and `?src=peer` share parameter.
- **Original Alternatives:**
  - **Option 1 (Deferred / Zero Telemetry):** Clean canonical sharing (`https://saymyname.in`), zero tracking params, zero funnel telemetry scripts.
  - **Option 2 (Conditional Legal-Cleared Telemetry):** Cookie-less daily aggregate buckets + `?src=peer` URL param after explicit legal/DPDP review (`Doc 01 §01`).
- **Phase 3 / Phase 4 Implementation Status:** **Option 1** implemented cleanly. `ShareSection.tsx` copies/shares clean `https://saymyname.in` without `?src=peer`, cookies, localStorage attribution, or analytics requests.
- **Current Approval Status:** `PROPOSED`
- **Evidence of Approval:** None in repository; no legal counsel review recorded.
- **Required Approver:** Legal / Privacy Counsel (`Document 01 §01`) + Founder / Human Project Owner.
- **Dependencies:** Legal review of `/privacy` and `/terms` disclosure wording if Option 2 is later chosen.
- **Consequences of Remaining Unresolved:** Option 2 remains strictly disabled in production code and candidate builds.

### `DEC-LP-06`: Open Graph Social Share Artwork Direction (`1200×630`)
- **Canonical Definition:** Approval of social share preview image (`og:image` / `twitter:image`) shown when `https://saymyname.in` is shared on WhatsApp, X, Telegram, or LinkedIn.
- **Original Alternatives:**
  - **Direction A (`og-direction-a-editorial.png` / `.jpg`):** Left editorial headline + right `Two Lights` glow (`1200×630`, `121 KB` PNG / `76 KB` JPG). Note: `1:1` square crops (e.g. compact WhatsApp thumbs) clip left text margin.
  - **Direction B (`og-direction-b-monolith.png` / `.jpg`):** Centered framed monolith (`1200×630`, `150 KB` PNG / `74 KB` JPG) designed for safe `1:1` square center cropping.
- **Phase 3 / Phase 4 Implementation Status:** Both master images audited inside `docs/implementation/landing-page/phase2-preview/assets/social/`. Neither is copied into `apps/web/public/` nor wired to `openGraph.images` / `twitter.images` in `apps/web/app/page.tsx`. (`og:image` intentionally unset; zero broken metadata image links).
- **Current Approval Status:** `PROPOSED`
- **Evidence of Approval:** None in repository.
- **Required Approver:** Founder / Human Project Owner.
- **Dependencies:** `DEC-LP-01` final headline text (currently displays Candidate A).
- **Consequences of Remaining Unresolved:** Social shares show rich `og:title` and `og:description` text cards without a banner thumbnail (`summary_large_image` renders text-only until wired).

### `DEC-LP-07` *(New Phase 4 Governance ID)*: Production Feature-Flag Activation (`LANDING_PAGE_EDITORIAL_ENABLED=true`)
- **Canonical Definition:** Explicit operational authorization to build/deploy the web application with build-time variable `LANDING_PAGE_EDITORIAL_ENABLED=true` in a target environment (staging preview or production).
- **Alternatives:** Keep `false` (default legacy homepage) vs enable `true` for target deployment artifact.
- **Phase 3 / Phase 4 Implementation Status:** Fail-closed implemented (`=== 'true'`). Requires full Next.js static rebuild (`○ /` compiles at build time). Default repository `.env.example` stays `false`.
- **Current Approval Status:** `PROPOSED`
- **Evidence of Approval:** None. No environment flag flip executed.
- **Required Approver:** Founder / Release Owner.
- **Dependencies:** Gate A (`DEC-LP-01`), Gate B (`DEC-LP-02`, `DEC-LP-03`, `DEC-LP-06`, `DEC-LP-09`), Gate C (`DEC-LP-04`, `DEC-LP-05`), Gate D (engineering smoke checks).
- **Consequences of Remaining Unresolved:** Production build continues serving the existing Phase 2 homepage safely.

### `DEC-LP-08` *(New Phase 4 Governance ID)*: Final Production Release Authorization & Cutover Sign-Off
- **Canonical Definition:** Explicit formal authorization to merge/promote an identified release commit from `landing-page-repositioning` to `main` and deploy the Editorial Romance homepage for public visitors on `https://saymyname.in`.
- **Alternatives:** Hold on feature branch (`landing-page-repositioning`) vs authorize named commit SHA -> `main` -> production build with `LANDING_PAGE_EDITORIAL_ENABLED=true`.
- **Phase 3 / Phase 4 Implementation Status:** Candidate verification & cutover/rollback runbook prepared; no merge or deployment executed.
- **Current Approval Status:** `PROPOSED`
- **Evidence of Approval:** None.
- **Required Approver:** Founder / Release Owner (`Document 08` human gate).
- **Dependencies:** Satisfaction of Gates A–D and explicit sign-off on `DEC-LP-01`..`DEC-LP-07` and `DEC-LP-09`.
- **Consequences of Remaining Unresolved:** Live production site remains strictly unchanged.

### `DEC-LP-09` *(New Phase 4 Governance ID — Split from Phase 3 Drift)*: Final `3D-01` Two Lights Asset Render Approval
- **Canonical Definition:** Confirm whether the compressed static shader-generated renders (`two-lights-desktop-10bit.avif` `2.97 KB`, `two-lights-desktop-8bit.avif` `2.88 KB`, `two-lights-desktop.webp` `14.2 KB`, `two-lights-mobile-10bit.avif` `1.47 KB`, `two-lights-mobile.webp` `4.66 KB`, `two-lights-detail.webp` `8.28 KB`) are approved for launch, or if a Cycles raytrace re-render via `build_two_lights_scene.py` is required.
- **Alternatives:** Accept current Phase 2 shader `AVIF`/`WebP` suite vs request Cycles GPU re-render from Blender script.
- **Phase 3 / Phase 4 Implementation Status:** Current compressed assets verified (`ffprobe` confirmed `yuv420p10le` on `10bit` files, `yuv420p` on `8bit` file; WebGL shader renders cleanly decoded by Chromium with WebP fallbacks).
- **Current Approval Status:** `PROPOSED`
- **Evidence of Approval:** None in repository.
- **Required Approver:** Founder / Creative Sign-off.
- **Dependencies:** `DEC-LP-02` Hero focal composition decision.
- **Consequences of Remaining Unresolved:** Assets remain staged as release-candidate visuals pending explicit founder acceptance.
