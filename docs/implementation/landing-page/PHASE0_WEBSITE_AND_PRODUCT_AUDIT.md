# Phase 0 Website & Product Audit — SayMyName.in

**Workstream:** The First Impression Project — Landing Page Repositioning & Conversion Redesign  
**Phase:** 0 of 6 (Research, Audit & Discovery)  
**Baseline Branch / Commit:** `landing-page-repositioning` @ `9e1a58dd38c173769f46390f06cd07be2859cc54`  
**Live Target Observed:** `https://saymyname.in` (matches baseline `apps/web/app/page.tsx`)  
**Status:** Read-only discovery baseline; zero product code modified.

---

## 1. Executive Summary of Current Website State

> **Epistemic Tag:** *[Observed Fact — Code Inspection & Live DOM Audit]*

SayMyName.in's current landing page (`apps/web/app/page.tsx`) reads and behaves like a **compliance & access-control specification portal** rather than a mature dating product. While the visual theme honors Document 10's *Mineral Night* dark palette (`Void #0B0D10`, `Coal #12161B`, `Iris #8580C4`, `Ember #E18A62`) and `Instrument Sans` typography, its copy, imagery, hierarchy, and section sequencing foreground backend architecture (`"The Interval Architecture"`, `"v1.0"`, `"Default-deny access before Discover"`) while omitting almost every signal of romance, human warmth, peer community, and actual in-app experience (`Discover`, profile prompts, `Chats`, `Relationship Mode`).

Key quantitative baseline observations (`https://saymyname.in` & `apps/web/app/page.tsx`):
- **Copy volume & register:** `555` rendered visible words on `/` (`wordCount: 555`); `imgCount: 0`; `svgCount: 6` (primarily navigation mark, button arrows, and an abstract wireframe card).
- **Above-the-fold hierarchy:** `3` competing hero CTAs (`Create Account` -> `/onboarding`, `Explore Eligibility` -> `/eligibility`, `Member Sign In →` -> `/login`) alongside `2` header actions (`Sign In`, `Register` -> `/onboarding`).
- **Performance telemetry (Playwright uncached Chromium 1440×900):** TTFB `160 ms`, FCP `1236 ms`, LCP `1236 ms` (text H1), CLS `0.00057`, initial CSS transfer `11.4 KB` (`cd0a115f10665c52.css`). However, Google Fonts loads CSS redundantly via both `<link>` (`apps/web/app/layout.tsx`) and `@import` (`packages/design-tokens/styles/tokens.css`), and anonymous visitors trigger an unauthenticated `401` console error (`GET /api/auth/me`, `~2027 ms`) on first paint.
- **SEO & discoverability:** Global fallback `<title>` (`"SayMyName.in — For verified IIT Madras non-campus BS students"`) repeats verbatim across `/`, `/eligibility`, `/safety`, `/privacy`, `/terms`, `/support`, `/login`, and `/onboarding`. Zero `openGraph`, `twitter`, or `canonical` metadata exists, and `/sitemap.xml` returns `404`.

---

## 2. Architecture & Visual Impression Audit: Current Route Inventory

*[Observed Fact — `apps/web/app/` Inspection & Live HTTP Checks]*

| Route | HTTP Status | Purpose Today | Visual Tone | Strategic Assessment |
|---|---:|---|---|---|
| `/` | `200` | Primary public landing page (`HomePage`) | Schematic / Policy-led | Leads with access gates & wireframe diagram; needs *Editorial Romance* repositioning |
| `/eligibility` | `200` | Document 01 §3 programme & 18+ rules | Specification cards | Clear, truthful reference page; right place for detailed cohort rules |
| `/safety` | `200` | Server guard & consent breakdown (`CTRL-01`..`06`) | Technical audit cards | Strong trust reference; currently duplicated prematurely on `/` |
| `/privacy` | `200` | Data handling notice (pre-launch legal review flagged) | Structured dark cards | Truthful & clean; preserves pre-launch disclaimer |
| `/terms` | `200` | Eligibility & conduct rules (pre-launch review flagged) | Structured dark cards | Truthful & clean |
| `/support` | `200` | Self-service password reset & verification status help | Structured dark cards | Dynamically handles unconfigured `SUPPORT_EMAIL` without fake addresses |
| `/login` | `200` | Email + password member sign-in | Clean card over `smn-ambient-calm` | Functional; direct entry for returning users |
| `/register` | `200` -> `/onboarding` | Server redirect (`RegisterRedirectPage`) | N/A | Prevents 404, forwards `stage=otp`, `email`, `returnUrl` |
| `/onboarding` | `200` | 5-step registration -> OTP -> Age -> BS Track -> Review -> Profile | Multi-stage dark stepper | Deep procedural funnel; heavy pre-value wall if visitor isn't already motivated |
| `/forgot-password`, `/reset-password` | `200` | Recovery flows | Clean auth cards | Supporting utility routes |
| `/design-system` | Env-gated | Document 10 showcase (`404` in production by default) | Reference showcase | Non-public utility |
| `/robots.txt` / `/sitemap.xml` | `200` (edge) / `404` | Crawler directives | N/A | Repo lacks `app/robots.ts` and `app/sitemap.ts`; `/sitemap.xml` returns Next `404` |

