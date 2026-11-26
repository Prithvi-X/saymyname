# Phase 0 Requirements, Constraints & Epistemic Traceability Matrix — SayMyName.in

**Workstream:** The First Impression Project — Landing Page Repositioning & Conversion Redesign  
**Phase:** 0 of 6 (Research, Audit & Discovery)  
**Purpose:** Establish strict separation between binding product/architecture/brand constraints, verified capabilities at baseline `9e1a58d`, design direction preferences, academic research recommendations, unvalidated hypotheses, and human approval gates.

---

## 1. Authoritative Hierarchy & Source Documents

1. **Product Scope, Safety & Eligibility Authority:** Documents `01` (`Phase 1 Product Constitution & PRD`), `02`, `04`, `DECISION_REGISTER.md` (`D-01..D-P2-05`), `AGENTS.md`, `.agents/rules/{product-boundaries.md, security-privacy.md}`.
2. **Brand & Visual System Authority:** Document `10` (`Brand Identity & Digital Design Language — THE INTERVAL`), superseding Document `03` where aesthetic style conflicts, while Document `03` retains IA, accessibility, and responsive rules.
3. **Architecture, Engineering & Delivery Authority:** Documents `05`, `06`, `07`, `08`, `09`, `ADR-016`–`ADR-020`, and verified acceptance records `docs/implementation/PHASE3_1..3_4`.

---

## 2. Category A — Non-Negotiable Approved Product & Policy Constraints

| Constraint ID | Rule / Requirement | Source | Landing Page & Growth Impact |
|---|---|---|---|
| `PROD-01` | **Strict 18+ Adult Boundary (`AGE-01`)** — No under-18 user may ever access dating features, even if admitted to IITM BS Foundation. | `Doc 01 §03`, `product-boundaries.md`, `packages/validation` | Hero/footer/FAQ must never invite minors or market "college teens"; eligibility check must be plainly honest. |
| `PROD-02` | **Four Approved Phase 1 BS Programmes Only** — Data Science & Applications; Electronic Systems; Aeronautics & Space Technology; Management & Data Science (`Foundation`, `Diploma`, `Degree`). No other universities, on-campus IITM (`@iitm.ac.in`), alumni, or MOOC/qualifier accounts. | `Doc 01 §03`, `D-01`, `D-02`, `D-P2-03` | Cannot broaden landing-page target copy to "all college students in India" or "all IIT Madras students". |
| `PROD-03` | **Explicit IITM Non-Affiliation** — SayMyName.in is an independent product; never imply IIT Madras owns, operates, verifies, or endorses it. | `Doc 01 §01`, `AGENTS.md` | Preserve independent disclaimer in Hero/Footer and OG share cards; never use IITM crest/logos. |
| `PROD-04` | **Email Suffix Never Auto-Verifies (`VER-01`, `VER-02`)** — `@study.iitm.ac.in` / `@ds.study.iitm.ac.in` / `@es.study.iitm.ac.in` confirms domain ownership only; manual reviewer approval (`ReviewerGuard`) gates `Discover` in production. Zero Gov ID collection (`D-P2-01`). | `ADR-017`, `D-P2-01`, `ManualReviewStudentEnrolmentAdapter` | Never promise "instant approval" or "Aadhaar/ID verification" or "IITM SSO login". |
| `PROD-05` | **Dating-First Boundaries (`No Surveillance / No Roulette / No Stranger DMs`)** — Mutual match required before messaging; bilateral consent for calls/games/dates; mutual opt-in + unilateral exit in Relationship Mode; no public feed, no default call recording, no exact GPS tracking, no ad/AI training on private content. | `Doc 01 §04`, `Doc 04`, `product-boundaries.md` | Must remain visibly truthful on `/` & `/safety`; growth loop cannot unlock DMs or Discover shortcuts via referrals. |
| `PROD-06` | **Zero Fake Social Proof, Fake Scarcity, or Dark Patterns** — Never invent member counts, waiting-list numbers, testimonials, countdowns, or AI compatibility scores (`MATCH-15`). | `Doc 10 §05`, `AGENTS.md`, `security-privacy.md` | No `"Join 5,000 students"` badges unless backed by verified consented metrics; no `"3 spots left"` urgency banners. |
| `PROD-07` | **Pre-Launch Legal Counsel Gate** — Formal written counsel review on *Online Matrimonial and Dating Services (Promotion and Regulation) Bill, 2026* (Rajya Sabha Bill No. VIII of 2026), DPDP Act/Rules, and IT Rules required before public launch; `/privacy` and `/terms` explicitly note legal review pending; never hardcode invented support emails (`D-P2-05`). | `Doc 01 §01`, `D-P2-05`, `privacy/page.tsx`, `terms/page.tsx` | Keep `Privacy`, `Terms`, `Support` honest & synced; do not bypass legal review milestone for public campaigns. |

