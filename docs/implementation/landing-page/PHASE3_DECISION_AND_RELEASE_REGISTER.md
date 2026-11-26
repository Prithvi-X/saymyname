# Phase 3: Decision & Release Register

**Project:** SayMyName.in — The First Impression Project
**Branch:** `landing-page-repositioning`
**Updated:** 2026-11-26

---

## 1. Human Decision Register (`DEC-LP-01` .. `DEC-LP-06`)

All six product/creative/legal decisions remain **`PROPOSED - HUMAN APPROVAL REQUIRED`**. None were unilaterally approved or bypassed during Phase 3 integration.

| ID | Decision Topic | Phase 3 Default / Fallback Behavior | Status | Required Sign-Off |
| --- | --- | --- | --- | --- |
| `DEC-LP-01` | Hero headline copy (`Candidate A` vs `B` vs `C`) | Config-driven (`HERO_CANDIDATES`); `Candidate A` wired as default preview | `PROPOSED - HUMAN APPROVAL REQUIRED` | Product Owner |
| `DEC-LP-02` | Photography commissioning (`IMG-01`, `IMG-02`, `IMG-03`) | Zero uncommissioned placeholders in `public/`; Band 1 defaults to 3D-led composition (`3d-led`); Band 2 uses Mineral Night meridian SVG; Band 3 uses Document 10 initial badge | `PROPOSED - HUMAN APPROVAL REQUIRED` | Product Owner / Creative |
| `DEC-LP-03` | Two Lights 3D asset final sign-off (`3D-01` WebGL shader renders vs Blender Cycles re-render) | Production uses verified Phase 2 compressed renders (`AVIF`/`WebP`); Blender script `build_two_lights_scene.py` ready if photorealistic re-render requested | `PROPOSED - HUMAN APPROVAL REQUIRED` | Product Owner |
| `DEC-LP-04` | Flag cutover (`LANDING_PAGE_EDITORIAL_ENABLED=true`) | Remains `false` (default legacy `/` active until approved cutover) | `PROPOSED - HUMAN APPROVAL REQUIRED` | Product Owner |
| `DEC-LP-05` | Privacy-safe peer attribution parameter (`?src=peer`) | Strictly **disabled**; `ShareSection` shares/copies clean `https://saymyname.in` | `PROPOSED - HUMAN APPROVAL REQUIRED` | Privacy / Legal + PO |
| `DEC-LP-06` | Social preview card direction (`og-direction-a` vs `og-direction-b`) | Unapproved drafts remain in Phase 2 docs only; not wired to metadata `og:image` yet | `PROPOSED - HUMAN APPROVAL REQUIRED` | Product Owner |

---

## 2. Production Rollout & Rollback Posture

- **Instant Rollback:** Unsetting `LANDING_PAGE_EDITORIAL_ENABLED` or setting `LANDING_PAGE_EDITORIAL_ENABLED=false` restores the exact Phase 2 homepage layout cleanly on rebuild/redeploy with zero database migrations or data cleanup.
- **Boundary Compliance:** `i:\saymyname` (`phase-4-1-calling-safety`), `main`, and production Render deployments were untouched.
