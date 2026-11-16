# Gyidi Nnwom — iPhone App Design Specification

**Figma-ready handoff document · v1.0 · November 2026**

This document is everything a designer needs to rebuild Gyidi Nnwom in Figma without guessing: exact colour values, type scale, spacing, radii, component anatomy, and a screen-by-screen layout spec with the flow map connecting them.

Every token here is lifted verbatim from the live product's `src/index.css`, so a Figma build from this spec will match the shipped web app.

A companion clickable prototype lives in this folder (`index.html`) — 30 screens at real 390 × 844 iPhone sizing, wired up and tappable. Use it as the interactive reference; use this document as the build recipe.

---

## 1. Canvas & frame setup

| Property | Value |
|---|---|
| Frame size | **390 × 844** (iPhone 14 / 13 / 12 logical viewport) |
| Grid / columns | 4 columns, 18px margin, 12px gutter |
| Background (canvas) | `#000000` |
| App background | `#09090b` |
| Status bar height | **54px** (Dynamic Island safe area) |
| Tab bar height | **78px** (56px bar + 22px home-indicator zone) |
| Home indicator | 134 × 5, radius 3, `rgba(255,255,255,0.35)`, 8px from bottom, centred |
| Horizontal page margin | **18px** |
| Corner radius (device) | 44px inner / 54px outer |

### Safe areas

The app respects iOS safe-area insets via CSS variables. In Figma, model these as fixed reserved bands:

```
top    : 54px   (status bar — never place interactive content here)
bottom : 78px   (tab bar) or 34px (screens without a tab bar)
```

---

## 2. Colour tokens

### Surfaces

| Token | Hex | Usage |
|---|---|---|
| `--bg` / app background | `#09090b` | Every screen base |
| `--surface` | `#121214` | Cards, stat tiles, sheets |
| `--surface-2` | `#18181b` | Row art placeholder, received chat bubble, mini player |
| `--surface-3` | `#27272a` | Disabled / tertiary fills |
| `--line` | `rgba(255,255,255,0.08)` | Hairline borders, dividers |
| `--line-strong` | `rgba(255,255,255,0.14)` | Sheet top edge, active borders |

### Text

| Token | Hex | Usage |
|---|---|---|
| `--text` | `#f4f4f5` | Primary — titles, names, body |
| `--text-2` | `#a1a1aa` | Secondary — subtitles, descriptions |
| `--text-3` | `#71717a` | Tertiary — metadata, timestamps, captions |

### Brand — Forest (primary)

| Step | Hex |
|---|---|
| forest-50 | `#eefaf0` |
| forest-100 | `#c9f4cc` |
| forest-200 | `#9ae89f` |
| forest-300 | `#5fd469` |
| forest-400 | `#2fbf42` |
| **forest-500** | **`#1a9c2a`** ← primary brand action |
| forest-600 | `#107a1c` |
| forest-700 | `#0a5c12` |
| forest-800 | `#06400a` |
| forest-900 | `#032b04` |
| forest-950 | `#012300` |

### Brand — Gold (premium / accent)

| Step | Hex |
|---|---|
| gold-100 | `#ffe9b3` |
| gold-200 | `#ffd873` |
| gold-300 | `#ffc73d` |
| **gold-400** | **`#ffb700`** ← `--color-premium`, active tab, CTA |
| gold-500 | `#fdb300` |
| gold-600 | `#b37d00` |

### Semantic

| Token | Hex | Meaning |
|---|---|---|
| `--color-premium` | `#ffb700` (gold-400) | Premium badge, active tab, primary CTA |
| `--color-verified` | `#1d9bf0` | Verified artiste tick |
| `--color-support` | `#ec4899` | Support / tip, unread dot |
| live | `#22d3ee` | Live stream indicator, sermons |
| danger | `#f43f5e` | Destructive action |

### Gradients

