# Phase 1 Information Architecture & Navigation Specification — SayMyName.in

**Project:** SayMyName.in — The First Impression Project  
**Phase:** 1 of 6 (Positioning, Messaging, Content Architecture & Wireframing)  
**Baseline:** `landing-page-repositioning` @ `9e1a58d`  
**Rule:** Every link below maps strictly to an existing route in `apps/web/app/` or a defined section ID on `/`. **Zero fictional routes invented.**

---

## 1. Audited Route Map & Functional Continuity

Verified in `apps/web/app/` at `9e1a58d`:
- **Public Marketing & Governance Routes:** `/` (`page.tsx`), `/eligibility`, `/safety`, `/privacy`, `/terms`, `/support`
- **Public Auth & Onboarding Funnel Routes:** `/login`, `/register` (server `redirect` -> `/onboarding` preserving safe `stage`, `email`, `returnUrl`), `/onboarding` (multi-view: `register`, `otp`, `age`, `student`, `review`, `profile`, `suspended`), `/forgot-password`, `/reset-password`
- **Authenticated Member Routes (Middleware + Server Layout Protected `ACTIVE_MEMBER`):** `/discover`, `/likes`, `/matches`, `/chats`, `/profile`

---

## 2. Sticky Header Navigation (`Navbar.tsx` Target Specification)

### Visitor State (Unauthenticated or Non-Active Onboarding Member)
Wait: observe current `Navbar.tsx` separates unauthenticated visitors vs authenticated onboarding (`Continue Setup →` + `Sign Out`) vs `ACTIVE_MEMBER` (`Discover`, `Likes`, `Matches`, `Chats`, `Profile`). Preserve authenticated & onboarding header states intact! Update **only the public visitor state** (`PROPOSED`):

| Slot | Label | Target | Role | Rationale |
|---|---|---|---|---|
| **Logo** | `SayMyName` Interval lockup | `/` | Brand home | Unchanged; preserves Interval mark & camel-case wordmark |
| **Nav Link 1** | `How It Works` | `/#how-it-works` | Section anchor | Uses full path `/#how-it-works` so clicking from `/eligibility` or `/safety` cleanly returns to `/` and scrolls to Section 04 |
| **Nav Link 2** | `Eligibility` | `/eligibility` | Public page | Concise 1-word label (`Eligibility Guide` shortened for 1280px+ balance, destination identical) |
| **Nav Link 3** | `Safety` | `/safety` | Public page | Concise 1-word label (`Safety & Consent` shortened cleanly; destination identical) |
| **Action 1** | `Sign In` | `/login` | Secondary auth action | Direct path for returning members; quiet neutral styling |
| **Action 2** | `Create Account` | `/onboarding` | **Unified Primary CTA** | Eliminates Phase 0 `Register` vs `Create Account` conflict; matches Hero & Closing CTA verbatim |

*Header Link Count:* `3` subtle text links + `2` clear auth actions = `5` total top-bar targets (fits cleanly in single horizontal row from `768px`–`1920px+`).

### Mobile Header Behaviour (`< 768px`)
- Left: `SayMyName` Lockup (`size="sm"`).
- Right: Clean compact **`Create Account`** link/button (`sm`, `36px` height) OR hamburger menu trigger?  
  **Recommendation (`PROPOSED`):** Keep header clean with **Logo (left) + compact `Sign In` / Menu button (right)** inside sticky `62–66px` bar (`min-h-[44px]` touch target), and inside the mobile drawer list: `How It Works` (`/#how-it-works`), `Eligibility` (`/eligibility`), `Safety` (`/safety`), `Sign In` (`/login`), `Create Account` (`/onboarding`). Avoid stuffing a big Iris button next to the logo at `375px` where Hero already places the full-width `Create Account` button cleanly in the first fold!

---

## 3. In-Page Anchors Specification (`/`)

| Anchor ID | Section Target | Smooth-Scroll Behaviour |
|---|---|---|
| `#top` | Top `<main>` landmark (Target of accessible `Skip to main content` link!) | Instant / reduced-motion safe focus |
| `#inside-saymyname` | Section 03 (`The Actual Dating Experience`) | Used by secondary Hero link if Candidate C selected, or product explore action |
| `#how-it-works` | Section 04 (`How Joining Works`) | Target of Header `How It Works` and Hero secondary link `See how it works ↓` |
| `#community` | Section 05 (`The Shared Community`) | Direct deep link for cohort track verification context |
| `#share` | Section 07B (`Natural Peer-Sharing`) | Optional deep link target |

*CSS Requirement Note for Phase 2/3:* Set `scroll-margin-top: 84px` on anchored `<section id="...">` elements so the sticky `66px` `.smn-glass-nav` header never overlaps anchored section headings on desktop or mobile!

---

## 4. Complete Registration & Onboarding Transition Map (`No Backend Changes`)

