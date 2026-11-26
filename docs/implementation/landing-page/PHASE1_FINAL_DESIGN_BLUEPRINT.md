# Phase 1 Final Design Blueprint & Phase 2 Handoff — SayMyName.in

**Project:** SayMyName.in — The First Impression Project  
**Phase:** 1 of 6 (Positioning, Messaging, Content Architecture & Wireframing)  
**Baseline:** `landing-page-repositioning` @ `9e1a58d`  
**Status:** Complete Phase 1 Strategy & Wireframe Blueprint — **Awaiting Human Approvals (`DEC-LP-01..05`) Before Phase 2 Execution**.

---

## 1. Strategic Blueprint Summary

This handoff unifies all six Phase 0 audit reports and the eight sibling Phase 1 documents into a single implementation-ready specification:

- **Strategic Repositioning:** Pivot from an institutional security portal (`"THE INTERVAL ARCHITECTURE v1.0"` / `"Default-deny access before Discover"`) to **Editorial Romance** (*"Same world. Different cities. A chance to meet."*), grounded in Document 10's *Mineral Night* dark visual language and `Instrument Sans` typography.
- **5-Second Category Promise:** Unfamiliar visitors immediately recognize SayMyName as an **independent dating platform** (`"Dating for verified 18+ IIT Madras BS students"`) for adults across the four approved non-campus BS programmes—before ever confronting verification checklists.
- **Honest Capability Fidelity (`9e1a58d` Baseline):** Every product claim and UI preview depicts strictly live verified flows (`Registration + Email OTP` -> `Manual 18+/BS Review` -> `Profile Onboarding + Private R2 Portraits` -> `Discover` -> `Likes` -> `Mutual Match` -> `Unmatch/Block/Report` -> asynchronous `1:1 Text Chats`). Zero deferred Phase 4+ stubs (WebSocket instant chat, voice notes, LiveKit audio calls, mini-games, virtual dates UI, Relationship Space UI, native mobile apps) appear on `/`.

---

## 2. Consolidated Page Structure & Responsive Blueprint Map

