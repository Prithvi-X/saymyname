# Phase 0 — Route and Component Inventory (`apps/web`)

**Workstream:** Product UI and UX Visual Overhaul (*THE INTERVAL*)  
**Branch:** `product-ui-visual-overhaul` (branched from `origin/main` @ `08336c1b1188b1b50e52e480c446e0abeee29e52`)  
**Worktree:** `i:\saymyname-ui-redesign`  
**Audit Date:** 2026-11-26  
**Status:** Milestone 0 (Read-Only Inventory — Zero Application Code Edits)

---

## 1. Application Shell & Layout Wrappers

| File Path | Role | Scope / Guard | Key Styling & Behavior |
|---|---|---|---|
| `apps/web/app/layout.tsx` | Root HTML layout, fonts, metadata | All routes | Loads `Instrument Sans` (400–700 via `next/font/local`, `--font-instrument-sans`), wraps children in `<AuthProvider>`, renders `<Navbar />`, `<main id="main-content">`, `<PublicFooter />`, `<BottomNav />`, skip link. |
| `apps/web/app/(app)/layout.tsx` | Authenticated member SSR guard | `/discover`, `/likes`, `/matches`, `/chats`, `/profile` | Reads `smn_access_token` / `smn_refresh_token` cookies; calls `${API_BACKEND_URL}/api/v1/identity/me`; redirects to `/login` (unauthenticated) or `/onboarding` (`lifecycleState !== 'ACTIVE_MEMBER'`). |
| `apps/web/app/globals.css` | Base reset, typography, legacy helpers, glass classes | Global | Sets `html { font-size: 15px }`, `.container-narrow` (`640px`), `.container-standard` (`880px`), `.container-wide` (`1200px`), `.smn-glass-nav` (`backdrop-filter: blur(10px)`), `.smn-ambient-*` radial gradients, `.btn`, `.badge-*`, `.input-field`. |
| `apps/web/tailwind.config.ts` | Tailwind utility tokens | Global | Defines Mineral Night color utilities (`void`, `stage`, `coal`, `iron`, `slate`, `edge`, `chalk`, `silver`, `ash`, `iris`, `ember`, `success`, `warning`, `danger`), radii (`control: 8px`, `panel: 12px`, `surface: 16px`), `font-ui`. |
| `packages/design-tokens/styles/tokens.css` | Canonical CSS custom properties | Global | `--smn-stage: #0B0D10`, `--smn-surface-base: #12161B`, `--smn-surface-raised: #1A2027`, `--smn-surface-active: #252D37`, `--smn-border-subtle: #343D48`, `--smn-text-*`, `--smn-accent-*`, `--radius-*` (clamped, no pills). |

---

## 2. Full Route Inventory (`apps/web/app/`)

### A. Member Application Routes (`(app)/*` — Protected by Server Layout Guard)

| Route ID | Route Path | Source File | Auth / Eligibility State | Primary Purpose & Existing Implementation |
|---|---|---|---|---|
| `DAT-01` / `DAT-02` / `MAT-01` | `/discover` | `apps/web/app/(app)/discover/page.tsx` | `ACTIVE_MEMBER` only | Browse eligible 18+ IITM BS candidates (`api.getDiscoverFeed`, `likeCandidate`, `passCandidate`, `blockCandidate`, `reportCandidate`). Includes photo carousel, 7/5 split card+aside layout, Full Profile `<Dialog>`, Mutual Match `<Dialog>`, Block/Report `<Dialog>`s, Paused/Empty (`IntervalEmptyComposition`), Error (`EmptyState`), Skeleton loading. |
| `DAT-04` | `/likes` | `apps/web/app/(app)/likes/page.tsx` | `ACTIVE_MEMBER` only | Two-tab inbox (`Received Likes` / `Sent Likes`, `?tab=sent`). Received uses `lg:grid-cols-12` (`8`-col 2-column card grid + `4`-col `Inbox Overview` counter rail). Sent uses stacked row cards with `Withdraw` confirmation `<Dialog>`. Also includes Full Profile Inspect `<Dialog>`, Mutual Match `<Dialog>`, Block/Report `<Dialog>`s. |
| `MAT-02` / `MAT-03` | `/matches` | `apps/web/app/(app)/matches/page.tsx` | `ACTIVE_MEMBER` only | Master-detail (`5/7` col split) list of active mutual matches (`api.getMatches`, `getMatchDetail`, `unmatch`). Left roster shows cards + search filter (when `>= 4` matches); right workbench renders match profile, `Open Conversation` link (`/chats?matchId=...`), `Unmatch`, `Report`, `Block`. Mobile opens profile in `<Dialog>`. |
| `MSG-01` / `MSG-02` | `/chats` | `apps/web/app/(app)/chats/page.tsx` | `ACTIVE_MEMBER` only | Split-pane container (`300-336px` sidebar + flex thread) with mobile list/thread toggle. Supports `api.getMatches`, `getMessages`, `sendMessage`, `blockCandidate`, `reportCandidate`, ended-connection state, and empty conversation starters. **Caveat found:** Currently contains client-only mock modals for `Call`, `Together Space` (`Word Games`, `Virtual Date`, `Relationship Mode`), browser `alert()` stubs, and `"Encrypted Match Channels"` empty-state eyebrow. |
| `PRO-01` / `PRO-02` / `ONB-03..06` / `ACC-01` | `/profile` | `apps/web/app/(app)/profile/page.tsx` | `ACTIVE_MEMBER` only | 6-tab account/profile hub (`Overview`, `Edit Profile`, `Photos`, `Preferences`, `Visibility`, `Account & Security`) in `8/4` col grid with sticky right `Live Discover Card Preview` rail and Peer Preview `<Dialog>`. Real R2 photo upload (`presignPhoto` -> PUT -> `addPhoto`), publish/pause, preferences, and session revocation. |