---

## 3. Codebase-Truth Capability Matrix (`9e1a58d`)

Every public landing-page claim must reflect what is **actually built, verified, and usable** in `9e1a58d`, honoring `AGENTS.md` and Document 09 honesty boundaries.

*[Observed Fact — Repository Modules & `PHASE3_1..3_4` Audit Reports]*

| Capability | Documented (Docs 01–09) | Codebase Implementation Status (`9e1a58d`) | Publicly Usable Without Workarounds? | Phase 1 Landing Page Claim Rule |
|---|---|---|---|---|
| **Auth, Password Login, Email OTP, Recovery** | `AUTH-01`, `ADR-018` | Full NestJS `IdentityModule` + Next BFF `HttpOnly` cookie session + `/login`, `/onboarding`, `/forgot-password`, `/reset-password` | **Env-Dependent** (requires active `RESEND_API_KEY` + verified domain DNS; `PHASE3_1` flagged email DNS verification) | **Marketable (with live email config)** as verified peer sign-up |
| **18+ Age & 4-Track IITM BS Verification** | `AGE-01`, `VER-01`, `VER-02`, `ADR-017` | Separate `ManualReviewAgeAdapter` & `ManualReviewStudentEnrolmentAdapter`; optional non-gov-ID proof (`student_enrolment_letter`, `iitm_portal_screenshot`, `term_fee_receipt`) in private R2; Reviewer API guard | **Manual Ops Review** (accounts stay `VERIFICATION_PENDING` until an operator approves via `ReviewerGuard` API; no instant automated IITM SSO) | **Marketable & Must Be Truthful:** promise curated peer verification; **never** promise "instant AI approval" or government ID checks |
| **Profile Onboarding & Private R2 Portraits** | `PRO-01`, `PRO-02`, `ADR-020` | 5-tab guided builder, R2 presigned upload, FFmpeg HEIC & EXIF strip, signed short-lived image URLs | Yes when `R2_*` env vars active | **Marketable** (emphasize authentic profiles, prompts, coarse city/state only) |
| **Discover Feed, Reciprocal Filters, Like / Pass** | `DIS-01`, `MAT-01` | Implemented & PG/E2E verified (`PHASE3_2`). Note: `maxDistanceKm` is intentionally dormant | Yes | **Core Marketable Product Truth** — highlight real profile browsing across cities & tracks |
| **Likes Inbox (Received / Sent, Withdraw, Like-back)** | `Doc 02 §07`, `Doc 04` | Implemented & PG/E2E verified (`PHASE3_3`) | Yes | **Marketable Product Truth** — calm, reversible expression of interest |
| **Matches & Atomic Block / Unmatch / Report** | `MAT-01`, `SAFE-01`, `MATCH-11` | Implemented & PG/E2E verified (`PHASE3_4`); Concepts & PG row locks verified | Yes | **Marketable Trust Truth** — mutual match before chat, instant safety separation |
| **1:1 Messaging (`Chats`)** | `MSG-01` (`P0`) | **REST CRUD works**, `/chats` implemented. **No WebSocket gateway** (`0` `@WebSocketGateway` in `services/api/src`); updates load on open/send | Usable asynchronously | **Marketable as "Direct mutual-match chat"**; do **not** claim "instant real-time push typing/read indicators" |
| **Voice Notes (`<=60s`)** | `MSG-02` (`P1`) | **Stubbed / Incomplete:** `CallingController` `sendVoiceNote` returns synthetic payload without persisting `Message`; `chats/page.tsx` Mic triggers `alert(...)` | **No** | **DO NOT market as live today** |
| **1:1 Audio Calling (LiveKit)** | `CALL-01` (`P1`) | **Partial Backend / Fake Client:** `CallingService` issues stateless JWTs without SFU eviction (`MATCH-22` partial); `chats/page.tsx` runs fake `setTimeout` | **No** | **DO NOT market as live today** (avoid "talk in audio calls today"; defer or describe strictly as roadmap only if explicitly approved) |
| **Together Space: Mini-Games & Virtual Dates** | `GAME-01`, `DATE-01` (`P1`) | **Backend Implemented / Client Hardcoded:** `chats/page.tsx` renders static placeholder modals (`A G R D N T E I` / `This Saturday, 5:00 PM IST`) and mistakenly mentions `"video chat session"` (`L875`) | **No** | **DO NOT market as live in current web experience** |
| **Relationship Mode (Shared Space, Milestones, Journal, Unilateral Exit)** | `REL-01`, `REL-02` (`P1`) | **Backend Partial / Zero Web Space UI:** `mockProposals` Map in memory; DB mode returns empty `milestones`/`journals`; `chats/page.tsx` only pops a toast on Propose | **No** | **Caution:** State strictly what exists or hold dedicated UI demonstration until Phase 4+ wires real Relationship Space UX, or explain conceptually as a *core philosophy* without faking an interactive showcase of unbuilt screens |
| **Moderation Console & Native Mobile Apps (`iOS`/`Android`)** | `SAFE-02`, `Doc 05` | Backend services only / Expo 198-line static shell (`apps/mobile/App.tsx`) | **No** | **DO NOT market native mobile apps or instant automated moderation** |

