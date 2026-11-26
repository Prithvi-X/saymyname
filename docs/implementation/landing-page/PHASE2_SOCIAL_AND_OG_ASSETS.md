# Phase 2 Social & Open Graph Artwork Report — SayMyName.in

**Project:** SayMyName.in — The First Impression Project
**Phase:** 2 of 6 (`Workstream E`)
**Source & Exports:** [assets/social/og-source.html](file:///i:/saymyname-landing/docs/implementation/landing-page/phase2-preview/assets/social/og-source.html)
**Integration Status:** Prepared & inspected cleanly in `phase2-preview/assets/social/` — **held unintegrated outside `apps/web/public/` until `DEC-LP-01`/`DEC-LP-02` human approval** (Section 8 boundary).

---

## 1. Two Open Graph Design Directions (`1200 × 630 px`)

| Direction | Files & Sizes | Visual Composition & WhatsApp/X Behaviour | Strengths & Watchout |
|---|---|---|---|
| **Direction A: Editorial Split *(Recommended Primary)*** | `og-direction-a-editorial.png` (`120,791 B`), `og-saymyname-candidate-a.jpg` (`75,911 B`) | Left `700px`: `SayMyName` Interval lockup + `DATING · 18+ IIT MADRAS BS COMMUNITY` + `3`-line H1 `"Same world. Different cities. A chance to meet."` + crisp subcopy + `saymyname.in` & IITM disclaimer. Right `500px`: `3D-01 Two Lights` illuminated monoliths fading seamlessly via soft alpha gradient. | **Cleanest X/Twitter (`summary_large_image`), Telegram & Discord wide card.** Watchout: WhatsApp compact square thumbnail crops edge margins; text sits safely inside left-center but slightly clipped if cropped strictly to center 630×630. |
| **Direction B: Centered Monolith Square-Safe Edition** | `og-direction-b-monolith.png` (`150,041 B`), `og-saymyname-candidate-b.jpg` (`73,916 B`) | Centers dark framed card (`590×550 px`) directly over warm ambient `Two Lights` glow so even an aggressive `1:1` WhatsApp mobile center crop keeps logo, `18+ Non-Campus BS Cohort`, full headline, and URL `100%` unclipped. | **Superior safety in strict `1:1` WhatsApp link thumbnails.** Slightly darker/quieter sculpture visibility vs Direction A's right-column spotlight. |

---

## 2. Metadata Compatibility & Honesty Verification

- **Copy Check:** Zero fake member totals, zero match claims, zero urgency countdowns, zero generated human faces, and zero IIT Madras endorsement implications.
- **Recommended Export Format for Production (`Phase 3`):** `JPG` (`~74–76 KB`, `<300 KB` WhatsApp preview ceiling!) or `PNG` (`121 KB`) served statically at `https://saymyname.in/og-saymyname.png` with explicit `width: 1200`, `height: 630`, and `alt` text (`"SayMyName dark architectural Interval mark with headline Same world. Different cities. A chance to meet."`).
- **Remaining Approvals Required Before Copying to `apps/web/public/`:** `DEC-LP-01` (Headline Candidate A approval) + choice between **Direction A** and **Direction B** OG layout.
