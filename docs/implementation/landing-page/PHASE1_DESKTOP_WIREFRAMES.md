# Phase 1 Desktop Wireframes (`1440px` & `1280px`) — SayMyName.in

**Project:** SayMyName.in — The First Impression Project  
**Phase:** 1 of 6 (Positioning, Messaging, Content Architecture & Wireframing)  
**Grid Authority:** `Document 10 §10` — `12` columns, `40–64px` outer margins (`1280–1599px`), `20px` gutters, `max-w-[1280px]` container, *Mineral Night* dark surfaces, `0/4/8/12px` architectural radii (**zero pills**).  
**Status:** `PROPOSED — LOW-FIDELITY BLUEPRINT` (All text shown reflects real proposed copy; **zero Lorem Ipsum**).

---

## 1. Responsive Scaling Summary (`1440px` vs `1280px`)

| Metric | `1440 × 900` (Wide Laptop / Desktop) | `1280 × 720` (Standard Laptop) |
|---|---|---|
| Outer Container Width | `1280 px` (`80 px` side breathing room each side) | `1184 px` (`48 px` outer margins) |
| Grid System | `12 cols`, `20 px` gutter | `12 cols`, `20 px` gutter |
| Sticky Header Height | `66 px` | `66 px` |
| Hero Display `H1` | `64 px / 0.98` (`max-w-[13ch]` / 3 crisp lines) | `58 px / 1.00` (3 crisp lines so CTA sits comfortably above `720px`) |
| Above-the-Fold Target (`y <= vh`) | Full Header (`0..66`) + Complete Hero Left & Right (`66..690`) + clean breathing space showing Section 02 eyebrow cue (`~820px`) | Full Header (`0..66`) + Complete Hero Left (`H1 + subcopy + CTAs + trust line`) & Right (`3D-01` + `IMG-01`) fitting `100%` inside `66..700 px` |
| Estimated Total Scroll Height | `~3,360 px` (`3.73×` of `900px`) | `~3,420 px` (`4.75×` of `720px`) |

---

## 2. Full `1440px` & `1280px` Wireframe Specification

