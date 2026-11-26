# Phase 0 — Current UI Audit (`apps/web`)

**Workstream:** Product UI and UX Visual Overhaul (*THE INTERVAL*)  
**Design Authorities:** Document 10 (*THE INTERVAL*), Document 03 (*UI/UX Design Specification*), `design/reference-pack.html`  
**Audit Date:** 2026-11-26  
**Baseline Status:** Pre-Overhaul Baseline (No Application Code Modified)

---

## 1. Executive Audit Summary

The current SayMyName web application on `origin/main` already adopts Mineral Night base colors (`#0B0D10`–`#343D48`), `Instrument Sans`, rectangular control geometry (`4px`–`12px` radii), and real backend/BFF integrations for auth, verification, Discover, Likes, Matches, Messaging, and Profile management.

However, cross-referencing the live UI code against **Document 10 (*THE INTERVAL*)**, **Document 03**, the **target reference layouts (`reference-pack.html`)**, and the **UI overhaul objectives** exposes significant structural, typographic, visual-hierarchy, and honesty gaps across every member screen:

1. **Shell & Navigation Deviations:** `Navbar.tsx` and `BottomNav.tsx` rely on translucent glassmorphism (`backdrop-filter: blur(10px)` via `.smn-glass-nav`) rather than solid `Coal #12161B` surfaces with crisp `Edge #343D48` seams. Desktop member tabs sit inside left-clustered bordered pill-boxes instead of balanced centered navigation with a `2px` bottom `Iris` active rule.
2. **Micro-Typography & Uppercase Eyebrow Overload:** Over 30 locations rely on `10px–11px` uppercase tracked labels (`text-[11px] uppercase tracking-[0.12em..0.14em]`), violating Document 03 §4.3 (`12px` minimum metadata floor, sentence case) and the target `12–13px` readability floor.
3. **Decorative Rule & Gradient Creep:** Multiple screens (`discover`, `matches`, `chats`) use `2px–3px` left vertical accent rails (`border-l-2 border-iris`, `border-l-[3px] border-iris`) on prompts and active rows, and radial background gradients (`.smn-ambient-*`), violating Document 10 prohibitions against decorative left rail lines and ambient wash dependence.
4. **Desktop Composition Imbalance:**
   - **Discover:** Splits photo + action dock (`lg:col-span-7`) away from bio, prompts, and interests (`lg:col-span-5`), placing buttons between photo and story, crowding portrait bottom with translucent blur badges, and appending a diagnostic batch box.
   - **Likes & Matches:** Rely on bulky card-in-card grids (`Received Likes` 2-col card matrix + side metric boxes; `Matches` multi-tier action cards + duplicate workbench) rather than calm, structured `person-row` list hierarchy.
   - **Profile:** Nests `p-6 rounded-[12px]` bordered containers inside tabs alongside `40px` raw form controls mixed with `48px` `<Input>` controls, rather than unified edit canvas + focused section sub-routes/views (`Overview`, `Edit Profile`, `Photos`, `Preferences`, `Visibility`, `Account & Security`).
   - **Sign In / Recovery:** Centers a narrow `440px` box in an empty dark canvas on `1440px+` screens instead of an intentional asymmetric editorial two-region layout.
5. **Product Honesty & Scope Hygiene Defect in `Chats` (`apps/web/app/(app)/chats/page.tsx`):**
   - **False/Unverified Claim:** Empty state displays `eyebrow="Encrypted Match Channels"` even though end-to-end encryption (E2EE) is not verified/implemented (`chats/page.tsx:299`).
   - **Client-Only Mock Feature Chrome:** `chats/page.tsx` exposes `Call` (`handleStartCall` uses a `setTimeout` mock at lines 210–215), Voice Note (`alert(...)` at line 678), and a `Together Space` dropdown with local-state mock `Word Games & Trivia` (`alert('Correct! ... +10 Team Points!')`), `Virtual Date` (`This Saturday, 5:00 PM IST`), and `Relationship Mode` (`setSafetyFeedback(...)` only — zero backend calls on `main`). Per product rules, unshipped features and inaccurate privacy claims must not be presented in the UI.
