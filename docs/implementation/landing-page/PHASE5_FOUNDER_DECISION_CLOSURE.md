# Phase 5: Founder Decision Closure — SayMyName.in

**Project:** SayMyName.in — The First Impression Project
**Phase:** 5 (Final Planned Phase)
**Authority:** `docs/implementation/landing-page/PHASE4_CANONICAL_DECISION_REGISTER.md`
**Decision Closure Timestamp:** `2026-11-26T19:03:16+05:30`

---

## 1. Recorded Decisions (`DEC-LP-01` .. `DEC-LP-09`)

Every status below reflects explicit founder responses recorded verbatim during Phase 5 review interaction at `2026-11-26T19:03:16+05:30`:

| ID | Canonical Decision | Chosen Option | Status | Approver | Evidence & Timestamp | Dependencies / Consequence |
| --- | --- | --- | --- | --- | --- | --- |
| `DEC-LP-01` | Hero headline & primary/secondary CTAs | **Candidate A** (*"Same world. Different cities. A chance to meet."*) + **`Create Account`** + **`See how it works`** | **`APPROVED`** | Founder / Product Owner | Interaction answer A1 (`2026-11-26T19:03:16+05:30`) | Locked inside `HERO_CANDIDATES.A` and `page.tsx` metadata |
| `DEC-LP-02` | Hero focal visual strategy & photo budget | **Option A: `3D-01` Two Lights 3D-only hero** (`₹0` spend; zero placeholders) | **`APPROVED`** | Founder / Product Owner | Interaction answer A2 (`2026-11-26T19:03:16+05:30`) | `IMG-01..03` commissioning remains unspent; zero placeholder images in production |
| `DEC-LP-03` | Visitor navigation labels | `How It Works`, `Eligibility`, `Safety`, `Sign In`, `Create Account` | **`APPROVED`** | Founder / Product Owner | Interaction answer A1 (`2026-11-26T19:03:16+05:30`) | Active cleanly in `Navbar.tsx` when editorial landing enabled |
| `DEC-LP-04` | Deferred product feature omission | **Option 1: Strict Phase 1 omission** (calls, voice notes, video, games, virtual dates, Relationship Space UI excluded) | **`APPROVED`** | Founder / Product Owner | Interaction answer A1 (`2026-11-26T19:03:16+05:30`) | Enforced in UI & automated `landing-flag.test.ts` assertions |
| `DEC-LP-05` | Cookie-less analytics & `?src=peer` share attribution | Keep analytics & `?src=peer` disabled; clean `https://saymyname.in` share URL only | **`DEFERRED`** | Founder (legal review pending) | Interaction answer A3 (`2026-11-26T19:03:16+05:30`) | Zero telemetry/tracking/attribution params present; unblocked launch path |
| `DEC-LP-06` | `1200×630` Open Graph social artwork | **Direction A (`og-direction-a-editorial.png`)** copied to `public/images/landing/og/saymyname-og-direction-a.png` & wired in metadata | **`APPROVED`** | Founder / Product Owner | Interaction answer A3 (`2026-11-26T19:03:16+05:30`) | Ingested, hashed, wired into `app/page.tsx` `openGraph` & `twitter` tags |
| `DEC-LP-07` | Production feature-flag activation (`LANDING_PAGE_EDITORIAL_ENABLED=true`) | **Authorized for candidate build & PR preparation only** (hold production activation) | **`APPROVED`** *(Candidate Scope)* / **`DEFERRED`** *(Prod Env)* | Founder / Product Owner | Interaction answer A4 (`2026-11-26T19:03:16+05:30`) | Candidate build validated with flag `true`; production `.env` unchanged (`false`) |
| `DEC-LP-08` | Final production release & `main` merge authorization | **Hold live production merge & deployment** pending PR review | **`DEFERRED`** *(Release Held)* | Founder / Product Owner | Interaction answer A4 (`2026-11-26T19:03:16+05:30`) | Workstream finishes cleanly as `CONDITIONALLY COMPLETE` on `landing-page-repositioning` |
| `DEC-LP-09` | Final `3D-01` Two Lights rendering method | Approve existing **WebGL2 SDF shader compressed AVIF/WebP renders** (Cycles re-render deferred/not needed) | **`APPROVED`** | Founder / Product Owner | Interaction answer A2 (`2026-11-26T19:03:16+05:30`) | No Blender installation or external render commission executed |
