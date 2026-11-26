# Phase 1 Tablet & Mobile Wireframes (`768px`, `430px`, `390px`, `375px`) — SayMyName.in

**Project:** SayMyName.in — The First Impression Project  
**Phase:** 1 of 6 (Positioning, Messaging, Content Architecture & Wireframing)  
**Design Principle (`Document 10 §19`):** *"Recompose, do not shrink. Keep primary actions reachable, text readable and no horizontal overflow."*  
**Phase 0 Fixes Targeted Directly:**
1. Eliminate `768px` `200px` dead gap under Hero + oversized `650×300` blueprint box.
2. Eliminate `390×844` cropped-in-half Hero visual boundary.
3. Eliminate `375×667` text-only fold saturation by ensuring **Eyebrow + Headline + concise subcopy + `Create Account` CTA + focal Hero composition ALL sit inside `667px`**!

---

## 1. Responsive Breakpoint Budget Table (`768px -> 375px`)

| Metric | `768 × 1024` (Tablet Portrait) | `430 × 932` (Large Mobile) | `390 × 844` (Std Mobile) | `375 × 667` (Compact Mobile) |
|---|---|---|---|---|
| **Grid & Margins** | `8 cols`, `32px` margins, `16px` gutter | `4 cols`, `20px` margins, `14px` gutter | `4 cols`, `20px` margins, `12px` gutter | `4 cols`, `18px` margins, `12px` gutter |
| **Header Height** | `64px` (shows full `How It Works`, `Eligibility`, `Safety`, `Sign In`, `Create Account`) | `60px` (`Logo` + `Sign In` link + Hamburger) | `60px` (`Logo` + `Sign In` link + Hamburger) | `60px` (`Logo` + `Sign In` link + Hamburger) |
| **Hero `H1` Scale** | `48px / 1.03` (`max-w-[15ch]`) | `42px / 1.04` | `40px / 1.04` | `38px / 1.05` (tight clean 3 lines; >= `12px` minimum micro-text) |
| **Hero Subcopy** | Full 2 sentences (`16px`, `~50ch`) | Full 2 sentences (`15px`) | Full 2 sentences (`15px`) | Compact mobile phrasing (`15px`, `3` lines `~66px`) |
| **Hero CTAs** | `Create Account` (`h:48`) + `See how it works ↓` inline | `Create Account` (`w-full h:48`) + `See how it works ↓` below | `Create Account` (`w-full h:48`) + `See how it works ↓` below | `Create Account` (`w-full h:48`) + `See how it works ↓` inline row |
| **Hero Visual (`3D-01` + `IMG-01`)** | `16:10` wide paired strip directly under CTAs (`height ~320px`, `100%` in fold!) | `16:9` cropped frame **visible above fold (`y ~450..660px`)** | `16:9` cropped frame **visible cleanly above fold (`y ~440..636px`, ZERO clip!)** | `16:9` compact focal frame (`~190px` tall, sitting cleanly at **`y ~440..630px` inside `667px` fold!**) |
| **Section 03 Product Preview** | `3` Interactive Tabs (`Discover` / `Match` / `Chat`) above spacious single-card stage | Tab bar + single focused card (`100%` width, zero horizontal scroll) | Tab bar + single focused card (`350px` inner width) | Tab bar + single focused card (`339px` inner width) |
| **Est. Scroll Height** | `~3,150 px` (`3.08×`) | `~2,980 px` (`3.20×`) | `~3,040 px` (`3.60×`) | `~3,100 px` (`4.65×` vs Phase 0 `6.92×`!) |

---

## 2. Tablet Wireframe (`768 × 1024`)

At `768px`, squeezing two narrow `50/50` columns produces cramped line breaks; instead, Tablet **recomposes** into clean broad bands while still keeping the Hero Visual **inside `y < 920px`**:

