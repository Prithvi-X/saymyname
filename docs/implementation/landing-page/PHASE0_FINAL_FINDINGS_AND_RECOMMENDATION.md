# Phase 0 Final Findings & Strategic Recommendation — SayMyName.in

**Workstream:** The First Impression Project — Landing Page Repositioning & Conversion Redesign  
**Phase:** 0 of 6 (Research, Audit & Discovery)  
**Purpose:** Synthesize audited code/live telemetry, verified behavioral science, competitor positioning, and Document 10 aesthetics into an actionable blueprint awaiting human review before Phase 1 (IA & Copy Design).

---

## 1. Executive Synthesis: The Core Repositioning Shift

`SayMyName.in` does not suffer from a technical quality problem — its dark UI tokens, auth security, eligibility boundaries, and responsive integrity (`0px` overflow across `375px–1440px`) are disciplined. Its problem is **narrative inversion**:

> **Current Homepage Story:** *"Here is an architectural schematic (`v1.0`), four default-deny security gates, four BS degree curricula, and anti-coercion policies. Click Create Account if you comply."*  
> **New Strategic Story (*Editorial Romance*):** *"Across cities, schedules, and solo study nights, you already share the same world. Here is a calmer, human space built to meet someone real inside it — protected by verified adult boundaries you never have to worry about."*

Everything in the upcoming landing page redesign should obey one simple rule:
**Earn emotional curiosity and human trust first; explain cohort verification and consent mechanics right after the visitor wants to be inside.**

---

## 2. Recommended Public Landing Page Narrative & Section Sequence

Rather than the current `4`-section compliance document (`Hero Schematic -> Verification Sequence -> Academic Scope -> Consent Commitments`), we recommend a **`7`-band Editorial Romance arc** with balanced pacing (`~320–420` total words instead of `555` bureaucratic words):

| Order | Section Name | Narrative Job & Key Content | Document 10 Visual Treatment | Research & Truth Guardrail |
|---:|---|---|---|---|
| **0** | **Header (`Navbar`)** | Clean navigation: `SayMyName` mark + `How It Works`, `Eligibility`, `Safety` + `Sign In` + single unified Primary CTA (`Create Account`). | Sticky `66px` `.smn-glass-nav`, crisp focus rings, sentence-case links. | Resolves `Register` vs `Create Account` verb split (`WP-06`). |
| **1** | **Hero: *The First Impression*** | **Display Headline** (`64–72px` desktop / `40–46px` mobile): Working direction *"Same world. Different cities. A chance to meet."* **1 crisp human subheadline** (2 sentences max: intentional dating for verified 18+ adults in IIT Madras non-campus BS programmes, plus subtle independent disclaimer). **1 Primary CTA** (`Create Account` -> `/onboarding`) + **1 quiet secondary link** (`See how it works ↓`). | **Left (`7 cols`):** Authoritative display typography, generous breathing room. **Right (`5 cols`):** Concept 1 (*Two Lights Across the Interval* static raytraced `AVIF` sculptural scene or refined atmospheric human photograph — **zero `v1.0` schematics!**). Mobile keeps compact focal image crisp in/near initial fold without 3 stacked buttons. | **LCP `< 2.5s`**, **zero** engineering terms (`default-deny`), zero fake numbers. |
| **2** | **Emotional Context: *Across Cities & Screens*** | A short, deeply relatable editorial reflection on non-campus BS life: studying across different Indian cities, exams, late nights, group chats that aren't meant for romance—and why intentional 1-to-1 connection deserves its own dedicated place. | Asymmetrical `2-column` split or editorial pull-quote band with warm `Ember` subtle key highlight (`#E18A62` <= 2% area) and calm human scene photography. | Targets **Segments A, B, C** (belonging without swipe chaos or student clichés). |
| **3** | **Product Demonstration: *Inside SayMyName*** | Real, honest visual preview of what happens *after* onboarding: **(a) Discover Card preview** showing photo vignette, coarse city/state (`Bengaluru, KA`), BS track + stage, thoughtful prompt answer (*"A Sunday afternoon I never get tired of..."*); **(b) Mutual Match moment** (*THE INTERVAL* two forms aligning); **(c) Calm 1-to-1 Chat snippet**. | Clean Coal/Iron device/editorial frame clearly captioned **`Product preview · Illustrative sample`** so no visitor mistakes demo cards for real private users (`Doc 10 §13`). | Fulfills `WP-02` & **strict honesty**: previews **only** live Phase 3 flows (`Discover`, `Likes`, `Matches`, async `Chats`) — **zero mocked live voice/calls/games/Relationship Mode dashboards**. |
| **4** | **How Joining Works (*Verification Reframed as Care*)** | Simple, calm `3-to-4` step progression framed around *who gets protected*: `1. Confirm @study.iitm inbox` -> `2. Quiet 18+ & BS check (reviewed carefully—no gov ID needed)` -> `3. Build an authentic profile` -> `4. Mutual match before any message`. Honest expectation note on manual verification timing. | Clean stepped row on `Coal #12161B` linking `"Full rules ->"` to `/eligibility`. Re-sequences current Section 2 *after* product value. | Addresses **Step 6 manual review wait surprise** & **Toma/Hancock (2010)** authenticity assurance *without* intimidating tone (`Acquisti et al., 2015`). |
| **5** | **Community Scope & Real Privacy Boundaries** | Compact overview of the **4 approved BS tracks** (`Data Science & Applications`, `Electronic Systems`, `Aeronautics & Space Tech`, `Management & Data Science`) paired cleanly with **3 unmistakable dignity rules**: `18+ verified peers only`, `Mutual match required to message`, `Coarse city only & private R2 photos (never ads/training)`. | Compact 2-column comparison + link to `/safety` (*Safety Architecture*). Keeps full spec deep-dives on `/eligibility` and `/safety`. | Satisfies `Doc 01 §03`, `AGENTS.md`, `Segment D` safety concerns cleanly. |
| **6** | **Closing Invitation + Natural Cohort Share** | Quiet closing band: **"Ready when you are."** Primary `Create Account` CTA + secondary **Peer Share card** (*"Know someone in the BS programme who prefers something calmer?"* -> `Copy link` / `Share`). Explicit independent notice (`SayMyName.in is independent; not owned/endorsed by IIT Madras`). | Balanced 2-pane band above `PublicFooter.tsx` anchored by `Void -> Coal` transition. | Activates `Segment E` organic WhatsApp/Telegram referrals safely without fake countdowns or referral bribes. |