```text
  Public Visitor on / (or shared WhatsApp link ?src=peer)
         │
         ├─── Clicks "Create Account" (Header / Hero / Closing CTA) ──▶ /onboarding (view: 'register')
         │        │
         │        ├── [Exception 1] Non-BS domain (@gmail / @iitm.ac.in) ──▶ Inline validation error + gentle link to /eligibility
         │        ├── [Exception 2] Existing account already registered    ──▶ Helpful prompt to /login or /forgot-password
         │        ▼
         │    POST /api/auth/register + Resend Email OTP ──────────────────▶ /onboarding (view: 'otp')
         │        │
         │        ├── [Exception 3] Expired / Wrong 6-digit OTP            ──▶ 60s cooldown resend / retry
         │        ▼
         │    POST /api/auth/verify-otp (HttpOnly session minted) ─────────▶ /onboarding (view: 'age')
         │        │
         │        ├── [Exception 4] Under 18 DOB                           ──▶ Server 403 block (strict AGE-01 enforcement)
         │        ▼
         │    POST /api/bff/v1/verification-cases/age (pending) ───────────▶ /onboarding (view: 'student')
         │        ▼
         │    BS Track + Optional Non-Gov Proof -> verify-student ─────────▶ /onboarding (view: 'review' / VERIFICATION_PENDING)
         │        │                                                          [Can save bio/interests/prompt draft + share link]
         │        ▼  (External Human Reviewer Approval via ReviewerGuard)
         │    discoveryEligible = true / PROFILE_INCOMPLETE ───────────────▶ /onboarding (view: 'profile')
         │        │
         │        ├── [Exception 5] Missing portrait or guidelines consent ─▶ Inline readiness prompt (D-P2-04)
         │        ▼
         │    Upload >=1 private R2 portrait + Publish ────────────────────▶ /discover (ACTIVE_MEMBER)
         │
         └─── Clicks "Sign In" ────────────────────────────────────────────▶ /login
                  ├── ACTIVE_MEMBER ───────────────────────────────────────▶ /discover (or safe returnUrl)
                  └── Pending / Incomplete ────────────────────────────────▶ /onboarding (resumes exact server stage)
```

---

## 5. Footer Navigation Structure (`PublicFooter.tsx` Continuity)

No broken or invented routes. Preserve the clean 4-column desktop / stacked mobile footer (`14px` readable links, clear IITM non-affiliation note):
1. **Column 1 — Brand & Independence Statement:** `SayMyName` lockup + brief positioning line + IITM non-affiliation disclaimer.
2. **Column 2 — Platform:** `Overview` (`/`), `Inside SayMyName` (`/#inside-saymyname`), `How Joining Works` (`/#how-it-works`), `Eligibility Guide` (`/eligibility`), `Safety & Consent` (`/safety`).
3. **Column 3 — Access:** `Member Sign In` (`/login`), `Create Account` (`/onboarding`), `Password Recovery` (`/forgot-password`).
4. **Column 4 — Governance:** `Privacy Notice` (`/privacy`), `Terms of Use` (`/terms`), `Member Support` (`/support`) + dynamic configured `SUPPORT_EMAIL` line.

---

## 6. Supporting Public Routes Role Clarity (`/eligibility`, `/safety`, `/privacy`, `/terms`, `/support`)

Why separating concerns makes `/` dramatically stronger:
- **`/` (Homepage):** Emotional curiosity, real product demonstration, approachable step summary, calm trust essence, primary registration action, peer sharing.
- **`/eligibility`:** Exact specification ledger (`BS-DSA`, `BS-ES`, `BS-AST`, `BS-MDS` track details, approved study domains, Foundation vs qualifier distinction, `In Scope vs Out of Scope` two-column specification).
- **`/safety`:** Authoritative technical architecture (`CTRL-01..06`, R2 signed URLs, PostgreSQL row locks, Match termination guarantees, data minimization policies).
- **`/privacy`, `/terms`, `/support`:** Legal notices, member conduct, password reset & verification status help, support desk status.

---

## 7. Redirect, Auth Hydration & Technical Routing Considerations (For Phase 2 Implementation)

1. **Preserve `/register` -> `/onboarding` Server Redirect (`apps/web/app/register/page.tsx`):** External links or bookmarks pointing to `/register` continue resolving cleanly (`200` / `307`) with `stage=otp`, `email`, and validated `returnUrl` intact.
2. **Eliminate Guest `401` Console Noise on `/`:** Currently `AuthProvider` calls `GET /api/auth/me` unconditionally on every public route, emitting an unauthenticated HTTP `401` (`~2027 ms` latency observed) in DevTools Console. Architecture recommendation for Phase 2: let `/api/auth/me` check cookie presence first on the BFF (returning `200 { authenticated: false, user: null }` quickly when `smn_access_token` & `smn_refresh_token` cookies are absent—preserving strict `Cache-Control: private, no-store` and never caching per-user state!).
3. **Middleware + `ACTIVE_MEMBER` Visit Behaviour on `/`:** What if an already logged-in `ACTIVE_MEMBER` opens `/`? `Navbar` continues showing `Open App` (`Discover`) -> `/discover` cleanly, allowing members to still access the `Share SayMyName` section at the bottom if they copy the homepage link for friends!
4. **Dynamic `<title>`, `<link rel="canonical">`, & `/sitemap.xml`:** Phase 2 must add distinct per-route `metadata` for `/`, `/eligibility`, `/safety`, `/privacy`, `/terms`, `/support`, `/login`, `/onboarding` plus `app/sitemap.ts` and `app/robots.ts` so `/sitemap.xml` stops returning HTTP `404`.