---

## 4. Section-by-Section Landing Page Diagnosis (`apps/web/app/page.tsx`)

*[Observed Fact + Design Interpretation]*

| Section (Current Order) | Observed Content & Layout (`page.tsx`) | Diagnosis & Positioning Failure | Priority |
|---|---|---|---|
| **Global Sticky Header** (`Navbar.tsx`) | Logo (`SayMyName`) left; `Eligibility Guide`, `Safety & Consent` mid-left; `Sign In`, `Register` right. Mobile uses hamburger drawer. | Functional and restrained, **but** visitor links reinforce compliance framing (`Eligibility Guide`, `Safety & Consent`) rather than product understanding (`How It Works`, `For BS Students`), and `Register` disagrees verbally with Hero `Create Account`. | `P1` |
| **1. Hero Left** (`L96–135`) | Eyebrow `PHASE 1 · IIT MADRAS NON-CAMPUS BS COHORT` (capsule/rect tag); H1 `Intentional dating across distance, built around verified peers and mutual consent.`; Body cites "4 non-campus BS programmes"; 3 actions (`Create Account`, `Explore Eligibility`, `Member Sign In →`); muted IITM legal footnote. | **Clinical, passive, risk-first framing.** Headline contains zero emotional warmth or first-person romantic agency; looks like an institutional policy memo. Three inline actions dilute conversion hierarchy. | `P0` |
| **1. Hero Right** (`L138–218`) | Card `THE INTERVAL ARCHITECTURE` / `Distance Bridged by Verified Gates` + `v1.0` badge + grey wireframe boxes SVG + 3 metadata rows (`Minimum Eligibility`, `Messaging Gate`, `Shared Continuity`). | **Major positioning liability.** Visitors immediately interpret SayMyName as developer infrastructure, an internal security demo, or a system architecture site. Clipped awkwardly at the fold edge on `390×844` mobile. Zero human presence or product glimpse. | `P0` |
| **2. Verification Sequence** (`L222–259`) | Eyebrow `VERIFICATION SEQUENCE`; H2 `Default-deny access before Discover`; 4 cards numbered `01`–`04` (`Institutional Domain & Password`, `Strict 18+ Adult Eligibility`, `Enrolment Review Boundary`, `Guided Draft & Genuine Portrait`). | **Front-loads friction and defensive jargon (`"Default-deny access"`).** Before a student feels *why* they want to meet someone on SayMyName, Section 2 confronts them with four bureaucratic hurdles and internal engineering terminology. | `P0` |
| **3. Phase 1 Academic Scope** (`L261–297`) | H2 `Four approved IIT Madras non-campus BS cohorts`; 2×2 grid (`BS · DS`, `BS · ES`, `BS · AST`, `BS · MDS`) listing academic subjects (`Flight mechanics`, `Quantitative management`, etc.). | Reads like an admissions brochure rather than explaining *why* a shared academic world creates real conversation, study-sprint empathy, and pan-India connection across cities. | `P1` |
| **4. Consent Commitments** (`L299–337`) | H2 `Built against unwanted contact and coercive design` + 4 governance boxes (`MUTUAL MATCH GATE`, `BILATERAL SHARED SPACES`, `RELATIONSHIP MODE`, `LOCATION & MEDIA HYGIENE`). | Trust principles are genuinely differentiated, **but** phrasing emphasizes threats ("unwanted contact", "coercive design") and **falsely implies bilateral shared spaces (calls/games/dates/journals) are already usable live** when several remain Phase 4+ client stubs. | `P0` |
| **Missing Sections** | None present for: (a) Product visual preview (`Discover` profile card, prompt answer, `Chats`), (b) Emotional value of connecting across distance, (c) Natural invite-a-peer / cohort growth touchpoint, (d) Crisp FAQ / Objection handling before `/onboarding`. | Leaves eligible visitors wondering *"What do profiles look like? Who is actually here? Will my friend know about this?"* | `P0` |
| **Footer** (`PublicFooter.tsx`) | Clean 4-column grid (`SayMyName` bio + IITM disclaimer, `Platform`, `Access`, `Governance`). | Balanced and compliant; retain IITM non-affiliation clarity and `Privacy` / `Terms` / `Support` structure. | `P3` |