```
Hero card   radial(420×220 @ 88% 8%, rgba(255,183,0,0.30) → transparent 62%)
            over linear(150deg, forest-700 → forest-950 72%)

Player bg   radial(600×420 @ 50% 4%,  rgba(26,156,42,0.28) → transparent 62%)
            radial(420×320 @ 82% 92%, rgba(255,183,0,0.16) → transparent 60%)
            over #09090b

Tile forest linear(140deg, forest-700 → forest-900)
Tile gold   linear(140deg, gold-500 → #7a5200)
Tile pink   linear(140deg, #be185d → #500724)
Tile cyan   linear(140deg, #0891b2 → #083344)
```

---

## 3. Typography

**Two families, and only two.**

| Family | Weights | Role |
|---|---|---|
| **Plus Jakarta Sans** | 700, 800 | Display — screen titles, section headings, player title, stat numbers, buttons on hero |
| **Inter** | 400, 500, 600, 700, 800 | Everything else — body, labels, metadata |

### Type scale

| Style name | Family | Size | Weight | Line-height | Letter-spacing | Colour |
|---|---|---|---|---|---|---|
| Display / Screen title | Plus Jakarta Sans | 22 | 800 | 30 | −0.4 | `--text` |
| Display / Hero | Plus Jakarta Sans | 21 | 800 | 26 | −0.4 | `#ffffff` |
| Display / Player title | Plus Jakarta Sans | 22 | 800 | 28 | −0.4 | `--text` |
| Display / Stat number | Plus Jakarta Sans | 24 | 800 | 30 | −0.6 | token |
| Heading / Section | Plus Jakarta Sans | 15 | 700 | 20 | 0 | `--text` |
| Heading / Sheet | Plus Jakarta Sans | 16 | 800 | 22 | 0 | `--text` |
| Heading / Auth | Plus Jakarta Sans | 26 | 800 | 32 | −0.6 | `--text` |
| Title / Row | Inter | 13.5 | 600 | 18 | 0 | `--text` |
| Title / Card | Inter | 12.5 | 600 | 16 | 0 | `--text` |
| Title / Message | Inter | 13.5 | 700 | 18 | 0 | `--text` |
| Body / Default | Inter | 13 | 400 | 18 | 0 | `--text` |
| Body / Hero desc | Inter | 12 | 400 | 19 | 0 | `rgba(255,255,255,0.72)` |
| Body / Auth | Inter | 12.5 | 400 | 19 | 0 | `--text-2` |
| Label / Subtitle | Inter | 11.5 | 400 | 16 | 0 | `--text-3` |
| Label / Meta | Inter | 11 | 400 | 15 | 0 | `--text-3` |
| Label / Button | Inter | 13.5 | 700 | 18 | 0 | per variant |
| Label / Tab | Inter | 9.5 | 600 | 12 | 0 | `--text-3` / gold-300 |
| Label / Kicker | Inter | 9.5 | 800 | 12 | +1.4 | gold-200 |
| Lyric line | Inter | 16 | 700 | 26 | 0 | `--text-3` / gold-300 |

---

## 4. Spacing & radius

### Spacing scale

`4 · 6 · 8 · 10 · 12 · 14 · 16 · 18 · 20 · 22 · 26`

Standard rhythms:
- Page horizontal margin: **18px**
- Gap between sections: **16px** above section header, **10px** below it
- Gap between cards in a horizontal scroller: **12px**
- Row internal gap (art → text): **12px**
- Row vertical padding: **8px**

### Radius scale

| Token | Value | Applied to |
|---|---|---|
| `--r-sm` | 10px | Row art, small thumbnails |
| `--r-md` | 16px | Cards, tiles, stat blocks, sheet content |
| `--r-lg` | 22px | Hero card, player artwork |
| `--r-xl` | 28px | Bottom sheets |
| pill | 999px | Buttons, chips, badges |

---

## 5. Component inventory

