# Phase 2 High-Fidelity Creative Design — SayMyName.in

**Project:** SayMyName.in — The First Impression Project
**Phase:** 2 of 6 (High-Fidelity Creative Direction, 3D & Photography Production)
**Prototype Path:** [phase2-preview/index.html](file:///i:/saymyname-landing/docs/implementation/landing-page/phase2-preview/index.html)
**Status:** `PROPOSED HIGH-FIDELITY PROTOTYPE` — Production `apps/web/app/page.tsx` remains unchanged pending Phase 3 approval.

---

## 1. Visual Evolution: *Editorial Romance* Inside *Mineral Night*

The Phase 2 high-fidelity prototype evolves SayMyName's existing Document 10 foundation without breaking brand continuity:
- **Preserved Brand Core:** Dark atmospheric *Mineral Night* stages (`Void #0B0D10`, `Coal #12161B`, `Iron #1A2027`, `Slate #252D37`, `Edge #343D48`), `Instrument Sans` typography, `SayMyName` Interval symbol & wordmark, architectural non-pill radii (`0px`, `4px`, `8px`, `12px`), and calm restrained contrast (`Chalk #F0F1EE`, `Silver #B6BDC4`, `Ash #8B949E`).
- **Editorial Warmth Uplift:** Shifts emphasis from cold schematic geometry (`"THE INTERVAL ARCHITECTURE v1.0"`) toward tactile warm `Ember #E18A62` directional key illumination (`0–2%` surface accent share) inside **Two Lights Across the Interval**, generous headline-to-body contrast ratio (`63.4px / 17px` desktop), asymmetrical grids, and clear real-product storytelling.
- **Strict Category & Honesty Discipline:** Unmistakably reads as a **dating platform** within 5 seconds via eyebrow (`"Dating for verified 18+ IIT Madras BS students"`), headline, conversational product showcase, and candid human imagery framing—with zero fake social proof or unreleased Phase 4+ feature claims.

---

## 2. Typography & Spacing System

| Role | Desktop (`1440px`) | Laptop (`1280px`) | Tablet (`768px`) | Mobile (`375px–430px`) | Line Height / Tracking | Colour |
|---|---|---|---|---|---|---|
| Display Hero (`H1`) | `63.4px` (`clamp`) | `56.3px` | `46px` | `35–38px` | `0.99–1.04` / `-0.028em` | `Chalk #F0F1EE` |
| Section Heading (`H2`) | `38.3px` | `36px` | `30px` | `26–28px` | `1.08` / `-0.022em` | `Chalk #F0F1EE` |
| Eyebrow Label | `12.5px` | `12.5px` | `12px` | `12px` (floor >= 12px) | `1.3` / `0.06–0.1em` | `Iris #8580C4` / `Ember #E18A62` |
| Editorial Body Copy | `16–17px` | `16–17px` | `15.5px` | `14.5–15px` | `1.42–1.62` / default | `Silver #B6BDC4` |
| Trust / Legal Note | `12.5–13px` | `12.5–13px` | `12.5px` | `12px` | `1.38–1.48` | `Ash #8B949E` |

- **Alternating Section Cadence:** `Void` (Hero) → `Coal` (Across Cities) → `Void` (Inside SayMyName) → `Coal` (How Joining Works) → `Void` (Shared Community) → `Coal` (Trust & Control) → `Void` (Invitation & Share) → `Coal` (Footer).
- **Anti-Card-Grid Restraint:** Rather than turning every section into identical grids of boxed cards, each section uses a purpose-built composition:
  - *Section 02 (Across Cities):* Editorial image-left + typographic prose-right with inline typographic anchors.
  - *Section 03 (Inside SayMyName):* `5:7` interactive tabbed product stage (`Discover` / `Mutual Match` / `Private 1:1 Chat`).
  - *Section 04 (How Joining Works):* `5`-step calm horizontal timeline row + transparent single-line expectation bar.
  - *Section 05 (Shared Community):* Ruled editorial typographic ledger (`BS · DSA`, `BS · ES`, `BS · AST`, `BS · MDS` across `Foundation · Diploma · Degree`) replacing giant boxy curriculum grids.
  - *Section 06 (Trust & Personal Control):* Three spacious architectural pillars (`Verified 18+ peer community`, `Private chat only on mutual match`, `Always in your hands`).
  - *Section 07 (Invitation & Share):* Asymmetrical closing invitation + standalone `Create Account` button + dignified peer-share card (`saymyname.in/?src=peer`).

---

## 3. Responsive Strategy & Mobile Hero Achievement

Preserves Phase 1's strict first-screen mobile discipline across every tested viewport (`1440px`, `1280px`, `1024px`, `768px`, `430px`, `390px`, `375px`):
- Desktop (`1280–1440px`) anchors both Hero copy and the full paired sculptural/editorial composition inside the fold (`ctaBottom: 526–547px`, `100%` Hero stage visibility).
- Tablet (`768×1024`) drops cleanly into an `8-col`-style full-width editorial flow with `16:9` horizontal paired stage (`100%` visible at `y=626..946px`, eliminating Phase 0's `200px` dead space).
- Compact Mobile (`375×667`) displays Header + Eyebrow + 3-line Display Headline + Full Supporting Copy + Full-width `46px` `Create Account` CTA + `See how it works ↓` + Eligibility/Trust Context + **`55%` (`~97px` glowing aperture crop)** of `#hero-visual-stage` directly above the initial fold—and `100%` of `#hero-visual-stage` above the fold at `390×844` and `430×932`.

---

## 4. CTA, Product Preview & Footer Decisions

- **Primary CTA Hierarchy:** Single unified **`Create Account`** (`#8580C4`, `8px` radius, `48px` hero / `38px` nav) paired cleanly with quiet text anchor **`See how it works ↓`** (`#how-it-works`). Returning users reach **`Sign In`** clearly in the top bar across desktop and mobile.
- **Product Preview Fidelity:** All demo tabs depict exclusively verified baseline `9e1a58d` functionality (`Discover`, `Likes`/`Mutual Match`, async `1:1 Text Chat` + `Unmatch / Safety` control visibility), clearly stamped `Sample product preview · Illustrative` with zero invented user counters.
- **Footer Integrity:** Retains complete legal/governance structure (`Overview`, `Inside SayMyName`, `How It Works`, `Eligibility Guide`, `Safety & Consent`, `Member Sign In`, `Create Account`, `Password Recovery`, `Privacy Notice`, `Terms of Use`, `Member Support`) and explicit IIT Madras non-affiliation language.