---

## 3. Category B — Approved Document 10 Visual, Motion & Accessibility Constraints

| Constraint ID | Rule / Requirement | Source | Implication for Redesign |
|---|---|---|---|
| `BRAND-01` | **Mineral Night Palette & Token Discipline** — `Void #0B0D10` (`75–88%`), `Coal #12161B`, `Iron #1A2027`, `Slate #252D37`, `Edge #343D48`; `Chalk #F0F1EE` / `Silver #B6BDC4` / `Ash #8B949E`; `Iris #8580C4` (`2–5%`); `Ember #E18A62` (`0–2%`). | `Doc 10 §07–08`, `tokens.css` | Editorial Romance must stay dark cinematic (*Mineral Night*) — **do not** revert to warm ivory, oxblood, pastel waves, or purple-blue mesh gradients. |
| `BRAND-02` | **Neo-Grotesk Typography (`Instrument Sans`)** — Primary family across UI (`64–76px` desktop hero / `42–50px` mobile hero; `>= 12px` minimum metadata; sentence case labels; `woff2` + SIL OFL 1.1 attribution if bundled). | `Doc 10 §09` | Raise H1 from `46.5px` (`28.13px` mobile) into editorial `64–72px` (`40–46px` mobile) range; keep `Instrument Sans`; eliminate double Google Font fetch. |
| `BRAND-03` | **Wordmark (`SayMyName`) & Interval Symbol** — Preserve internal caps; keep architectural non-pill geometry (`0/4/6–8/10–12px` radii; **zero `999px` capsule navs or buttons**). | `Doc 10 §06, §11`, `Button.tsx`, `Logo.tsx` | All CTAs, cards, tabs, and badges stay architectural rectangular (`6–8px` / `10–12px`); no pill navbars or capsule tags. |
| `BRAND-04` | **Photography & Synthetic Demo Honesty** — Real human presence without stock clichés or purple/blue face tinting; **never present AI-generated/stock faces as verified real members**; visibly label any illustrative preview profiles as synthetic sample UI. | `Doc 10 §13` (`L992–1037`) | Product demonstration cards on `/` must explicitly carry a subtle `"Sample preview"` / illustrative framing. |
| `BRAND-05` | **Accessibility (`WCAG 2.2 AA`), Reduced Motion & Performance** — `>= 4.5:1` text / `>= 3:1` large text, keyboard focus visibility, no swipe/hover-only controls, static `prefers-reduced-motion` parity, **do not bundle heavy 3D runtimes into routine member routes** (`/discover`, `/chats`). | `Doc 10 §15, §19`, `Doc 03` | Targets `< 2.5s` LCP, `< 200ms` INP, `< 0.1` CLS; static Blender `AVIF` + lightweight CSS beats Three.js/Spline for v1 mobile safety. |

---

## 4. Category C — Verified Technical & Product Truth Boundaries (`9e1a58d`)

| Truth ID | Actual Codebase State at `9e1a58d` | What `/` Can Market Today | What `/` Must NOT Claim Today |
|---|---|---|---|
| `TECH-01` | Registration, Email OTP, 18+ DOB check, 4-Track Enrolment Case, Draft + Private R2 Portrait Upload, `Discover`, `Likes`, `Matches`, Unmatch/Block/Report are **built & E2E/PG tested** (`PHASE3_1..3_4`). | Verified 18+ IITM BS community; curated profiles with prompts & private R2 photos; Discover -> Likes -> Mutual Match -> Unmatch/Block control. | Instant account activation (manual verification ops queue is required in production). |
| `TECH-02` | `1:1 Chats` (`MessagingController` + `/chats`) works via **REST request/response**; **zero `@WebSocketGateway`**, voice notes stubbed (`alert`), LiveKit calls faked client-side (`setTimeout`), Mini-Games/Virtual Dates hardcoded client UI, Relationship Mode Space UI absent, Mobile Expo app is static shell. | Quiet, mutual-match 1:1 text conversations. | "Live real-time push chat / typing", "1:1 voice notes & audio calls", "interactive in-chat mini-games / virtual dates", "live Relationship Mode space", or "iOS/Android app downloads". |
| `TECH-03` | Live `/` currently triggers a guest `GET /api/auth/me` `401` (`~2s`), lacks per-route SEO metadata, OG/Twitter tags, `sitemap.xml` (`404`), `#main` skip-link, and analytics tracking. | N/A (Phase 2 technical hygiene prerequisites). | N/A |