### C.1 Status bar
54px tall. Time left at x=28 (Inter 15 / 600). Right cluster at x=28 from right: signal bars (4 bars, 3px wide, heights 4/6/8.5/11), Wi-Fi arc, battery capsule 24 × 12 with 74% fill.

### C.2 Screen header
Sticky, top 0, background `linear(180deg, rgba(9,9,11,0.98) 60% → rgba(9,9,11,0))`.
Padding `6px 18px 10px`. Layout: `[back] Title + Subtitle ——— [actions]`.
Back button 36 × 36 circle, `rgba(255,255,255,0.06)` + 1px `--line`.

### C.3 Icon button
36 × 36 circle. Fill `rgba(255,255,255,0.06)`, border 1px `--line`, icon 17 × 17 stroke 1.9. Hover fill `rgba(255,255,255,0.10)`.
Unread dot: 7 × 7 `--support`, top 6 / right 7, with 1.5px `--bg` ring.

### C.4 Song row
Height 72 (48 art + 2 × 8 padding + 2 × 4 internal).
`[rank 20] [art 48×48 r10] [title 13.5/600 + sub 11.5/400 ———] [time 11] [play 30 circle]`
Play affordance: 30 × 30 circle `rgba(255,255,255,0.08)` with filled play glyph 13 × 13.
Active row: title turns gold-300.

### C.5 Card (grid / rail)
132 wide. Art **132 × 132, radius 16**. Name 12.5/600, 8px below art, 2px to meta 11/400 `--text-3`.

### C.6 Tile
148 wide. Radius 16, padding 12. Kicker 9.5/800 uppercase +1.2 tracking at 75% opacity → Title 15/800 → Desc 11/1.45 at 80% opacity. Four gradient variants: forest, gold, pink, cyan.

### C.7 Chip
Height 34, padding `7px 14px`, radius 999. Default fill `rgba(255,255,255,0.06)` + 1px `--line`, text 12/600 `--text-2`.
**Selected:** fill `#ffffff` @ 95%, text `#09090b`.
**Gold variant:** fill `rgba(255,183,0,0.14)`, text gold-200, border `rgba(255,183,0,0.3)`.

### C.8 Button
Height 44, radius 999, padding `0 20px`, Inter 13.5/700, icon 15 × 15 with 7px gap.

| Variant | Fill | Text |
|---|---|---|
| Primary | gold-400 `#ffb700` | `#1a1200` |
| Forest | forest-500 `#1a9c2a` | `#ffffff` |
| Glass | `rgba(255,255,255,0.05)` + 1px `rgba(255,255,255,0.15)`, backdrop blur 8 | `#ffffff` |
| Ghost | `rgba(255,255,255,0.06)` + 1px `--line` | `--text` |

### C.9 Tab bar
78px tall. Fill `rgba(12,12,14,0.94)` + backdrop blur 20 + 1px top `--line`.
5 equal tabs, 8px top padding, icon 21 × 21 then 3px gap then label 9.5/600.
Default `--text-3`; **active gold-300 with stroke-width 2.4**.

### C.10 Mini player
Floating, `left/right 8px`, `bottom 82px`, height 64, radius 14.
Fill `rgba(24,24,27,0.96)` + 1px `--line`, blur 16, shadow `0 8px 26px rgba(0,0,0,0.5)`.
`[art 44×44 r9] [title 12.5/600 + sub 11 + progress 2px] [play 32 circle]`
Progress: track `rgba(255,255,255,0.16)`, fill gold-400 at 38%.

### C.11 Bottom sheet
Radius 28 top corners, max height 748. Fill `--surface`, 1px top `--line-strong`, shadow `0 -20px 60px rgba(0,0,0,0.7)`.
Grab handle 38 × 4, radius 3, `rgba(255,255,255,0.28)`, 9px from top.

### C.12 Stat block
Radius 16, padding 14, fill `--surface`, 1px `--line`. Grid 2 × 2, gap 10.
Number Plus Jakarta Sans 24/800 tabular; label 11/400 `--text-3` 3px below.