| Band | Section Name | Emotional Job | Core Content Summary (`PROPOSED`) | Desktop (`1440/1280`) Layout | Tablet / Mobile (`768 / 430 / 390 / 375`) Layout | Source Doc Cross-Link |
|---:|---|---|---|---|---|---|
| **0** | **Header (`Navbar`)** | Clean navigation parity | `SayMyName` Lockup · `How It Works` (`/#how-it-works`) · `Eligibility` (`/eligibility`) · `Safety` (`/safety`) · `Sign In` (`/login`) · **`Create Account`** (`/onboarding`) | Sticky `66px`, horizontal single bar | `64px` desktop links @768; `60px` `Logo + Sign In + Drawer` @`<=430px` | [IA Spec](file:///i:/saymyname-landing/docs/implementation/landing-page/PHASE1_INFORMATION_ARCHITECTURE_AND_NAVIGATION.md) |
| **1** | **Hero (*The First Impression*)** | Curiosity + Dating clarity | Eyebrow + H1 `"Same world. Different cities. A chance to meet."` + concise subcopy + **`Create Account`** + `See how it works ↓` + `1`-line independent eligibility/trust note + Hero paired visual (`3D-01 + IMG-01`) | `12-col` asymmetrical split (`7:5`), `64px`/`58px` H1, full `720px` fold fit | `768`: wide stacked `16:9` art; `375`: `38px` H1 + concise 3 lines + CTA + `16:9` crop **all inside `667px` fold!** | [Content & Copy](file:///i:/saymyname-landing/docs/implementation/landing-page/PHASE1_CONTENT_ARCHITECTURE_AND_COPY.md) |
| **2** | **Across Cities & Screens** | Belonging | *"You share the same term. Just rarely the same city."* + 2 warm paragraphs on study-vs-dating separation + `IMG-02` | `12-col` split (`5` image left : `7` prose right) on `Coal` | Photo-first vertical stack + scannable `15px` editorial prose | [Desktop Wireframes](file:///i:/saymyname-landing/docs/implementation/landing-page/PHASE1_DESKTOP_WIREFRAMES.md) |
| **3** | **Inside SayMyName (`#inside-saymyname`)** | Possibility & Proof | Tabbed/interactive UI showcase (`Discover` sample card `Ananya, 22`, `Mutual Match` alignment, `Private 1:1 Chat`) captioned `Sample product preview · Illustrative` | `12-col` split (`5` selector rail : `7` interactive Coal frame) | Compact 3-tab switcher (`Discover` \| `Match` \| `Chat`) over single `100%` card frame | [Content & Copy](file:///i:/saymyname-landing/docs/implementation/landing-page/PHASE1_CONTENT_ARCHITECTURE_AND_COPY.md) |
| **4** | **How Joining Works (`#how-it-works`)** | Confidence & Process Transparency | `01` BS Inbox & OTP -> `02` 18+ Check -> `03` BS Track *(no gov ID)* -> `04` Draft During Manual Review -> `05` R2 Portrait & Discover + `/eligibility` link | `5`-step horizontal timeline rail on `Coal` + expectation callout | `2×3` @768; crisp vertical `01..05` numbered stepper @mobile | [IA Spec](file:///i:/saymyname-landing/docs/implementation/landing-page/PHASE1_INFORMATION_ARCHITECTURE_AND_NAVIGATION.md) |
| **5** | **The Shared Community (`#community`)** | Shared Cohort Pride | *"Four non-campus BS tracks. One shared community."* — clean ruled ledger listing official names (`BS-DSA`, `BS-ES`, `BS-AST`, `BS-MDS`) + `Foundation·Diploma·Degree` | `12-col` ledger (`4` title left : `8` ruled tracks right) on `Void` | Compact vertical hairline-separated rows (zero heavy cards) | [Desktop Wireframes](file:///i:/saymyname-landing/docs/implementation/landing-page/PHASE1_DESKTOP_WIREFRAMES.md) |
| **6** | **Trust & Personal Control** | Psychological Safety | 3 calm member promises (`Verified 18+ community`, `Private chat on mutual match`, `Coarse city, private R2, Unmatch/Block anytime`) + `/safety` link | `3` equal `4-col` architectural columns on `Coal` | `3` cleanly stacked blocks (`16px` gap) | [Conversion & Sharing](file:///i:/saymyname-landing/docs/implementation/landing-page/PHASE1_CONVERSION_AND_SHARING_SPECIFICATION.md) |
| **7** | **Invitation & Share (`#share`)** | Final Action & Organic Growth | *"There are people in your world you haven't met yet."* + single **`Create Account`** CTA + Peer-Share card (`Share SayMyName` -> `?src=peer`) | `12-col` split (`7` Finale left : `5` Peer Share card right) on `Void` | Stacked Final CTA (`w-full`) above compact Share block | [Mobile Wireframes](file:///i:/saymyname-landing/docs/implementation/landing-page/PHASE1_MOBILE_AND_TABLET_WIREFRAMES.md) |
| **8** | **Footer (`PublicFooter`)** | Governance & Non-Affiliation | Preserved 4-column architecture (`Overview`, `How It Works`, `Eligibility`, `Safety`, `Access`, `Privacy`, `Terms`, `Support`) + IITM non-affiliation note | `4-column` grid (`260px`) on `Coal` | `2×2` @768; clean vertical stack @mobile | [IA Spec](file:///i:/saymyname-landing/docs/implementation/landing-page/PHASE1_INFORMATION_ARCHITECTURE_AND_NAVIGATION.md) |

*Interactive Reference Preview:* Open [wireframe-prototype.html](file:///i:/saymyname-landing/docs/implementation/landing-page/wireframe-prototype.html) in any browser to inspect all 7 bands across desktop, tablet, and mobile dimensions directly without modifying Next.js application code.

---

## 3. Master Technical, Asset & Metadata Targets for Phase 2 (`Pending Decision Approvals`)

1. **Public Foundation Infrastructure Fixes (Identified in Phase 0):**
   - Self-host `Instrument Sans` (`woff2` + SIL OFL 1.1 attribution) via `next/font/local` or CSS, removing double Google Fonts stylesheet/import requests.
   - Stop anonymous `401` console error (`GET /api/auth/me` BFF fast-path check without caching private cookies).
   - Ship distinct per-route `metadata` (`<title>`, `description`, `canonical`, `og:*`, `twitter:card`) + `1200×630` `/og-saymyname.png` + `app/sitemap.ts` + `app/robots.ts`.
   - Add accessible `#main` skip-link and enforce `12px` minimum text floor across every landing micro-label.
2. **Asset Commission & Export Plan (`4` Total Unique Assets):**
   - `3D-01`: *Two Lights Across the Interval* static Cycles render (`10-bit AVIF` + `WebP`, dark-banding checked; test desktop `65–140 KB` & mobile `35–70 KB`). Zero Three.js/Spline bundles.
   - `IMG-01`, `IMG-02`, `IMG-03`: Authentic adult `18+` editorial scenes + explicitly cleared illustrative `Discover` demo portrait (`Sample product preview · Illustrative profile` badge mandatory).
3. **Performance & Accessibility Non-Negotiables:**
   - Core Web Vitals targets: **`LCP < 2.5s`**, **`INP < 200ms`**, **`CLS < 0.1`** on mobile 4G.
   - `WCAG 2.2 AA` contrast (`>= 4.5:1` body / `>= 3:1` large), full keyboard tab/arrow accessibility on Section 03 preview tabs, and complete `prefers-reduced-motion` static parity.

---

## 4. Complete Phase 1 Deliverables Directory Index (`docs/implementation/landing-page/`)

1. [PHASE1_POSITIONING_AND_MESSAGING_STRATEGY.md](file:///i:/saymyname-landing/docs/implementation/landing-page/PHASE1_POSITIONING_AND_MESSAGING_STRATEGY.md)
2. [PHASE1_CONTENT_ARCHITECTURE_AND_COPY.md](file:///i:/saymyname-landing/docs/implementation/landing-page/PHASE1_CONTENT_ARCHITECTURE_AND_COPY.md)
3. [PHASE1_INFORMATION_ARCHITECTURE_AND_NAVIGATION.md](file:///i:/saymyname-landing/docs/implementation/landing-page/PHASE1_INFORMATION_ARCHITECTURE_AND_NAVIGATION.md)
4. [PHASE1_DESKTOP_WIREFRAMES.md](file:///i:/saymyname-landing/docs/implementation/landing-page/PHASE1_DESKTOP_WIREFRAMES.md)
5. [PHASE1_MOBILE_AND_TABLET_WIREFRAMES.md](file:///i:/saymyname-landing/docs/implementation/landing-page/PHASE1_MOBILE_AND_TABLET_WIREFRAMES.md)
6. [PHASE1_3D_AND_PHOTOGRAPHY_ASSET_SPECIFICATION.md](file:///i:/saymyname-landing/docs/implementation/landing-page/PHASE1_3D_AND_PHOTOGRAPHY_ASSET_SPECIFICATION.md)
7. [PHASE1_CONVERSION_AND_SHARING_SPECIFICATION.md](file:///i:/saymyname-landing/docs/implementation/landing-page/PHASE1_CONVERSION_AND_SHARING_SPECIFICATION.md)
8. [PHASE1_DECISION_REGISTER.md](file:///i:/saymyname-landing/docs/implementation/landing-page/PHASE1_DECISION_REGISTER.md)
9. `PHASE1_FINAL_DESIGN_BLUEPRINT.md` *(this document)*
10. [wireframe-prototype.html](file:///i:/saymyname-landing/docs/implementation/landing-page/wireframe-prototype.html) *(Isolated low-fidelity interactive wireframe reference)*

---

## 5. Phase 2 Readiness Gate

Before starting **Phase 2 (Creative Production, High-Fidelity Prototype & Technical SEO Setup)**, confirm human sign-off on `DEC-LP-01` through `DEC-LP-05` inside `PHASE1_DECISION_REGISTER.md` (Headline Candidate A, Hero Paired Focal Direction, Header Navigation Links, Strict Omission of Phase 4+ Stubs, and Legal-Gated Cookie-Less Funnel Analytics) — plus optional 5-second student comprehension check using `wireframe-prototype.html` / Candidate A vs Candidate B.