```text
+----------------------------------------------------------------------+
| HEADER (64px): [Logo]  How It Works   Eligibility  Safety  Sign In [Create Account] |
+----------------------------------------------------------------------+
| HERO (Void #0B0D10, padding: 48px 32px)                              |
|  Dating for verified 18+ IIT Madras BS students (12px)               |
|  Same world. Different cities.                                       |
|  A chance to meet.  (48px Chalk)                                     |
|                                                                      |
|  An intentional dating space for verified adults (18+) currently     |
|  enrolled in IIT Madras's four non-campus BS programmes... (16px)    |
|                                                                      |
|  [ Create Account (h:48px) ]    See how it works ↓                   |
|  Confirmed BS inbox · Manual 18+ review · Private photos (12px Ash)  |
|  Independent platform—not affiliated with IIT Madras. (12px Ash)     |
|                                                                      |
|  +----------------------------------------------------------------+  |
|  | HERO VISUAL STAGE (16:9 / 704×310px — ZERO dead gap!)          |  |
|  | Left 55%: Concept 1 Two Lights sculpture | Right 45%: IMG-01   |  |
|  +----------------------------------------------------------------+  |
|  (Fits cleanly y=64..890px inside 1024px tablet fold!)               |
+----------------------------------------------------------------------+
| BAND 2: ACROSS CITIES AND SCREENS (Coal | Stacked 8-col + Photo)     |
|  Why we built this (12px)                                            |
|  You share the same term. Just rarely the same city. (32px)          |
|  [ IMG-02 Wide 16:9 Architectural Crop (704×260px) ]                 |
|  2 editorial paragraphs in comfortable 60ch measure                  |
+----------------------------------------------------------------------+
| BAND 3: INSIDE SAYMYNAME (Void)                                      |
|  Headline -> Interactive Segmented Selector [Discover|Match|Chat]    |
|  Centered balanced Coal Preview Frame (640px wide, 2-col image+copy)  |
+----------------------------------------------------------------------+
| BAND 4: HOW JOINING WORKS (Coal)                                     |
|  2×3 clean architectural grid (Steps 01-05 + Expectation Note box)   |
+----------------------------------------------------------------------+
| BAND 5: SHARED COMMUNITY (Void)                                      |
|  Full-width headline + clean 4-row hairline ledger (DSA/ES/AST/MDS)  |
+----------------------------------------------------------------------+
| BAND 6: TRUST & CONTROL (Coal) -> 3 clean full-width horizontal rows |
|  with icon left + title & concise reassurance right                  |
+----------------------------------------------------------------------+
| BAND 7: INVITATION & SHARE (Void) -> Side-by-side 4:4 columns:       |
|  Left: "There are people... [Create Account]" | Right: Peer Share    |
+----------------------------------------------------------------------+
| FOOTER (Coal) -> 2×2 link grid cleanly aligned at 32px margins       |
+----------------------------------------------------------------------+
```

---

## 3. Mobile Wireframes (`430px`, `390px`, `375px`)

Notice how **exact vertical allocation** solves the `375×667` compact mobile viewport while keeping `390×844` and `430×932` spacious and balanced.

### Above-the-Fold Pixel Budget (`375 × 667` Tightest Viewport Guarantee)

```text
y = 0..60px     [SayMyName Logo]                  Sign In   [≡ Menu]   (60px)
                -------------------------------------------------------
y = 60..76px    (16px top padding)
y = 76..96px    Dating · 18+ IIT Madras BS Cohort   (12px Iris, 1 line)
y = 104..224px  Same world.                                            (38px Chalk,
                Different cities.                                       line-height 1.05,
                A chance to meet.                                       ~120px tall)
y = 234..298px  For verified adults (18+) in IITM's four non-campus BS (15px Silver,
                programmes—discover peers beyond study channels and    compact 3 lines,
                connect on mutual match.                                ~64px tall)
y = 314..362px  [        Create Account        ]  (48px tall, 100% width, Iris)
y = 370..396px  See how it works ↓   ·   Not affiliated with IIT Madras (12px Ash/Silver)
y = 410..602px  +---------------------------------------------------+
                |  HERO FOCAL VISUAL (16:9 crop = 339 × 191px)      |  (100% ABOVE
                |  Sculptural Two Lights Aperture + Warm Dusk Scene |   THE 667px
                |  [0px / 10px crisp edge, ZERO text inside image]  |   FOLD!)
                +---------------------------------------------------+
y = 602..667px  Safe bottom breathing margin + subtle Section 02 transition edge!
```

*At `390 × 844` (`+177px` vertical space) and `430 × 932` (`+265px` vertical space):*
- Hero restores `16px` additional padding, `40–42px` H1, comfortable full Hero subcopy, explicit trust line (`"Manual 18+ review · Private photos · No stranger DMs"`), and slightly taller `4:3` or `16:10` focal visual (`~235px`) **with generous breathing room above the fold edge—never clipped!**

### Full Mobile Vertical Stack Below the Fold (`375px–430px`)

