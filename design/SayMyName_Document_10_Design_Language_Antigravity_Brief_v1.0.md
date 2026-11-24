# SAYMYNAME / DOCUMENT 10 IMPLEMENTATION BRIEF
## The Interval - Brand Identity & Digital Design Language

**Authority:** This brief accompanies Document 10. Read the full DOCX before changing shared visual foundations.

## Approved direction
- Primary environment: dark cinematic.
- Design concept: **THE INTERVAL**. Two distinct forms, a deliberate gap, a third shared form revealed through alignment.
- Typography: Instrument Sans as the primary neo-grotesk family. Use its variable weight/width carefully. A custom wordmark is required; do not rely on a stock serif treatment.
- Art direction: an original synthesis of sculptural mass, architectural geometry and selective large-facet digital transformation.
- Visual principle: unusual brand art, familiar and highly usable controls.

## Initial semantic tokens
```css
:root {
  --smn-stage: #0B0D10;
  --smn-surface-base: #12161B;
  --smn-surface-raised: #1A2027;
  --smn-surface-active: #252D37;
  --smn-text-primary: #F0F1EE;
  --smn-text-secondary: #B6BDC4;
  --smn-text-tertiary: #8B949E;
  --smn-border-subtle: #343D48;
  --smn-accent-iris: #8580C4;
  --smn-accent-ember: #E18A62;
  --smn-success: #77C5A1;
  --smn-warning: #E6BC69;
  --smn-danger: #F07878;
  --smn-font-ui: "Instrument Sans", sans-serif;
  --smn-radius-control: 8px;
  --smn-radius-panel: 12px;
  --smn-motion-fast: 130ms;
  --smn-motion-standard: 180ms;
  --smn-motion-context: 260ms;
}
```

## Explicit prohibitions
- No dot grids, scattered particles, halftone clouds, pixel dust or noise backgrounds.
- No decorative vertical line down the left edge of pages.
- No random circuit lines, orbit paths, crosshairs or visible layout grids.
- No capsule navigation, pill controls, full glassmorphism or excessive rounding.
- No purple-blue mesh gradients, blurred blobs, glowing orbs, generic AI illustrations or neon everywhere.
- No fake or AI-generated people presented as actual verified members.
- No copied Breaking Bad title/logo/character/franchise graphics. Only the abstract theme of identity and recognition may inspire the concept.

## Composition
- Use a 12-column desktop grid with broad but controlled content width.
- Do not place a narrow centred column on a very wide monitor.
- Use asymmetry only when hierarchy and reading order remain clear.
- Build each screen around one primary focal point.
- Do not fill empty space with arbitrary cards or decorative widgets.

## Typography
- Use Instrument Sans for the product UI; do not introduce multiple type families without approval.
- Use 400-700 weights; avoid thin weights for small text.
- Display type may use a carefully tuned width axis after visual QA.
- Use mono only for actual codes/technical metadata.

## Motion
- Micro: 100-140ms.
- Standard: 150-210ms.
- Context: 220-300ms.
- Signature moment: 260-380ms and only when the state change has real meaning.
- Respect `prefers-reduced-motion`; never make movement necessary to understand a state.

## Product integrity
Do not alter authentication, student eligibility, mutual consent, privacy, permissions, API contracts or database behaviour during visual work. Product and safety requirements outrank visual preference.

## Implementation sequence
1. Inspect the existing codebase, tokens and screens.
2. Prototype the public hero, Discover profile, Chat and mutual-match moment.
3. Review screenshots at 1920, 1440, 1280, 768, 430, 390, 375 and 360 widths.
4. Refine shared tokens and components before applying the language across all routes.
5. Verify accessibility, performance, reduced motion and functional regression.
6. Report changed files, screenshots, measurements, test outcomes and remaining decisions.

Do not claim the new identity is complete until actual screens have been reviewed at the target sizes and the primary tasks remain clear and functional.