---

## 5. Multi-Viewport Above-the-Fold Audit (6 Target Viewports)

Captured directly against live `https://saymyname.in` via headless Chromium (`audit_metrics.json` + screenshots in scratch workspace).

*[Observed Fact — Live Browser Measurements]*

| Viewport | `vw × vh` | Scroll Height (`Ratio`) | Horizontal Overflow? | H1 Size & Rect (`top..bottom`) | Primary CTA (`Create Account`) Rect | Hero Schematic Card Rect | What Fits Above the Fold & Visual Verdict |
|---|---|---:|---|---|---|---:|---|
| **Desktop Wide** | `1440 × 900` | `2346 px` (`2.61×`) | `No` (`1440`) | `46.5 px` (`216..329`) | `483..531` (`100%` visible) | `256..444` (`100%` visible) | Header + Headline + Body + 3 CTAs + Disclaimer + `THE INTERVAL ARCHITECTURE` card + Section 2 header (`Default-deny access before Discover`) peek into view. **Dominated by schematic tech box & "Default-deny" preview.** |
| **Laptop** | `1280 × 720` | `2346 px` (`3.26×`) | `No` (`1280`) | `46.5 px` (`216..329`) | `483..531` (`100%` visible) | `256..444` (`100%` visible) | Cleanest current composition; **zero** Section 2 peek, balanced margins, but entire right half (`788..1181`) is the cold `v1.0` architecture diagram. |
| **Tablet Portrait** | `768 × 1024` | `3276 px` (`3.20×`) | `No` (`768`) | `33.75 px` (`179..254`) | `408..456` (`100%` visible) | `660..960` (`100%` visible) | Stacks vertically (`grid-cols-1`). Huge vertical dead zone (`456..660`) under disclaimer; SVG schematic inflates to `650×300 px` like a system blueprint poster. |
| **Large Mobile** | `430 × 932` | `4211 px` (`4.52×`) | `No` (`430`) | `28.13 px` (`119..210`) | `405..453` (`100%` visible) | `717..873` (`partly`, bottom spec rows cut off) | Copy + 3 wrapping CTAs push the schematic card to `y=717`, slicing off its bottom metadata rows at `y=932`. |
| **Standard Mobile** | `390 × 844` | `4448 px` (`5.27×`) | `No` (`390`) | `28.13 px` (`136..257`) | `477..525` (`100%` visible) | `803..942` (**clipped in half** at `844`) | **Worst awkward crop:** only the header `THE INTERVAL ARCHITECTURE / v1.0` and top edge of the diagram peek at the bottom (`803..844`), looking unfinished. `Explore Eligibility` + `Member Sign In` wrap onto line 2. |
| **Compact Mobile** | `375 × 667` | `4613 px` (`6.92×`) | `No` (`375`) | `28.13 px` (`136..257`) | `477..525` (`100%` visible) | `866..998` (`0%` visible — below fold) | Text-only fold: eyebrow (2 lines) + 4-line H1 + 5-line subcopy + 3 vertically stacked CTA rows fill the entire `667 px` screen. Almost `7×` viewport vertical scroll (`4613 px`). |

### Scoring the 10 Mandatory Above-the-Fold Questions (`https://saymyname.in` Today)