### B. Public, Authentication & Onboarding Routes

| Route ID | Route Path | Source File | Auth State | Primary Purpose & Existing Implementation |
|---|---|---|---|---|
| `PUB-01` | `/` | `apps/web/app/page.tsx` | Public / All | Editorial Romance landing page (preserved untouched in this overhaul; components under `components/landing/*`). |
| `AUTH-02` | `/login` + `login/layout.tsx` | `apps/web/app/login/page.tsx` | Unauthenticated / Visitor | Centered single narrow card (`max-w-[440px]`) with email/password inputs, show/hide toggle, `/forgot-password` link, `/onboarding` link, and `EMAIL_NOT_VERIFIED` OTP resume banner. |
| `AUTH-01` / `AUTH-04` / `VER-01..03` / `ONB-01..06` | `/onboarding` + `onboarding/layout.tsx` | `apps/web/app/onboarding/page.tsx` | Visitor -> Pending -> Active | 5-step guided flow (`register` -> `otp` -> `age` -> `student` / `review` -> 5-sub-step `profile`, plus `suspended` view) inside `max-w-[1200px]` `7/5` grid with 5 step tiles. |
| `AUTH-01` alias | `/register` | `apps/web/app/register/page.tsx` | Visitor | Server redirect preserving validated `stage=otp`, `email`, `returnUrl` -> `/onboarding`. |
| `AUTH-03` | `/forgot-password` + `layout.tsx` | `apps/web/app/forgot-password/page.tsx` | Visitor | Narrow centered `max-w-[440px]` card requesting recovery instructions (`api.forgotPassword`). |
| `AUTH-03` | `/reset-password` + `layout.tsx` | `apps/web/app/reset-password/page.tsx` | Visitor | Narrow centered `max-w-[440px]` card accepting token + new password (`api.resetPassword`). |
| `PUB-02` | `/eligibility` | `apps/web/app/eligibility/page.tsx` | Public / All | Phase 1 eligibility scope across the 4 approved BS tracks, 18+ boundary, and in-scope/out-of-scope rules inside `.container-standard` (`880px`). |
| `SAFE-01/02` | `/safety` | `apps/web/app/safety/page.tsx` | Public / All | Enforced technical controls (`CTRL-01..CTRL-06`) and privacy commitments inside `.container-standard` (`880px`). |
| `GOV-01` | `/privacy` | `apps/web/app/privacy/page.tsx` | Public / All | Privacy notice covering institutional data minimization, R2 media, messaging boundaries. |
| `GOV-02` | `/terms` | `apps/web/app/terms/page.tsx` | Public / All | Terms of use emphasizing non-affiliation with IIT Madras, 18+ rule, anti-scraping conduct. |
| `ACC-04` | `/support` | `apps/web/app/support/page.tsx` | Public / All | Password recovery card, verification status card, safety escalation note (`supportEmail` env-driven). |
| `SYS-*` | N/A (`error.tsx`, `global-error.tsx`, `not-found.tsx`) | `apps/web/app/{error,global-error,not-found}.tsx` | All | Error boundaries and 404 page. |
| `DS-01` | `/design-system` | `apps/web/app/design-system/page.tsx` | Dev / `NEXT_PUBLIC_ALLOW_DESIGN_SYSTEM` | Interactive token/component preview (`notFound()` in production unless flag set). |

---

## 3. Shared Component & Library Inventory