---

## 5. Category D & E — Strategic Direction vs Verified Research Recommendations

| Item | Classification | Summary | Verification / Confidence Level |
|---|---|---|---|
| **Shift from Verification Portal to *Editorial Romance*** | User Strategic Direction (`Section 1` of Brief) + Research Supported | Lead with human connection (*"Same world. Different cities. A chance to meet."*) and place verification/safety after value comprehension. | **High strategic alignment:** supported by `Tuch et al. (2012)`, `Finkel et al. (2012)`, `Acquisti et al. (2015)`. Requires **validation** for IITM BS domain clarity vs non-BS bounce tradeoffs. |
| **Sample Discover + Match + Chat Preview on `/`** | Research Recommendation (`REC-02`) | Show the reward (`Discover` prompt card & mutual match transition) so visitors know what awaits past manual review. | **Supported by:** `Sumter et al. (2017)` (ease of initiating dialogue) & `Gibbs/Ellison (2006)` (warranting cues). Validate comprehension in usability review. |
| **Single Primary CTA + Consolidated Navigation** | Research & Responsive Audit Recommendation (`REC-04`) | Reduce `3` competing Hero CTAs to `1` primary (`Create Account`) + `1` secondary anchor; fix `375px` & `390px` fold cutoff. | **Observed UX problem** on `375×667` / `390×844` live screenshots; validate click-through uplift in telemetry. |
| **Concept 1 (*Two Lights Across the Interval*) via Static `AVIF` (`Option A`)** | Visual & Perf Recommendation (`BRAND` + `REC-09`) | Raytraced `AVIF` sculptural scene preserves Document 10 integrity while guaranteeing `<2.5s` LCP and `<200ms` INP without WebGL bloat. | **Verified perf budgets** & Document 10 constraints; aesthetic emotional pull must be tested against campaign photography in prototype review. |
| **OG Share Card + Non-PII Cohort Invite Loop** | Research Recommendation (`Berger & Milkman, 2012` + Live Gap) | Fix missing OG previews for WhatsApp/Telegram shares + low-friction `Copy/Share link` utility band. | **Verified live gap** (zero `og:*` tags today); organic viral lift remains a **hypothesis** until tracked. |

---

## 6. Category F — Unvalidated Audience Hypotheses (`Must Test Before Lock-In`)

| Hypothesis ID | Hypothesis Statement | How Phase 1 Testing Validates / Refutes It |
|---|---|---|
| `HYP-01` | Standalone non-campus learners (`Segment A`) value "peers who understand the IITM BS world across cities" strongly enough to justify domain/manual verification wait. | User interviews (`Questions 1, 5, 7`) + `review`-stage completion funnel data |
| `HYP-02` | Hybrid/dual-degree (`Segment B`) and working professionals (`Segment C`) reject juvenile campus meme aesthetics and prefer composed *Editorial Romance* (`Option A`). | Concept comparison test (`Question 9`) segmented by age & employment/dual-degree status |
| `HYP-03` | Moving `"Default-deny"` & strict `01–04` gates below the Hero increases `/onboarding` starts **without** surging ineligible `@gmail.com` error rates or eroding `Segment D` women's trust. | 5-second comprehension test (`Questions 3–4`), Trust perception score (`Segment D`), and aggregate ineligible-domain error tracking |
| `HYP-04` | Preparing visitors calmly on `/` for one-time manual age/enrolment review prevents drop-off shock at `/onboarding` `VERIFICATION_PENDING`. | Compare self-reported drop-off expectation (`Question 5`) and funnel transition rate from `student` submit -> profile draft completion |

---

## 7. Category G — Decisions Requiring Human Sign-Off Before Phase 1/2 Execution

No production copy, visual identity asset, route behaviour, or analytics pipeline is finalized in Phase 0. Human approval is required on:
1. **Final Hero Headline (`Option A` vs `Option B` vs `Option C`)** and **Navbar CTA/link naming**.
2. **Primary Visual Strategy (`Concept 1` static Interval `AVIF` vs commissioned editorial human photography vs paired hybrid)** and budget/asset sourcing.
3. **Product Preview Treatment** (exact synthetic sample profile fields & explicit non-mocking policy for deferred Phase 4 features).
4. **Lightweight Funnel Analytics (`Section 4` of Conversion Audit)** + pre-launch legal review readiness (`Doc 01 §01`).