1. **What is this?** *Partially clear* — says "Intentional dating across distance", but right-side visual looks like a distributed systems gateway (`v1.0`).
2. **Who is it for?** *Over-clear* — 18+ IIT Madras non-campus BS cohort appears in header, eyebrow, body, card, and footer (`5×` repetition).
3. **Why should I care?** *Weak* — mentions "distant remote degrees", fails to articulate the human thrill, shared culture, or emotional relief of actually meeting peers who understand this unusual degree life.
4. **Is this a real dating platform or an eligibility check site?** *Fails (`P0`)* — looks and reads 70% like an eligibility portal / compliance gatehouse.
5. **What happens if I click the primary CTA?** *Opaque (`P1`)* — `"Create Account"` drops directly into a multi-stage email/OTP/DOB/proof onboarding flow without previewing what discovery/profiles look like inside.
6. **Is it trustworthy?** *Trustworthy in governance, sterile in humanity* — proves privacy rules, lacks social/visual proof that real, warm adults inhabit the product.
7. **Does it feel human and romantic?** *Fails (`P0`)* — zero faces, zero conversation moments, zero warmth in hero focal object.
8. **Is it overcrowded or dead?** *Slightly imbalanced* — tablet has vertical air gap (`200px`), compact mobile feels dense with 3 buttons + eyebrow + disclaimer.
9. **What is the eye drawn to first?** On desktop: left crisp headline + purple `Create Account` button, immediately pulled right to the `Ember`-orange rectangle inside a schematic circuit diagram (`v1.0`). On mobile `375px`: giant blocky white headline + wall of muted grey subcopy.
10. **What feels confusing, cold, or bureaucratic?** `"Default-deny access before Discover"`, `"Enrolment Review Boundary"`, `"v1.0"`, `"Distance Bridged by Verified Gates"`.

---

## 6. Performance, Accessibility & SEO Technical Baseline

*[Observed Fact — Playwright Chromium Run & Source Code Audit]*

### Performance Baseline (Uncached `1440×900` Chromium; *Note: Lighthouse CLI not executed in Phase 0*)
- **TTFB:** `160 ms`
- **FCP:** `1236 ms`
- **LCP:** `1236 ms` (`H1.text-3xl`, size `80419`)
- **CLS:** `0.00057`
- **HTML document:** `12.1 KB` transfer (`61.5 KB` decoded)
- **CSS bundle:** `11.4 KB` transfer (`50.8 KB` decoded)
- **Core JS chunks loaded:** `~134 KB` transferred initial framework/layout/page scripts (plus Next.js automatic route prefetches for `/eligibility`, `/safety`, `/login`, `/onboarding`)
- **Key Technical Overhead / Bugs Found:**
  1. **`P1` Double Google Fonts Loading (`layout.tsx:54–59` + `tokens.css:8`):** `Instrument Sans` is imported both via `<link rel="stylesheet">` in `<head>` AND `@import url(...)` inside `@saymyname/design-tokens/styles/tokens.css`, blocking/delaying CSSOM resolution and causing external runtime fetches (`fonts.googleapis.com` -> `fonts.gstatic.com`) instead of `next/font/local` or bundled `woff2`. Document 10 §09 explicitly recommends bundling/self-hosting with SIL OFL 1.1 attribution.
  2. **`P1` Anonymous `401` on First Load (`auth-context.tsx` -> `/api/auth/me`):** Every unauthenticated visitor on `/` triggers a background `fetch('/api/auth/me')` returning HTTP `401` (`2027 ms` observed in run) and printing `Failed to load resource: the server responded with a status of 401 ()` in Chrome DevTools Console.
  3. **`P2` Next.js Config Legacy Variable (`apps/web/next.config.mjs:14`):** Still references `NEXT_PUBLIC_API_ORIGIN` inside `rewrites()`, even though `PHASE3_1` removed it from `server-bff.ts`.
  4. **`P2` Heavy Backdrop-Blur on Mobile (`globals.css:443–450`):** `Navbar` uses `backdrop-filter: blur(6px)` on mobile — acceptable now, but combining WebGL/3D canvas + sticky `backdrop-filter` later risks pushing INP/frame-times past budget on budget Android phones.

