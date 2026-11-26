# Phase 2 — Representative Prototype Review (*THE INTERVAL*)

**Workstream:** Product UI and UX Visual Overhaul  
**Authority:** Document 10 (*THE INTERVAL*), Document 03, `design/reference-pack.html`  
**Milestone:** 2 of 4 (**FOUNDER REVIEW GATE — Scaling to remaining routes paused pending approval**)  
**Date:** 2026-11-26

---

## 1. Milestone 2 Scope & Representative Prototypes

In accordance with Document 10 Section 23 (*First design sprint: validate before scaling*), five representative surfaces were designed, implemented cleanly in Next.js, and verified before touching the remaining member and public routes:

1. **Discover Profile (`/discover` — Candidate-First Showcase)**
2. **Chats (`/chats` — Two-Pane Desktop Workspace & Mobile Thread)**
3. **Mutual Match Signature Moment (`MutualMatchDialog` — ThresholdMark Convergence)**
4. **Deliberate Empty States (`/chats` Empty & `/matches` Empty via `IntervalEmptyComposition`)**
5. **Sign In (`/login` — Asymmetric Two-Region Editorial Entry)**

---

## 2. Before vs After Comparison Summary

| Surface | Before (`screenshots/before/`) | After (`screenshots/milestone2/`) | Key Improvements Verified |
|---|---|---|---|
| **Discover** (`/discover`) | Portrait in `7`-col stack pushed heading (`Aarav, 22`) and `Pass` / `Like` below `1440×900` fold; bio split into separate `5`-col box; glass overlay badges; left purple accent lines on prompts. | Split `8`-col focal candidate showcase (clean portrait alongside `Aarav, 22`, bio, `Pass`/`Like` **visible above the fold** at `1440×900` + `1280×800`) + integrated prompts/interests below without left accent rails + `4`-col quiet session/photo context rail. | Above-the-fold primary CTA clarity, human portrait + story side-by-side, `48px` Pass/Like buttons, `0px` overflow from `1920px` down to `320px`. |
| **Chats** (`/chats`) | Contained unverified `"Encrypted Match Channels"` eyebrow, client-only mock `Call` (`setTimeout`) / `Together Space` fake game/date/relationship modals, `alert()` voice stub, `border-l-[3px]` accent rail, bright `bg-iris` sent bubbles, and mobile scroll jump. | Honest `"Private match channels"` header (`Mutual match active`), removed unshipped mock modals/`alert()`s while preserving real `Report`/`Block` (`44×44px`), `.smn-bubble-own` (`#29283B / #514C7D`) calm own bubbles, pinned mobile header+composer inside `100dvh`, `12px+` timestamps. | Long-session dark reading comfort, truthful privacy posture, container-scoped scroll on mobile so Back/header/composer stay visible inside `390×844`. |
| **Mutual Match** (`MutualMatchDialog`) | Generic static two-line CSS bracket + box with blurred `.smn-glass-overlay`. | Solid `Iron #1A2027` Dialog panel featuring **Threshold Mark** (`164×120px` stepped forms aligning in `320–340ms` into central warm Ember `#E18A62` square), clear peer summary card, equal `Keep Discovering` / `Open Conversation` actions. | Brief `320–340ms` signature convergence, zero confetti/urgency, static settled geometry under `prefers-reduced-motion: reduce`. |
| **Empty States** (`Matches` / `Chats`) | Technical monospace box (`INTERVAL ALIGNMENT`, `ACTIVE RULE`, uppercase pill). | Calm sculptural two-form **Threshold Mark** (`variant="separated"`) paired with sentence-case eyebrow and honest next steps. | Respectful, non-shaming tone consistent with Document 10 brand concept. |
| **Sign In** (`/login`) | Lone narrow `440px` centered card surrounded by ~70% empty dark background on desktop. | Intentional `12`-col asymmetric two-region layout (`5`-col left Threshold Mark + editorial positioning & independence notice; `7`-col right `540px` solid Coal form with `48px` inputs and zero prefilled credentials). | Strong desktop proportion, clean single-column mobile collapse, full password visibility toggle (`Show`/`Hide`). |
| **Global Shell** (`Navbar` + `BottomNav`) | Translucent blur glass header (`.smn-glass-nav`), boxed left nav pills, `rounded-full` bottom indicator, `4px` overflow at `390px`. | Solid `Coal #12161B` header (`68px`) with centered nav links + `2px` bottom `Iris` rule, solid mobile bottom bar (`12px` labels, rectangular indicator), compact mobile branding fitting `320px`. | Zero glassmorphism blur, zero horizontal overflow down to `320px`. |