### C.13 Pill badge
Padding `2px 7px`, radius 999, Inter 9/800 uppercase +0.6 tracking.

| Variant | Fill | Text |
|---|---|---|
| broadcast | `rgba(29,155,240,0.16)` | `#7cc9fb` |
| pending | `rgba(255,183,0,0.16)` | gold-200 |
| live | `rgba(34,211,238,0.16)` | `#22d3ee` |
| forest | `rgba(47,191,66,0.16)` | forest-300 |

### C.14 Message row
Padding `13px 18px`, 1px bottom `--line`.
`[avatar 42 circle] [name 13.5/700 + pill + time 10.5 ———] [body 12/1.45 clamped to 2 lines]`
Unread: name `#ffffff`, body `--text`.

### C.15 Verified tick
13 × 13, `--color-verified` `#1d9bf0`, sits inline immediately after the name.

---

## 6. Flow map

```
                       ┌─────────────┐
                       │   Splash    │
                       └──┬───────┬──┘
                  Sign in │       │ Browse as guest
                          ▼       │
                    ┌──────────┐  │
                    │  Sign in │  │
                    └──┬────┬──┘  │
              Sign up  │    │     │
                       ▼    └─────┼───────┐
                 ┌──────────┐    │       │
                 │  Sign up │    │       │
                 └────┬─────┘    │       │
                      ▼          │       │
                 ┌──────────┐    │       │
                 │ Onboard  │────┘       │
                 │ (faves)  │            │
                 └────┬─────┘            │
                      └────────┬─────────┘
                               ▼
        ┌──────────────────────────────────────────────┐
        │                  DISCOVER (Home)             │
        │   hub grid: New · Trending · Premieres ·     │
        │   Upcoming · Live · Albums · Artistes ·      │
        │   Browse · Choirs · Sermons                  │
        └───┬──────────────────────────────┬───────────┘
            │                              │
   ┌────────┴────────┐              ┌──────┴──────┐
   │  Search  ·  Artiste profile    │   Player    │
   │  Premieres · Upcoming · Live   │  (full)     │
   │  Albums · Browse · Choirs      └───┬─────┬───┘
   │  Sermons · New · Trending          │     │
   └────────────────────────────── Lyrics    Queue
                                        sheet    sheet

  TAB BAR (5)
  ─────────────────────────────────────────────────────────
  Home → Discover
  Trending → Trending
  Library → Favourites │ Playlists │ Recent │ Downloads
  Messages → Messages → Chat thread
  Account → Account ─┬─ Premium (plans → Paystack)
                     ├─ Artiste Studio ─┬─ Upload
                     │                  ├─ My Releases
                     │                  ├─ Stats
                     │                  └─ Earnings
                     ├─ Admin ─┬─ Overview
                     │         ├─ Approvals
                     │         ├─ Users
                     │         ├─ Content (unlinked)
                     │         └─ Analytics
                     ├─ Favourites / Downloads
                     ├─ Billing
                     └─ Settings
```

---

## 7. Screen specifications

30 screens. All dimensions in px, measured from the 390 × 844 frame origin.

### 7.1 Auth & onboarding

| # | Screen | Key content | Interactions |
|---|---|---|---|
| 01 | **Splash** | Logo tile 74 × 74 r20 forest gradient, centred at y=250 → title 26/800 "Gyidi Nnwom" → subtitle "SCG Music, Lyrics, Premieres & Sermons" | `Get started` → Sign in; `Browse as guest` → Discover |
| 02 | **Sign in** | Back (top-left) → logo → "Welcome back" → email + password fields (42 tall, r11) → primary `Sign in` → Google button → "Create an account" | → Onboard |
| 03 | **Sign up** | Name / Email / Church zone fields + gold notice about Artiste Studio | → Onboard |
| 04 | **Onboarding** | "Pick your favourites" + 8 wrapped chips, first 3 pre-selected | `Continue — 3 selected` or `Skip` → Discover |