```text
-----------------------------------------------------------------------
BAND 2: ACROSS CITIES AND SCREENS (Coal #12161B | pad: 48px 18px)
  Why we built this (12px)
  You share the same term. Just rarely the same city. (28px Chalk)
  +-----------------------------------+
  | IMG-02 (16:10 crop, 0px/8px edge) |
  +-----------------------------------+
  Paragraph 1 & 2 (15px Silver, 1.5 line-height, short scannable breaks)
-----------------------------------------------------------------------
BAND 3: INSIDE SAYMYNAME (Void #0B0D10 | pad: 52px 18px)
  Inside the platform (12px)
  Profiles worth reading. Conversations that start only when both agree. (26px)
  
  [ Discover ]  [ Mutual Match ]  [ Private Chat ]   (4px architectural tabs, min-h:44px)
  +-----------------------------------+
  | Sample product preview · Example  |
  | (Shows 1 clean vertical view per  |
  |  selected tab — Discover portrait |
  |  + Ananya, 22 + Pune + Prompt +   |
  |  Pass/Like dock, OR Match card,   |
  |  OR Chat messages + Safety bar)   |
  +-----------------------------------+
-----------------------------------------------------------------------
BAND 4: HOW JOINING WORKS (Coal #12161B | pad: 48px 18px)
  Verified once, calmly—before Discover opens. (26px)
  01  Create account & confirm BS inbox (2-line body)
  02  Confirm 18+ adult eligibility (2-line body)
  03  Select BS track & optional enrolment note (no gov ID)
  04  Build profile draft while review runs
  05  Add genuine portrait & enter Discover
  [Calm note: Manual review is not instant.]
  Read full eligibility criteria → (/eligibility)
-----------------------------------------------------------------------
BAND 5: THE SHARED COMMUNITY (Void #0B0D10 | pad: 44px 18px)
  Four non-campus BS tracks. One shared community. (26px)
  -----------------------------------
  BS · DSA  | BS in Data Science and Applications (Foundation·Diploma·Degree)
  BS · ES   | BS in Electronic Systems            (Foundation·Diploma·Degree)
  BS · AST  | BS in Aeronautics & Space Tech      (Foundation·Diploma·Degree)
  BS · MDS  | BS in Management and Data Science   (Foundation·Diploma·Degree)
  -----------------------------------
-----------------------------------------------------------------------
BAND 6: TRUST AND PERSONAL CONTROL (Coal #12161B | pad: 48px 18px)
  Respect is designed into how people connect. (26px)
  +-----------------------------------+
  | [Shield] Verified 18+ community   |
  +-----------------------------------+
  | [Lock] Private chat on mutual only|
  +-----------------------------------+
  | [Control] Always in your hands    |
  +-----------------------------------+
  Read full Safety & Consent Architecture → (/safety)
-----------------------------------------------------------------------
BAND 7: INVITATION & SHARE (Void #0B0D10 | pad: 52px 18px)
  There are people in your world you haven't met yet. (28px Chalk)
  Short reassuring paragraph (15px)
  [        Create Account        ]  (Full width, 48px Iris primary CTA)

  +-----------------------------------+
  | Know someone eligible?            |
  | Share a quiet link with a friend  |
  | in the IITM BS programme.         |
  | [     Share SayMyName     ] (Sec) |
  +-----------------------------------+
-----------------------------------------------------------------------
FOOTER (Coal #12161B | pad: 40px 18px | Clean single-col stacked sections)
-----------------------------------------------------------------------
```

---

## 4. Mobile Touch, Overflow & Safe-Space Rules

- **Minimum interactive target height:** Every tab (`Discover | Match | Chat`), accordion/menu toggle, nav link, and CTA button enforces `min-h-[44px]` (`48px` for primary `Create Account`).
- **Minimum readable font sizes (`Doc 10 §09`):** `12px` minimum for legal/trust micro-copy and eyebrows; `15px–16px` for all paragraphs; zero `10px–11px` labels on `/` landing surfaces.
- **Sticky Mobile Bottom Bar Check:** Unauthenticated visitors do **not** render `BottomNav.tsx` (`authState !== 'VERIFIED_MEMBER'`), so mobile bottom inset remains free (`0px` bottom bar occlusion). No forced sticky bottom CTA bar is needed once the Hero CTA + Section 07 CTA anchor top and bottom cleanly without cluttering `375×667`.
- **Safe Horizontal Containment:** `.smn-stage-wrap` (`overflow-x: clip`) + `min-w-0` grid children guarantee `scrollWidth === innerWidth` across `375px`, `390px`, `430px`, and `768px`.