---

## 3. Recommended Positioning & Headline Directions (Options for Human Choice)

Working strategic direction: **"Same world. Different cities. A chance to meet."**  
Below are `3` tested structural options aligned cleanly with Document 10 copy principles (`no dramatic clichés`, `human & precise`):

| Option | Headline | Accompanying Subcopy Direction | Best Strategic Strength | Tradeoff / Watchout |
|---|---|---|---|---|
| **Option A (Recommended Anchor)** | **Same world. Different cities. A chance to meet.** | *An independent dating space for verified adults (18+) across IIT Madras non-campus BS programmes—designed around real profiles, mutual interest, and unhurried conversation.* | High poetic simplicity (`8` words); unifies remote BS students from Chennai to Ranchi emotionally in `<2s`. | Doesn't explicitly say "IITM BS" inside the H1 itself—relies cleanly on the first line of the subcopy immediately below to signal eligibility. |
| **Option B (Explicit Cohort + Warmth)** | **Built for real connection across your BS world.** | *For verified adult learners (18+) in IIT Madras non-campus BS programmes. Meet peers beyond Discord channels and exam centres—starting with mutual match.* | Instant cohort self-identification in the headline; strong clarity for `Segment E` referred links. | Slightly less timeless/romantic tone than Option A ("your BS world" sounds more programme-bounded). |
| **Option C (Anti-Swipe Contrast)** | **A calmer place to meet someone who shares your world.** | *Independent dating for verified adults (18+) across IIT Madras's four non-campus BS tracks—from cities across India, without swipe fatigue or stranger DMs.* | Speaks directly to **Hinge/Bumble burnout** (`Segment B & C` adults). | Longer (`11` words) -> wraps onto `3–4` lines at `64px` desktop or `375px` mobile; slightly riskier mobile fold height. |

> **Recommendation:** Lead with **Option A** (*"Same world. Different cities. A chance to meet."*) in `A/B` or `5-second` student comprehension testing against **Option B**, paired with explicit *"verified adult learners (18+) in IIT Madras's four non-campus BS programmes"* in line 1 of the subcopy so ineligible outsiders self-filter early without sacrificing romance.

---

## 4. Prioritized Recommendations Matrix (`P0`–`P3`)