```text
====================================================================================================
BAND 0: STICKY HEADER (.smn-glass-nav | Height: 66px | Full-width border-b Edge #343D48)
====================================================================================================
[SayMyName Logo]    How It Works    Eligibility    Safety                     Sign In   [Create Account]
(col 1-2)           (col 3-6, subtle Silver links, 14px, 28px gap)            (Silver)  (Iris #8580C4, 8px radius, h:40px)
----------------------------------------------------------------------------------------------------

====================================================================================================
BAND 1: HERO — THE FIRST IMPRESSION (Void #0B0D10 | Height: ~640px @1280 / ~720px @1440)
Padding top: 56px (@1280) / 72px (@1440) | Padding bottom: 64px | 12-Col Asymmetrical Split (7 : 5)
====================================================================================================
  LEFT (Cols 1-7, max-width ~620px)                  RIGHT (Cols 8-12, Focal Visual Stage)
  +---------------------------------------------+     +------------------------------------------+
  | Dating for verified 18+ IIT Madras BS       |     |  [ 3D-01 + IMG-01 Paired Composition ]   |
  | students  (13px Iris/Silver, NO pill tag)   |     |                                          |
  |                                             |     |  +------------------------------------+  |
  | Same world.                                 |     |  | Dual ceramic/basalt monoliths     |  |
  | Different cities.                           |     |  | catching warm Ember key light      |  |
  | A chance to meet.                           |     |  | across a narrow vertical interval  |  |
  | (H1: 64px @1440 / 58px @1280, Chalk #F0F1EE)|     |  | + framed editorial dusk vignette   |  |
  |                                             |     |  +------------------------------------+  |
  | An intentional dating space for verified    |     |                                          |
  | adults (18+) currently enrolled in IIT      |     |  (Aspect 4:4.2 or 5:5.5, crisp 0px/12px  |
  | Madras's four non-campus BS programmes.     |     |   architectural frame, ZERO telemetry    |
  | Discover peers beyond study channels, match |     |   badges, ZERO v1.0 circuit diagrams!)   |
  | on mutual interest, and start thoughtful    |     +------------------------------------------+
  | conversations. (17px Silver, max-w-[50ch])  |
  |                                             |
  | [ Create Account ]     See how it works ↓   |
  | (Primary Iris h:48px)  (Text link, 14px)    |
  |                                             |
  | Confirmed BS inbox · Manual 18+ review ·    |
  | Private photos · No stranger DMs (13px Ash) |
  |                                             |
  | Independent platform—not owned, operated,   |
  | or endorsed by IIT Madras. (12px Ash)       |
  +---------------------------------------------+
====================================================================================================

====================================================================================================
BAND 2: ACROSS CITIES AND SCREENS (Coal #12161B | Height: ~500px | Border-y Edge)
Padding: 80px 0 | 12-Col Split (5 Cols Story Image Left : 7 Cols Editorial Narrative Right)
====================================================================================================
  LEFT (Cols 1-5)                                     RIGHT (Cols 7-12, vertical-center aligned)
  +---------------------------------------------+     Why we built this (12px Iris uppercase)
  |  [ IMG-02 Editorial Human Scene ]           |
  |                                             |     You share the same term.
  |  Authentic warm tungsten café/evening study |     Just rarely the same city.
  |  scene (modelled lifestyle context, 4:3 or  |     (H2: 38px Chalk, line-height 1.08)
  |  4:4.5, 0px architectural image radius)     |
  |                                             |     Studying for an IIT Madras non-campus BS
  |                                             |     degree means balancing deadlines, OPPE
  |                                             |     sessions, and career goals across India...
  +---------------------------------------------+
                                                      SayMyName gives that shared context a
                                                      private, intentional space of its own...

                                                      --- Across cities   --- Beyond study chats
====================================================================================================

====================================================================================================
BAND 3: INSIDE SAYMYNAME — PRODUCT PREVIEW (#inside-saymyname | Void #0B0D10 | Height: ~680px)
Padding: 88px 0 | 12-Col Interactive Showcase (5 Cols Selector Left : 7 Cols Live UI Frame Right)
====================================================================================================
  LEFT (Cols 1-5)                                     RIGHT (Cols 6-12 | Coal #12161B Panel, r:12px)
  Inside the platform (12px Ember)                    +------------------------------------------+
  Profiles worth reading. Conversations that          | [Sample product preview · Illustrative]  |
  start only when both agree. (H2: 34px Chalk)        |------------------------------------------|
                                                      |  [Tab Active View based on Left Step]    |
  No endless swipe decks, compatibility scores,       |                                          |
  or random chat roulette... (15px Silver)            |  IF STEP 01 SELECTED: DISCOVER CARD      |
                                                      |  +------------------+  [VERIFIED] [DSA]  |
  +---------------------------------------------+     |  |  IMG-03 Model    |  Ananya, 22        |
  | > 01 Discover                               |     |  |  Portrait (4:4)  |  Diploma · Pune    |
  |     Read real prompts, city & track context |     |  |  (Sample label)  |  "A quiet Sunday.."|
  +---------------------------------------------+     |  +------------------+  [Pass] [Send Like]|
  |   02 Mutual Match                           |     |                                          |
  |     Two forms align—no DM until both agree  |     |  (Tab 02 shows THE INTERVAL match alignment|
  +---------------------------------------------+     |   + "Open Conversation" / "Keep Discovering"|
  |   03 Private 1:1 Chat                       |     |   Tab 03 shows calm async 1:1 text chat + |
  |     Unhurried conversation with safety tools|     |   visible Unmatch / Safety header controls)|
  +---------------------------------------------+     +------------------------------------------+
====================================================================================================

====================================================================================================
BAND 4: HOW JOINING WORKS (#how-it-works | Coal #12161B | Height: ~430px)
Padding: 76px 0 | Full 12-Col Horizontal Timeline Header + 5 Stepped Columns
====================================================================================================
  Header Row: [Transparent onboarding]  Verified once, calmly—before Discover opens.   [Full rules →]
  Subtext:    Every profile belongs to an adult student who passed the same thoughtful check...

  +----------------+   +----------------+   +----------------+   +----------------+   +--------------+
  | 01             |-->| 02             |-->| 03             |-->| 04             |-->| 05           |
  | BS Inbox &     |   | 18+ Adult      |   | BS Track &     |   | Build Draft    |   | Add Portrait |
  | Password       |   | Eligibility    |   | Enrolment Note |   | During Review  |   | & Enter App  |
  | Use study.iitm |   | Enter DOB once;|   | Pick BS track; |   | Human reviewer |   | Upload R2    |
  | email + 6-digit|   | exact birth    |   | optional proof |   | checks once—no |   | portrait and |
  | OTP confirm.   |   | stays hidden.  |   | (NO gov IDs).  |   | instant access.|   | publish card.|
  +----------------+   +----------------+   +----------------+   +----------------+   +--------------+
  Expectation Note (13px Silver): Manual verification is not instant; we never ask for gov IDs.
====================================================================================================

====================================================================================================
BAND 5: THE SHARED COMMUNITY (#community | Void #0B0D10 | Height: ~380px)
Padding: 72px 0 | 12-Col Editorial Ledger (4 Cols Heading Left : 8 Cols Ruled Track List Right)
====================================================================================================
  LEFT (Cols 1-4)                                     RIGHT (Cols 6-12 | Edge hairline rows)
  Phase 1 community scope (12px Iris)                 --------------------------------------------
  Four non-campus BS tracks.                          BS · DSA  | BS in Data Science & Applications
  One shared community. (H2: 32px)                    (13px)    | Foundation · Diploma · Degree
                                                      --------------------------------------------
  Whether building statistical models, designing      BS · ES   | BS in Electronic Systems
  circuits, or bridging management and data...        (13px)    | Foundation · Diploma · Degree
                                                      --------------------------------------------
  Note (12px Ash): Exclusively verified 18+           BS · AST  | BS in Aeronautics & Space Tech
  non-campus BS peers. Outside unis excluded.         (13px)    | Foundation · Diploma · Degree
                                                      --------------------------------------------
                                                      BS · MDS  | BS in Management & Data Science
                                                                | Foundation · Diploma · Degree
                                                      --------------------------------------------
====================================================================================================

====================================================================================================
BAND 6: TRUST AND PERSONAL CONTROL (Coal #12161B | Height: ~360px)
Padding: 72px 0 | Section Header + 3 Equal Architectural Columns (4 Cols each)
====================================================================================================
  Respect is designed into how people connect.        [Read Safety & Consent Architecture → (/safety)]

  +------------------------------+  +------------------------------+  +------------------------------+
  | [Shield]                     |  | [Lock]                       |  | [UserControl]                |
  | Verified 18+ community       |  | Private chat on mutual match |  | Always in your hands         |
  | Email + manual age & BS      |  | A Like never opens messages. |  | Coarse city/state only—no   |
  | review. Roll numbers & emails|  | Direct chat unlocks strictly |  | live GPS. Private R2 photos; |
  | stay off public cards.       |  | on two-way interest.         |  | instant Unmatch/Block/Report.|
  +------------------------------+  +------------------------------+  +------------------------------+
====================================================================================================

====================================================================================================
BAND 7: INVITATION, NATURAL SHARING & FINAL CTA (#share | Void #0B0D10 | Height: ~340px)
Padding: 76px 0 | 12-Col Split (7 Cols Closing Invitation Left : 5 Cols Peer-Share Card Right)
====================================================================================================
  LEFT (Cols 1-7)                                     RIGHT (Cols 8-12 | Iron #1A2027, Border Edge)
  Begin when you are ready (12px Ember)               +------------------------------------------+
  There are people in your world you haven't          | Know someone eligible who might          |
  met yet. (H2: 38px Chalk)                           | appreciate something calmer?             |
                                                      | Send an IITM BS peer a quiet link—no     |
  Join with your IIT Madras BS study email, move at   | referral points or invite gates.         |
  your pace, and discover peers across cities.        |                                          |
                                                      | [ Share SayMyName ] (or Copy Link)       |
  [ Create Account ]  (Single Primary Iris CTA h:48)  | Link: saymyname.in/?src=peer             |
                                                      +------------------------------------------+
====================================================================================================

====================================================================================================
BAND 8: PUBLIC FOOTER (PublicFooter.tsx Continuity | Coal #12161B | Height: ~260px)
====================================================================================================
  [SayMyName Logo] + Independent Disclaimer  |  PLATFORM       |  ACCESS          |  GOVERNANCE
  Not owned, operated, or endorsed by IITM   |  Overview       |  Member Sign In  |  Privacy Notice
                                             |  How It Works   |  Create Account  |  Terms of Use
                                             |  Eligibility    |  Recovery        |  Member Support
====================================================================================================
```

---

## 3. Spatial & Transition Check (`1440px` & `1280px`)

- **Alternating Surface Rhythm (`Document 10` Elevation Grammar):** `Void (#0B0D10)` -> `Coal (#12161B)` -> `Void` -> `Coal` -> `Void` -> `Coal` -> `Void` -> `Coal (Footer)`. Every transition is naturally grounded by value separation without noisy borders or rainbow gradients.
- **Line Lengths & Readability:** Hero supporting copy constrained to `~50ch`, narrative copy constrained to `54ch`, minimum text size `12px` (`13–15px` standard UI, `16–18px` editorial body).
- **Zero Decorative Telemetry:** Section 03 includes **one honest label** (`Sample product preview · Illustrative layout`) at subtle contrast (`12px Ash`) purely for legal/authenticity compliance (`Doc 10 §13`). Zero fake notification dots, zero member counters, zero wireframe schematics.