### A. Brand Assets (`apps/web/components/brand/`)
- `Logo.tsx`: Combines `<Symbol>` and `<Wordmark>` in optional `<Link>`; currently passes `symbolConcept="A"`.
- `Symbol.tsx`: Three SVG concepts (`A`: Paired Masses with 4px interval & centered 3x3 Iris square; `B`: Subtractive diagonal cut; `C`: 4-quadrant facet convergence).
- `Wordmark.tsx`: Custom geometric SVG vector `SayMyName` (`full` and `compact`) with trailing Iris dot rectangle.

### B. Navigation & Chrome (`apps/web/components/`)
- `Navbar.tsx`: Sticky `66px` topbar using `.smn-glass-nav`, left-aligned `Logo` + pill-boxed active tab (`bg-slate border-edge`), right-aligned `Safety` link + `<Avatar>` + displayName + `<Badge variant="verified">Verified</Badge>` + `Sign Out` (`size="sm"`). Mobile public drawer uses `bg-coal/95 backdrop-blur-md`.
- `BottomNav.tsx`: Mobile-only (`< 768px`) fixed `62px` bar with `.smn-glass-nav`, 5 routes (`Discover`, `Likes`, `Matches`, `Chats`, `Profile`), `11px` labels, `rounded-full` bottom indicator bar.
- `PublicFooter.tsx`: Multi-column footer hidden inside member workspace prefixes; uses `11px`–`12px` links.
- `icons.tsx`: Inline SVG stroke icons (`CompassIcon`, `HeartIcon`, `HandshakeIcon`, `ChatIcon`, `UserIcon`, `ShieldIcon`, `FlagIcon`, `LockIcon`, `XIcon`, `CheckIcon`, `InboxIcon`, `SendIcon`, `PhoneIcon`, `GameIcon`, `HeartHandshakeIcon`, `CalendarIcon`, `MicIcon`, `PinIcon`, `SparklesIcon`).

### C. UI Primitives (`apps/web/components/ui/`)
- `Button.tsx`: Variants `primary` (Iris), `secondary` (Iron+Edge), `tertiary`, `ghost`, `destructive`, `warm` (Ember). Sizes: `sm` (`h-9` = `36px`), `md` (`h-12` = `48px`), `lg` (`h-[48px]`). Note `sm` is below `44px` product target for primary mobile interactive controls.
- `Input.tsx`: `48px` height (`h-12`), `4px` radius, Coal fill, Edge border, accessible `aria-invalid` / `aria-describedby`. Label uses `text-xs tracking-wide`.
- `Badge.tsx`: Variants `verified`, `programme`, `neutral`, `accent`, `warning`, `danger`. Sizes `sm` (`text-[11px]`, `3px` radius), `md` (`text-xs`, `4px` radius).
- `Tabs.tsx`: Border-bottom architectural tab bar (`h-11` = `44px`), `2px` Iris underline active indicator, badge count (`text-[11px]`).
- `Avatar.tsx`: Square-rounded frames (`4px`..`10px`), initials fallback, optional corner check badge.
- `Dialog.tsx`: Fixed backdrop (`bg-stage/80 backdrop-blur-sm`) + `.smn-glass-overlay` (`backdrop-filter: blur(12px)`), `Escape` key handler (lacks focus-trap tab cycling).
- `EmptyState.tsx`: Centered `max-w-lg` box (`bg-coal/50`) with `48px` icon frame, heading, body, optional secondary `<Button size="sm">`.
- `IntervalEmptyComposition.tsx`: 12-col split empty state (`7`-col copy/actions + `5`-col right schematic SVG diagram with `11px` uppercase eyebrow and `ACTIVE RULE` readout).
- `Skeleton.tsx`: `animate-pulse` rectangular placeholders (`4px`/`8px`/`12px` radius).
- `Divider.tsx`: Horizontal `<hr>` or centered `text-xs uppercase` label divider.

### D. Landing Components (Out of Redesign Scope Unless Token-Dependent)
- `components/landing/{AcrossCitiesSection,HowItWorksSection,LandingHero,LandingPage,ProductPreview,ProgrammeSection,ShareSection,TrustSection}.tsx` — Preserved intact per Phase 5 production release (`LANDING_PAGE_EDITORIAL_ENABLED=true`).

### E. State & Business Logic Helpers (`apps/web/lib/` — Preserve Unchanged)
- `api.ts`, `auth-context.tsx`, `auth-session-status.ts`, `discover-state.ts`, `likes-state.ts`, `matches-state.ts`, `landing-flag.ts`, `public-config.ts`, `return-path.ts`, `server-bff.ts`.