| ID | Pri | What Is Wrong | Why It Matters | Proposed Direction | Expected Benefit | Potential Risk | How to Validate |
|---|---|---|---|---|---|---|---|
| `REC-01` | `P0` | Hero shows `"THE INTERVAL ARCHITECTURE v1.0"` wireframe + `"Default-deny access before Discover"` framing | Causes instant misidentification as an engineering/compliance portal; kills romantic desire in first 3 seconds | Replace Hero schematic with Concept 1 sculptural Interval scene + atmospheric editorial photography paired with **Option A** headline (`64–72px` desktop / `40–46px` mobile) | Higher emotional resonance & visitor intent clarity in 5-second impressions | Could drop eligibility clarity -> risk non-BS traffic clicking CTA | 5-second comprehension tests (`n >= 10` IITM BS + `5` non-BS controls) + ineligible-domain error tracking |
| `REC-02` | `P0` | Zero visual preview of `Discover`, prompts, matches, or `Chats` on `/` | Visitors face 5 gated steps + manual ops queue without ever seeing the reward | Add clearly labelled illustrative product preview section (`Discover` card + prompt + match-to-chat transition) covering live Phase 3 capabilities only | Higher willingness to complete OTP, age, and enrolment steps | Risk of overpromising if deferred Phase 4 features appear in mockups | Strict Phase 3 capability parity check + onboarding start-to-finish funnel telemetry |
| `REC-03` | `P0` | Defensive verification & consent rules occupy Sections 1–2 ahead of value | Triggers premature friction/scrutiny (`Acquisti et al., 2015`); reads like legal policy (`Tuch et al., 2012`) | Move verification steps *below* value & product preview; reframe from "Default-deny gates" to transparent member-protection care + honest manual-review note | Better funnel progression & lower anxiety for `Segment D` and `C` users | Insufficient upfront clarity on manual wait -> impatience at `review` screen | Monitor `/onboarding` Step 4->5 retention & qualitative interviews on expectation setting |
| `REC-04` | `P0` | Hero displays `3` competing CTAs (`Create Account`, `Explore Eligibility`, `Member Sign In →`), causing CTA dilution & 3-line stacking on `375px` mobile | Splits visitor focus and pushes focal visual off-screen (`375px`) or slices it at bottom (`390px`) | Consolidate to `1` Primary CTA (`Create Account`) + `1` secondary anchor/text action; unify Navbar `Register` -> `Create Account` | Cleaner visual hierarchy, improved mobile fold balance, faster CTA location | Returning users take 1 extra glance to spot `Sign In` in Navbar | Viewport visual checks (`375–1440px`), task-time to locate `Create Account` vs `Sign In` |
| `REC-05` | `P1` | Zero OpenGraph (`og:image`, `og:title`), zero per-route metadata, `/sitemap.xml` `404` | WhatsApp/Telegram peer shares render naked URLs without warmth or credibility (`Berger & Milkman, 2012`) | Implement dynamic/static OG cards (`1200×630` Mineral Night), per-route `metadata`, `app/robots.ts`, `app/sitemap.ts` + subtle peer-share section | Stronger peer referral click-through (`Segment E`) and clean search indexing | Public OG card might imply IITM endorsement if carelessly phrased | Validate rendered previews in WhatsApp/Telegram/OpenGraph debugger + copy compliance check |
| `REC-06` | `P1` | Anonymous `/` visitors trigger `401` console error (`GET /api/auth/me`, `~2s` lag) & `Instrument Sans` loads redundantly twice externally | Wastes initial connection/render budget & pollutes DevTools on clean guest visits | Self-host `Instrument Sans` (`woff2` via `next/font/local` + SIL OFL license) and skip unauthenticated `/api/auth/me` 401 noise on public pages (or handle `200 { authenticated: false }` / SSR cookie check cleanly) | Zero guest console errors, faster FCP/LCP reliability on rural mobile connections | Need careful BFF review so auth detection on SSR never caches private cookies publicly (`Cache-Control: private, no-store`) | Check `audit.py` telemetry + Chrome DevTools zero-error verification + `PHASE3_1` BFF safety tests |
| `REC-07` | `P1` | Zero funnel telemetry exists (`0` analytics events in `apps/web`) | Cannot prove whether Editorial Romance improves sign-ups or creates confused non-IITM bounces | Add minimal, cookie-less, DPDP-compliant anonymous funnel events (`lp_cta_clicked`, `lp_share_clicked`, `onboarding_stage_entered`) | Data-driven Phase 5/6 optimization without dark patterns or PII leakage | Any analytics script violates privacy/security trust if improperly configured | Security & legal counsel gate (`Doc 01 §01` / `security-privacy.md`) before production enablement |
| `REC-08` | `P2` | Next.js `next.config.mjs:14` retains legacy `NEXT_PUBLIC_API_ORIGIN`, `layout.tsx` misses `#main` skip-link, eyebrow micro-copy uses `11px` uppercase | Minor technical & WCAG 2.2 AA polish debt (`Doc 10 §09/§19`) | Add visible skip-link, enforce `>=12px` minimum metadata readability, clean legacy `next.config.mjs` env fallback | Full WCAG 2.2 AA keyboard & dark-screen legibility conformance | Low risk | Automated a11y + keyboard tab walkthrough at desktop & mobile |
| `REC-09` | `P3` | Interactive `Three.js` 3D upgrade vs static raytraced `AVIF` hero still | Avoid unnecessary runtime risk during repositioning | Ship **Phase 2–4 with Option A (Static Blender-rendered `AVIF` + crisp `180–260ms` CSS transitions)**; evaluate lazy desktop `Three.js` (`>=1024px`) strictly as a later enhancement | Guarantees `<2.5s` LCP & `<200ms` INP on budget Android phones | Static still feels slightly less playful than desktop mouse-parallax | Measure real Android 4G/5G performance before ever enabling WebGL |