### Accessibility Baseline (`apps/web` + DOM Inspection)
- **`P1` No Skip-to-Content Link (`layout.tsx:62–66`):** `skipLink: false` (keyboard users tab through header links on every public page load before reaching `<main>`).
- **`P1` Duplicate Eyebrow/Heading Scale & Micro-Copy Weight:** Eyebrows (`11px`, `uppercase`, wide tracking) violate Document 10 §09 (`12–13px` minimum metadata, avoid all-caps micro-labels as default). H1 on desktop renders at `46.5px` (`text-[2.35rem]` / `text-[2.9rem]`), well below Document 10's `64–76px` editorial hero target, reducing editorial authority.
- **`P2` Semantic Landmarks & Interactive Controls:** `<html lang="en">`, `<main>`, `<nav aria-label="Public Navigation">`, focus-visible outlines (`outline-iris`), and `<button>`/`<a>` semantic roles are properly implemented, and `@media (prefers-reduced-motion: reduce)` disables `.smn-dialog-enter` and `.smn-ambient-breathe`. However, SVG diagrams lack rich descriptive context beyond `aria-hidden="true"` (acceptable if decorative, **must** remain hidden or properly titled if replaced by interactive 3D/product showcase).

### SEO & Linkability Baseline (`apps/web/app/`)
- **`P1` Identical `<title>` & `<meta name="description">` Across All Public Routes:** Zero route-level `metadata` exports on `/`, `/eligibility`, `/safety`, `/privacy`, `/terms`, `/support`, `/login`, `/onboarding`.
- **`P1` Zero Social Share Metadata (`og:title`, `og:description`, `og:image`, `twitter:card`, `canonical`):** Sharing `https://saymyname.in` in WhatsApp, Telegram, Discord, or IITM BS student peer groups produces an unbranded plain text link with **no rich preview card** — directly crippling word-of-mouth peer referrals!
- **`P1` Missing `app/sitemap.ts` & `app/robots.ts`:** `/sitemap.xml` returns HTTP `404` on live production.

---

## 7. Prioritized Consolidated Findings Summary (Website & Product)

| ID | Priority | What Is Wrong | Why It Matters | Proposed Direction |
|---|---|---|---|---|
| `WP-01` | `P0` | Hero visual is a wireframe diagram (`v1.0` architecture) + copy leads with `"verified peers and mutual consent"` & `"Default-deny access"`. | Positions product as an institutional verification portal; zero emotional desire or human connection visible. | Lead hero with *Editorial Romance* ("Same world. Different cities. A chance to meet." variant) + human/tactile focal composition; move gates below value. |
| `WP-02` | `P0` | Zero product preview (`Discover`, prompts, city+track context, `Chats`) anywhere on `/`. | Visitors do not know what kind of dating experience awaits after a multi-step onboarding gate. | Add curated, clearly synthetic/illustrative UI preview of Discover card + prompt + mutual-match chat inside public storytelling flow. |
| `WP-03` | `P0` | Claims/implications on `/` blur live Phase 3 capabilities (`Discover`, `Likes`, `Matches`, async `Chats`) with deferred Phase 4+ client stubs (live audio calls, games, virtual dates UI, Relationship Space UI). | Violates honesty rules and creates sharp expectation disappointment post-onboarding. | Feature live verified Phase 1 dating experience honestly; frame audio/shared-space features strictly as roadmap OR mutual-match continuity philosophy without mocking unbuilt UIs. |
| `WP-04` | `P0` | Mobile hero (`375px` & `390px`) pushes or slices hero focal graphic off-screen due to 3 stacked CTAs + long compliance copy. | Over half of student mobile traffic sees only black void + dense copy + buttons, or an awkward half-cut box header. | Consolidate to `1` primary CTA + `1` lightweight text/anchor link; tighten copy length; place compact focal visual cleanly within mobile fold or dedicated viewport rhythm. |
| `WP-05` | `P1` | Zero OpenGraph (`og:image`, `og:title`) / route metadata / `sitemap.xml` + anonymous `401` console error on `/` + duplicate Google Fonts import. | Breaks WhatsApp/Telegram link previews (primary student sharing channel), hurts SEO & first-load polish. | Add `app/sitemap.ts`, `app/robots.ts`, per-route `metadata`, OG share card; self-host `Instrument Sans` (`woff2`); avoid 401 noise on anonymous public SSR/hydration. |
| `WP-06` | `P1` | Naming split: Header says `Register`, Hero says `Create Account`, URL is `/onboarding`. | Micro-friction and cognitive uncertainty at click moment. | Unify visitor CTA verb across Header + Hero + Footer (`Join SayMyName` / `Create Account`) cleanly mapped to `/onboarding`. |