6. **Touch Target Shortfalls:** Several interactive controls use `Button size="sm"` (`h-9` = `36px`) or `w-9 h-9` (`36×36px`) icon buttons (e.g., Chats Report/Block buttons, Discover photo prev/next controls `36×36px`, Navbar `Sign Out`), falling short of the `44×44px` usability target for primary controls.

---

## 2. Screen-by-Screen Findings

| Area / Screen | Observed Current State | Key Visual / UX Defects | Target Overhaul Direction |
|---|---|---|---|
| **Global Shell (`Navbar` + `BottomNav`)** | `66px` sticky bar with `.smn-glass-nav` blur; left-aligned boxed active tab; right utility with avatar + name + `Verified` (`11px`) + `Sign Out` (`36px`). | Translucent glass blur violates Document 10; nav tabs feel boxed rather than architectural; mobile indicator uses `rounded-full`; `Sign Out` & hamburger below ideal spacing/consistency. | Solid `#12161B` (`Coal`) bar with crisp `1px #343D48` (`Edge`) border; brand left, centered nav links with `2px` bottom `Iris` indicator, right utility (`Safety`, clean name + `Verified 18+` / `Verified` rectangular badge, `Sign Out`); solid non-capsule mobile bottom bar. |
| **Discover (`/discover`)** | `7`-col portrait card + embedded identity + Pass/Profile/Like row; `5`-col aside holds About, Prompts (with `border-l-2 border-iris`), Interests, and Batch meta card. | Photo & human story are split; portrait capped (`max-h-[540px]`) with overlay gradient & floating glass badges; duplicate Profile triggers; `11px` uppercase eyebrows; `.smn-ambient-discover` glow; `border-l-2` vertical line on prompts. | Candidate-first composition (`7–8` col primary column integrating generous portrait gallery + clean editorial story/prompts/interests cleanly, `4–5` col context/preferences/queue rail without competing chrome); crisp `>= 44px` Like/Pass buttons; zero glass overlays or left vertical rail bars. |
| **Mutual Match Moment (`discover` & `likes` Dialog)** | Static two-bracket + Ember dot inside standard `Dialog` (`text-center`, small `48px` match avatar row). | Uses generic `smn-glass-overlay` backdrop blur; static diagram lacks the Document 10 `260–380ms` stepped-form alignment choreography and refined editorial presentation. | Signature architectural alignment (`260–380ms` convergence into the Threshold Mark with static `prefers-reduced-motion` equivalent), clear peer card, zero confetti/urgency, direct `Message` / `Keep Discovering`. |
| **Likes (`/likes`)** | `8`-col 2-column grid of thick bordered cards (`Received`) or stacked boxes (`Sent`), `4`-col stats card with `Incoming` / `Sent Active` sub-boxes. | Card-within-card bloat; `Received` grid squeezes bio/programme metadata into cramped `md:grid-cols-2` tiles with small `h-9` action buttons (`Pass` / `Like Back`). | Structured horizontal `person-row` list rows in the primary `8`-col feed paired with calm single-surface `4`-col queue guidance; generous `44px+` touch targets on `Like Back` / `Pass` / `Withdraw`; `12–13px+` metadata floor. |
| **Matches (`/matches`)** | `5`-col stack of full cards with bottom toolbar + `7`-col duplicate profile workbench. | Excessive panel borders on every row and nested badges (`Verified` + `Programme` + `Term` + `City`); workbench repeats Discover prompt rail styling. | Calm structured roster rows on the left + clear focused match workspace on the right with single clear primary CTA (`Message`), separated unmatch/safety actions, and clean empty state using **Threshold Mark**. |
| **Chats (`/chats`)** | `300–336px` sidebar (`border-l-[3px]` selected bar) + flex thread with `bg-iris` dark-text own bubbles, `"Encrypted Match Channels"` empty copy, and client-only `Call` / `Together Space` / `alert()` voice stubs. | Critical honesty defect (`Encrypted`, client-only mock Call/Game/Virtual Date/Relationship Mode modals, `alert()`s); `border-l-[3px]` prohibited accent line; harsh bright `bg-iris` sent bubbles; `40px` composer buttons. | Two-pane desktop layout (`3–4` col list / `8–9` col thread) + full-screen mobile thread; calm `#29283B / #514C7D` sent bubbles; honest privacy header (`Mutual Match Active` — remove unverified `Encrypted` claim and client-only fake modals/alerts); `>= 44px` controls; offline/retry/loading/empty states. |
| **Empty States (`Matches`, `Chats`, `Likes`, `Discover`)** | `IntervalEmptyComposition` (`7/5` split with uppercase label pill and decorative technical `ACTIVE RULE` schematic SVG box). | Reads like a system diagnostics panel (`ACTIVE RULE`, `Queue Threshold`, uppercase monospaced labels) rather than an emotionally composed dating product state. | Architectural two-form **Threshold Mark** composition separated across a deliberate gap, calm human headline/copy (`>= 14px`), and clear next actions without shaming or diagnostic telemetry chrome. |
| **Profile & Settings (`/profile`)** | 6 tabs sharing an `8/4` container packed with stacked bordered `p-6 rounded-[12px]` cards, mixed `40px`/`48px` inputs, and `11px` uppercase Iris field labels. | Heavy container nesting; repetitive bordered boxes; small `h-10` native `<select>` / `<input>` fields; uppercase label fatigue; preview rail duplicates full modal. | Flat, well-spaced surface hierarchy on Coal/Iron without card-in-card borders; `48px` uniform controls across all 6 areas (`Overview`, `Edit Profile`, `Photos`, `Preferences`, `Visibility`, `Account & Security`); 6-slot asymmetric Photos grid; clean square check cards for the 4 BS tracks. |
| **Sign In & Recovery (`/login`, `/forgot-password`, `/reset-password`)** | Single `440px` centered card surrounded by empty Void viewport on desktop. | Over 70% dead viewport space on `1440/1920px`; visual lock icon box feels generic; `11px` footer disclaimer. | Asymmetric 2-region desktop composition (`5`-col left editorial identity + Threshold Mark + Cohort context / `7`-col right clean Sign-In surface), collapsing cleanly to 1 column on mobile; zero prefilled credentials. |
| **Onboarding (`/onboarding`)** | `1200px` `7/5` grid with 5 step boxes across the top. | `11px` uppercase eyebrow; step indicators look like tiny form tags rather than crisp numbered steps (`01`..`05`); can tighten form surface alignment and typography hierarchy cleanly. | Align step headers (`01`..`05` square tiles), uniform `48px` controls, `12px+` helper/label contrast, preserving every backend gate intact. |