### 7.2 Listener flow

| # | Screen | Key content | Interactions |
|---|---|---|---|
| 05 | **Discover** | Header w/ bell+unread dot → search bar → **hub grid (5 × 2)** → Hero (premiere countdown) → 4 horizontal rails: New this week / Trending now / Sermons & teachings / Choirs & ministries → "Made for you" list | Hub chips navigate; cards → Player; choir cards → Artiste profile; bell → Messages |
| 06 | **New Music** | Back + header + search + song list | Rows → Player |
| 07 | **Trending** | Header + 5 filter chips (This week / This month / zones) + ranked 1–10 list | Rank numerals 20px wide |
| 08 | **Premieres** | Countdown cards (pill "In N days", title 17/800, artist, Remind me + Artiste buttons) + explainer notice | Remind me sets push |
| 09 | **Upcoming** | Category chips + rows with "In Nd" pills + premium notice | Rows → Premieres |
| 10 | **Live** | 16:9 stream card, LIVE pill top-left, viewer count bottom-right, Join stream + heart; "Replays" list below | Join → stream |
| 11 | **Albums** | Empty state (disc icon, "No albums yet" + catalogue explanation) | — |
| 12 | **Artistes** | Search + 12 rows, 48px circular avatars, name + verified tick, zone · branch | → Artiste profile |
| 13 | **Browse** | 3 × 2 category tiles (counts) + "By zone" list of 8 zones | → Trending / Choirs |
| 14 | **Choirs** | Search + rows: choir name, "N recordings · artiste", cover thumb | → Artiste profile |
| 15 | **Sermons** | 5 filter chips + list; notice explaining long-form features | Rows → Player |
| 16 | **Search** | Search field w/ query "Obogu" + 5 type chips + Top result (artiste card) + Songs + 2 × 2 category grid | → Artiste / Player / Browse |
| 17 | **Artiste profile** | Back + heart + queue icons → centred avatar 104 → name + tick → zone · branch → Play + Follow → 2 stat tiles → ranked track list | Play → Player |
| 18 | **Player** | Chevron-down + "Now playing" label + queue → **artwork 300 × 300 r24** → title + artist + heart → progress 4px w/ times → shuffle / prev / **play 66** / next / repeat → lyrics / download / queue / add | Heart toggles fill to `--support`; lyrics + queue open sheets |
| 19 | **Lyrics sheet** | Grab handle + title + artist + close → 12 lyric lines, 16/700; active line gold-300 with timestamp caption | Tap line → seek |
| 20 | **Queue sheet** | "Now playing" + 8 "Up next" rows | Row → plays that track |
| 21 | **Library** | Header + 4-way segmented control (Favourites / Playlists / Recent / Downloads) | Content swaps in place |
| 21a | ↳ Favourites | Favourited rows, or empty state | Row → Player |
| 21b | ↳ Playlists | 3 named playlists w/ counts + `New playlist` + collaboration notice | → list |
| 21c | ↳ Recent | Last-10 rows | Row → Player |
| 21d | ↳ Downloads | Empty state + `Go Premium to download` CTA | → Premium |
| 22 | **Messages** | Header w/ unread count + 4 filter chips + 3 threads (broadcast pill on official ones) + ad-free notice | → Chat |
| 23 | **Chat thread** | Back + name + subtitle + menu → bubbles (received left `surface-2` r16 w/ 4px tail; sent right forest-600 r16) → composer pinned to bottom | Composer owns bottom edge — **tab bar hidden on this screen** |

### 7.3 Monetisation

| # | Screen | Key content | Interactions |
|---|---|---|---|
| 24 | **Premium** | Back + header → gold hero card (crown badge, "Gyidi Nnwom Premium") → 5 perks with green ticks → 3 selectable plans (Mobile Money GH₵15 / Card GH₵15 / Annual GH₵150) → primary CTA + Paystack note | Plan tap → selected state (gold border + stronger fill) |

