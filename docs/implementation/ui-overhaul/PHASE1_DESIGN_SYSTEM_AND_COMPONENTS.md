# Phase 1 — Design System Foundation & Shared Components (*THE INTERVAL*)

**Workstream:** Product UI and UX Visual Overhaul  
**Authority:** Document 10 (*THE INTERVAL*), Document 03, `design/reference-pack.html`  
**Milestone:** 1 of 4  
**Date:** 2026-11-26

---

## 1. System Rules Applied

1. **Mineral Night Surface Hierarchy (`tokens.css` & `globals.css`):**
   - **Void (`#0B0D10`)** background stage, **Coal (`#12161B`)** navigation, list rows, and primary reading surfaces, **Iron (`#1A2027`)** modals/cards/subtle containers, **Slate (`#252D37`)** active selection states, **Edge (`#343D48`)** structural boundaries.
   - **Solid Chrome Rule:** Navigation header (`.smn-solid-nav`), mobile bottom bar, mobile drawer, and modal overlays (`.smn-dialog-surface`) use solid `#12161B` / `#1A2027` surfaces with crisp `#343D48` borders — zero `backdrop-filter: blur` glassmorphism.
   - **Chat Own-Bubble Semantic Surface:** Added `--smn-bubble-own-bg: #29283B` and `--smn-bubble-own-border: #514C7D` so outgoing messages keep high Chalk (`#F0F1EE`) contrast and long-session visual comfort without large Iris fill blocks.

2. **Typography & Readability Scale (`Instrument Sans`):**
   - Set root `html { font-size: 16px }` (`Document 03 §4.2–4.3`) so Tailwind `text-xs` resolves to a clean **12 px minimum floor**, `text-sm` resolves to **14 px** secondary body/labels, and `text-base` resolves to **16 px** primary reading text.
   - Removed uppercase micro-eyebrow clutter in new shared primitives (`PageHeader`, `Input`, `Badge`, `IntervalEmptyComposition`), using sentence case at `12–13 px+`.

3. **Grid, Geometry & Touch Accessibility:**
   - Added `.container-app` (`max-width: 1344px`, `16 / 24 / 40px` responsive gutters across `320px–1920px`).
   - Enforced architectural radii (`0px`, `4px`, `6–8px`, `12px`, zero `999px` capsules/pills).
   - Enforced `>= 44px` touch target minimum on `Button` (`md`, `lg`), `Tabs`, `BottomNav`, and `Dialog` close button (`44×44px`).
   - Added complete `Tab` keyboard focus trapping and focus restoration in `Dialog.tsx`.

4. **Motion Discipline & Reduced-Motion:**
   - Defined `smn-threshold-left`, `smn-threshold-right`, and `smn-threshold-signal` (`320–340ms` `cubic-bezier(0.2, 0.7, 0.2, 1)`) for signature mutual-match convergence.
   - All keyframe motion disables cleanly to static settled geometry inside `@media (prefers-reduced-motion: reduce)`.

---

## 2. Shared Component Additions & Updates

| Component | Path | Milestone 1 Changes |
|---|---|---|
| **ThresholdMark** *(NEW — Proposed `DEC-UI-01`)* | `apps/web/components/brand/ThresholdMark.tsx` | Twin Gujarat-stepwell architectural stepped bracket forms across a central gap (`variant: 'separated' | 'aligned'`, `animate?: boolean`). Existing `<Logo>` and `<Symbol>` remain intact until Founder review in Milestone 2. |
| **Navbar** | `apps/web/components/Navbar.tsx` | Solid `#12161B` bar (`h-[68px]`), left `<Logo>`, centered desktop navigation with `2px` bottom `Iris` active underline (zero pill boxes), solid mobile drawer without blur. |
| **BottomNav** | `apps/web/components/BottomNav.tsx` | Solid `#12161B` mobile bar (`h-[64px]`), `12px` labels, architectural rectangular `2px` active indicator (removed `rounded-full`). |
| **PageHeader** *(NEW)* | `apps/web/components/ui/PageHeader.tsx` | Calm sentence-case `13px` context dot + `heading.1` + `14px` description + right actions. |
| **StructuredListRow** *(NEW)* | `apps/web/components/ui/StructuredListRow.tsx` | Hairline `Edge`-separated list rows (`Coal` -> `Iron` hover -> `Slate` active) without card-in-card nesting or left accent rails. |
| **Button, Input, Badge, Tabs** | `apps/web/components/ui/*` | Raised touch heights (`44px+` primary), `12px` minimum badge size (`#396A56` Verified border), `13px` readable field labels. |
| **Dialog** | `apps/web/components/ui/Dialog.tsx` | Solid `.smn-dialog-surface`, `44×44px` close button, full keyboard Tab trap and focus restoration on close. |
| **IntervalEmptyComposition** | `apps/web/components/ui/IntervalEmptyComposition.tsx` | Replaced technical monospace `ACTIVE RULE` box with calm `<ThresholdMark variant="separated" />` sculptural composition and sentence-case guidance. |

---

## 3. Proposed Brand Decision Log Item (For Founder Review at Milestone 2 Gate)

- **Decision ID:** `DEC-UI-01` (Proposed, Awaiting Founder Approval)
- **Proposal:** Adopt **The Threshold Mark** (`ThresholdMark.tsx`, twin stepped forms separated by an interval where an `Ember` square appears upon alignment) for signature product surfaces (empty states, Mutual Match moment, Sign In editorial column), and optionally evaluate replacing/complementing the navigation `Symbol` concept `A`.
- **Current Safeguard:** Existing `<Logo />` and `<Symbol concept="A" />` remain unchanged across `<Navbar />`, `<PublicFooter />`, and `<LandingPage />` until explicit Founder sign-off after reviewing Milestone 2 prototypes.