---

## 3. Verification Evidence (`product-ui-visual-overhaul`)

| Check | Command / Harness | Scope & Conditions | Outcome |
|---|---|---|---|
| **TypeScript Typecheck** | `npm --prefix i:\saymyname-ui-redesign run --workspace=@saymyname/web typecheck` | Full `@saymyname/web` app & components | **PASS** (0 errors) |
| **Web Unit Tests** | `node --test i:\saymyname-ui-redesign\apps\web\test\*.test.ts` | 4 suites, 26 tests (`auth-session-status`, `discover-state`, `landing-flag`, `likes-state`, `matches-state`) | **PASS** (26/26) |
| **Next.js Production Build** | `npm --prefix i:\saymyname-ui-redesign run --workspace=@saymyname/web build` | All 32 static/dynamic routes including BFF API handlers | **PASS** |
| **Viewport Overflow Audit** | Chromium Playwright (`capture_m2.py`) against live `next start` + read-only synthetic mock backend | `/login`, `/discover`, `/chats`, `/matches` empty across **`1920×1080`, `1440×900`, `1280×800`, `768×1024`, `430×932`, `390×844`, `360×800`, `320×640`** | **PASS** (`0px` overflow on all tested route/viewport combinations) |
| **Keyboard & Reduced Motion** | Chromium Playwright (`capture_m2.py`) | `Escape` dismisses `MutualMatchDialog` (count `0`); `reduced_motion='reduce'` computes `animationName: 'none'` on `.smn-threshold-left` | **PASS** |

> **Evidence Note:** Authenticated routes (`/discover`, `/chats`, `/matches`) were rendered against a local read-only synthetic mock backend (`MOCK_SCENARIO=populated|empty`, zero real member PII or external media URLs) because PostgreSQL/API services are not running in this environment. Screenshot artifacts are committed under `docs/implementation/ui-overhaul/screenshots/before/` and `docs/implementation/ui-overhaul/screenshots/milestone2/`.

---

## 4. Founder Review Gate & Open Decisions Before Milestone 3

Scaling this system across the remaining routes (**Milestone 3:** `Likes` structured rows, `Matches` roster & workbench, `Profile` 6-section settings & 6-slot asymmetric photo grid, `Onboarding` numbered `01..05` flow, `Forgot/Reset Password`, `Eligibility/Safety/Privacy/Terms/Support`; **Milestone 4:** full cross-route accessibility & visual regression audit) is **paused awaiting Founder review** on:

1. **`DEC-UI-01` (The Threshold Mark):** Approve **ThresholdMark** (`apps/web/components/brand/ThresholdMark.tsx`) for signature product surfaces (empty states, Mutual Match alignment, Sign In editorial panel), and indicate whether the top-left `Symbol concept="A"` in `Navbar` should stay as-is or also be considered for harmonisation in a future PR.
2. **Prototype Layout Approval:** Confirm approval of the five Milestone 2 prototypes (`Discover` split portrait+story grid, `Chats` calm `#29283B` own-bubble workspace with honest Match-only copy and client-mock chrome removed, `MutualMatchDialog`, `IntervalEmptyComposition`, and `Sign In` 5/7 split).
3. **Unshipped Feature Chrome Removal in `Chats`:** Confirm agreement that client-only mock `Call` / `Together Space` buttons and `"Encrypted Match Channels"` copy remain removed on `main` until Agent 1 / backend capabilities are merged and verified.