### 7.4 Artiste Studio

| # | Screen | Key content | Interactions |
|---|---|---|---|
| 25 | **Artiste Studio** | Back + header "Obogu Seth" + 4-way segmented control | — |
| 25a | ↳ Upload | Dashed drop zone (MP3/M4A/WAV ≤ 200 MB) → Title / Category / Language / Choir group / Lyrics fields → `Submit for review` + gold "goes to an admin first" notice | → New Release |
| 25b | ↳ My Releases | 8 rows with status pills: In review (gold) / Rejected (live/cyan) / Live (forest) | → edit |
| 25c | ↳ Stats | 4 stat tiles (1,284 plays / 312 this month / 48 followers / 6 downloads) + 7-bar weekly chart + ranked top tracks | — |
| 25d | ↳ Earnings | 2 stat tiles (GH₵420 month / GH₵1,860 all time) + payout history rows | — |
| 26 | **New Release** | Back + "Step 3 of 3" → upload-complete file card w/ progress → Title / Category fields → cover art picker (3 brand covers + add) → `Submit for approval` + `Save as draft` | Submit → queue |

### 7.5 Admin

| # | Screen | Key content | Interactions |
|---|---|---|---|
| 27 | **Admin** | Back + header "kofi kay" + 5-way segmented control | — |
| 27a | ↳ Overview | 4 stat tiles (289 songs / 15 sermons / 85 sessions / 9 listening now) → "Needs attention" rows (6 approvals, 190 unlinked) → activity log | Rows → matching tab |
| 27b | ↳ Approvals | Notice + 4 pending cards w/ Approve (forest) / Reject (ghost) | Approve / reject |
| 27c | ↳ Users | 13 rows: avatar, name + tick, role · zone, role chip (admin = gold) | → manage |
| 27d | ↳ Content | Notice + 6 unlinked rows w/ `Link` button | Link → attribution |
| 27e | ↳ Analytics | 4 stat tiles (310 plays / 85 sessions / 9 now / 34 peak hour) + 7-bar session chart + top content + catalogue health rows + investor note | — |

### 7.6 Account

| # | Screen | Key content | Interactions |
|---|---|---|---|
| 28 | **Account** | Header w/ settings icon → profile (avatar 88, name + tick, zone · branch, Admin pill) → 2 stat tiles → 7 menu rows (Premium / Artiste Studio / Admin / Favourites / Downloads / Billing / Settings) → `Sign out` | Rows navigate |
| 29 | **Settings** | Back + header → 6 setting rows (audio quality, Wi-Fi-only, notifications, crossfade, language, data saver) → About block | — |
| 30 | **Splash** (see 01) | | |

---

## 8. Content: real catalogue snapshot

All content in the prototype is a **snapshot of the live database taken 11 November 2026** — nothing is invented except per-song durations, which the schema does not store.

**Headline numbers (real):**

| Metric | Value |
|---|---|
| Songs | 289 |
| Sermons | 15 |
| Choir groups | 12 |
| Artistes | 12 |
| Play events | 310 |
| App sessions | 85 |
| Profiles | 17 |

**Real artistes with zones/branches** (13 rows, including one admin):
Obogu Seth (Obogu Zone / Obogu Branch) · Greater Accra Boysco_KOJO (Greater Accra Zone / Accra Branch) · Yaw Baidoo (Ashanti Zone) · Op. Abraham (Okyeman Zone / Osiem Headquarters) · K. Badu (Sekyere) (Sekyere Zone) · Kumawu Choir · Mponua Choir · Bosiako (Ashanti Zone / Bosiako Branch) · Chairman Oboy (Okyeman Zone) · gina vocals (Accra / Tabora) · Blacko (Accra / Taboraa) · SACSU Fellowship (National SACSU / Tertiary Students Wing) · kofi kay (admin)