---

## 3. Baseline Verification & Screenshot Log (`screenshots/before/`)

Baseline screenshots were captured from the **untouched pre-overhaul application** rendered in Chromium at Desktop (`1440×900`) and Mobile (`390×844`) using a local synthetic read-only mock API harness (`API_BACKEND_URL` -> local synthetic fixtures only, zero real student data):

| Surface | Desktop (`1440×900`) | Mobile (`390×844`) | Capture Notes |
|---|---|---|---|
| **Sign In (`/login`)** | `before/login-desktop.png` | `before/login-mobile.png` | Live Next.js public route |
| **Onboarding (`/onboarding`)** | `before/onboarding-desktop.png` | `before/onboarding-mobile.png` | Live Next.js step 1 registration view |
| **Discover (`/discover`)** | `before/discover-desktop.png` | `before/discover-mobile.png` | Authenticated synthetic fixture |
| **Likes (`/likes`)** | `before/likes-desktop.png` | `before/likes-mobile.png` | Authenticated synthetic received/sent fixture |
| **Matches (`/matches`)** | `before/matches-desktop.png` | `before/matches-mobile.png` | Authenticated synthetic fixture |
| **Matches Empty (`/matches`)** | `before/matches-empty-desktop.png` | `before/matches-empty-mobile.png` | Authenticated synthetic empty matches state |
| **Chats (`/chats`)** | `before/chats-desktop.png` | `before/chats-mobile.png` | Authenticated synthetic populated conversation |
| **Chats Empty (`/chats`)** | `before/chats-empty-desktop.png` | — | Authenticated synthetic empty channels state |
| **Profile (`/profile`)** | `before/profile-desktop.png` | `before/profile-mobile.png` | Authenticated synthetic Overview/Edit view |

> **Milestone 0 Gate Compliance:** Zero files under `apps/` or `packages/` were modified during Milestone 0.