---

## 5. Phased Next Steps (Phases 1 to 6 Preview)

- **Phase 1 (IA, Copy & Wireframe Specification):** Draft exact headline/subcopy variants, 7-band wireframe responsive specs (`1440px -> 375px`), art-asset prompts/renders for Concept 1 (*Two Lights Across the Interval*), and finalize `og:image` specs — followed by human approval + quick 5-second/interview checks with real BS students.
- **Phase 2 (Public Infrastructure & Metadata Foundation):** Self-host `Instrument Sans`, fix guest `/api/auth/me` `401` noise safely, add `metadataBase` / OpenGraph / `sitemap.ts` / `robots.ts` / skip-link.
- **Phase 3 (Design & Build New `/` Page Composition):** Build the 7-band Editorial Romance landing page behind verified Document 10 tokens + clearly labelled Phase 3 illustrative `Discover`/`Match`/`Chat` preview components + Peer Share CTA.
- **Phase 4 (Asset Integration & Responsive Polish):** Integrate `AVIF`/`WebP` Concept 1 focal render & commissioned human scene photography; test across all `6` viewports (`1440`, `1280`, `768`, `430`, `390`, `375`) + `prefers-reduced-motion` + low-brightness legibility.
- **Phase 5 (Verification, A11y & Performance Gate):** Run full Playwright/Lighthouse/WCAG 2.2 AA checks confirming `<2.5s` LCP, `<200ms` INP, `<0.1` CLS, zero console errors, and exact capability truthfulness.
- **Phase 6 (Controlled Rollout & Funnel Review):** Launch post pre-launch legal sign-off (`Doc 01 §01`), inspect aggregate funnel conversion & onboarding retention, run interview follow-ups.

---

## 6. Open Strategic Decisions Requiring Explicit Human Sign-Off

Per `AGENTS.md` and Document 09, Antigravity **cannot** finalize these choices unilaterally:
1. **Final Hero Headline Choice:** Approve **Option A** (*"Same world. Different cities. A chance to meet."*), **Option B**, **Option C**, or supply custom approved copy.
2. **3D Focal Concept Choice (`Concept 1` vs `Concept 2` vs `Concept 3`):** Approve whether Phase 1 hero uses *Concept 1: Two Lights Across the Interval* static raytraced `AVIF` + subtle CSS motion, or prefers real atmospheric campaign photography paired with smaller Interval artwork.
3. **Human Photography Source:** Confirm whether to commission authentic photography / licensed editorial human scenes (and verify licensing & zero stock-profile impersonation risk).
4. **Navbar Link Repositioning:** Approve shifting header visitor links from `Eligibility Guide` + `Safety & Consent` to `How It Works`, `Eligibility`, `Safety` and unifying `Register` -> `Create Account`.
5. **Privacy-Safe Funnel Analytics & `?src=peer` Link Tag:** Approve scope of anonymous funnel event collection (`Section 4` of Conversion Audit) and whether to deploy with pre-launch legal counsel review (`Doc 01 §01`).
6. **Communication of Deferred Features (`Audio Calls`, `Games`, `Virtual Dates`, `Relationship Mode`):** Confirm whether to omit them entirely from `/` until Phase 4+ completes live client integration (recommended for maximum honesty) or include a concise, clearly labelled *"Coming next"* note.