**Real song titles** include: Adehye Mma · Adom Bra · Ayeyi Bɛn · Bobetro · Daniel · ewiase mu amane · Gethsemane · Gyae su Yohane · Eli, Eli, lama sabachthani? · Aduru me so · Amanman mu somafoɔ · Bisa Biribi me Dim Mo · Dani W'Ani Kyere me · Etwa Se Onipa Bewu · Akoapa Nokwafo Mo · Bkumawu · Anamon Nsia Da Ho · 8-6-13 OP Abraham · (3-9-11) OP Abraham

---

## 9. Assets

| Asset | Path | Notes |
|---|---|---|
| Cover art ×3 | `covers/cover-1.jpg`, `cover-2.jpg`, `cover-3.jpg` | Brand default covers from `public/default-covers/`. Assigned deterministically by FNV-1a hash of the title — identical logic to `src/lib/defaultCovers.ts`, so prototype art matches the live app. |
| Avatars | Remote Supabase Storage URLs | 7 of 13 artiste avatars are real; the rest fall back to generated initials on a forest gradient. |
| Icons | Inline SVG in `app.js` | Hand-drawn to match **lucide-react** (the icon library the real app uses) at 24 × 24 viewBox, 1.9 stroke, round caps/joins. |

### Cover-assignment rule (port this to Figma)

```
seed = title.trim().toLowerCase()
h = FNV-1a(seed)            // 2166136261 offset, 16777619 prime
cover = COVERS[h % 3]
```

Only 9 of 289 live songs have real cover art, so this fallback is what users actually see today.

---

## 10. Motion & interaction notes

While Figma prototype mode doesn't need exact curves, keep these relationships:

| Interaction | Specification |
|---|---|
| Tab switch | Instant content swap, no transition |
| Screen push (list → detail) | Slide from right, 260ms ease-out |
| Bottom sheet | Slide up from bottom, 320ms spring; scrim fades to `rgba(0,0,0,0.55)` in 200ms |
| Sheet dismiss | Tap scrim or X; sheet slides down 240ms |
| Player open | Mini player expands into full screen; artwork scales from 44 → 300 |
| Sheet over player | Player stays mounted underneath — **the sheet never replaces the background** |
| Play/pause | Icon swaps in place, no layout shift |
| Heart | Instant fill to `--support` `#ec4899` |
| Chip select | Instant; selected state is inverted white pill |

---

## 11. Notes for the Figma build

1. **Build the 15 components in §5 first**, as Figma components with variants. Every screen then assembles from them.
2. **Two text styles only** — Plus Jakarta Sans for display, Inter for everything else. If a designer reaches for a third family, they've drifted.
3. **18px page margin is non-negotiable.** It's the single spacing value that makes the app feel native; content that ignores it immediately reads as a web page.
4. **The status bar and tab bar are fixed chrome**, not per-screen art. Put them in a shared frame.
5. **Bottom sheets cap at 748px** so the top of the scrim is always tappable at 390 × 844.
6. **Reserve 150px at the bottom of scrolling content** on any screen showing the mini player — 78px tab bar + 64px mini player + 8px gap.
7. **Never place interactive content in the top 54px** (status bar band).
8. Colours are given as hex/tokens, not Figma styles, so this doc stays portable. Create Figma colour styles from the tables in §2.

---

## 12. Files in this folder

| File | What it is |
|---|---|
| `index.html` | The clickable prototype. Open it in a browser — no build step, no server required. |
| `styles.css` | All styling. Token block at the top mirrors `src/index.css` `@theme`. |
| `app.js` | Screen definitions, router, interaction handling. |
| `data.js` | The catalogue snapshot. Edit this to change prototype content. |
| `covers/` | Local cover art (3 brand defaults). |
| `FIGMA-SPEC.md` | This document. |
