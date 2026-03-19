# UI/UX Redesign: Editorial Grayscale

**Date:** 2026-03-19
**Status:** Approved
**Problem:** Users perceive the current UI as "AI-slopped" — formulaic gradients, uniform roundedness, emoji overuse, and a disconnect between the neutral base palette and loud decorative overlays. This causes hesitation in adopting the service.

## Design Direction

**Editorial Grayscale** — bold typographic personality, strong weight contrasts, uppercase section headers, tight letter-spacing on headlines. Feels like a well-designed magazine, not a template. Grayscale only, with semantic colors (success/warning/danger) used sparingly for RSVP status, check-in confirmation, and destructive actions.

**Reference:** Luma.com for content-first sensibility, but with more typographic character to avoid being derivative.

**Audience:** B2C consumer-friendly by default (public pages). B2B SaaS for organizers/admins (dashboards).

## Constraints

1. Grayscale for all UI. Semantic colors (green/amber/red) only when meaning requires it.
2. Federation-aware — all users are remote actors identified by fediverse handle. No local/remote distinction needed.
3. No decorative gradients, no emoji in category labels, no colored accent palette.

## What Gets Removed

- `pickGradient()` and all 8 gradient pairs in `src/shared/gradients.ts`
- Emoji from place category labels (text-only: "Coworking" not "💼 Coworking")
- `rounded-xl` and `rounded-2xl` on cards (replaced with `rounded` / 4-6px)
- `shadow-sm` on cards (shadows only on dialogs/overlays)
- Emerald accent colors from globals.css
- `bg-primary/10` colored avatar fallbacks (use neutral gray)
- Category color badges on event cards

## Typography Scale

| Token | Size | Weight | Tracking | Use |
|-------|------|--------|----------|-----|
| Page title | 32px | 800 | -0.5px | Event detail title, group name heading |
| Section title | 22px | 800 | -0.3px | My Groups header, dashboard page titles |
| Card title | 18px | 700 | -0.2px | Event card title in list view, place name |
| Item title | 15px | 700 | -0.1px | Event title in grid cards, timeline items |
| Body | 14px | 400 | normal | Descriptions, about sections, prose (1.7 line-height) |
| Label/Name | 13px | 600 | normal | Author names, form labels, nav items |
| Section header | 12-13px | 700 | 0.5px | ABOUT, ORGANIZERS, DISCUSSIONS (uppercase, editorial signature) |
| Date/Meta | 11px | 600 | 0.5px | SAT, MAR 21 · 2:00 PM (uppercase) |
| Muted | 12px | 400 | normal | Handles, timestamps, addresses (#888) |

## Color Palette

### Grayscale (primary) — CSS Variable Mapping

Update the existing OKLCH values in `globals.css` to match these hex equivalents. All shadcn/ui components continue using `text-foreground`, `bg-muted`, `border-border`, etc.

| Value | CSS Variable | Tailwind Class | Use |
|-------|-------------|----------------|-----|
| #111 | `--foreground`, `--primary` | `text-foreground`, `bg-primary` | Primary text, CTA buttons, active nav, editorial borders |
| #333 | (use inline or custom utility) | `text-[#333]` | Section headers, secondary headings |
| #555 | (use inline or custom utility) | `text-[#555]` | Labels, uppercase meta text |
| #888 | `--muted-foreground` | `text-muted-foreground` | Muted text, icons |
| #999 | (use inline or custom utility) | `text-[#999]` | Timestamps, tertiary text |
| #ddd | `--input` | `border-input` | Outline button borders, input borders |
| #e5e5e5 | `--border` | `border-border` | Card borders, dividers |
| #f0f0f0 | (use inline or custom utility) | `border-[#f0f0f0]` | Light inner separators |
| #fafafa | `--muted`, `--secondary` | `bg-muted`, `bg-secondary` | Subtle background (no-image hero, dashboard bg) |
| #fff | `--background`, `--card` | `bg-background`, `bg-card` | Page background, cards |

### Semantic (used sparingly)

| Value | Use |
|-------|-----|
| #16a34a (green) | RSVP "Going" badge, check-in success checkmark |
| #d97706 (amber) | RSVP "Waitlisted" badge |
| #dc2626 (red) | RSVP "Declined" badge, danger buttons, form errors |
| #4a90d9 (blue) | Map nearby markers, radius circle (Leaflet) |
| #c00 (dark red) | Map pin marker (selected/event venue) |

## Border & Radius Rules

### Border radius
- **4px** — buttons, inputs, cards, badges, map containers
- **6px** — sidebar cards, larger containers
- **50%** — avatars only
- **Eliminated:** `rounded-xl`, `rounded-2xl`, `rounded-lg` on cards

### Border weight
- **1px #e5e5e5** — card borders, section dividers
- **1px #f0f0f0** — light inner separators (within cards)
- **1px #ddd** — outline buttons, form inputs
- **2px #111** — navigation bottom border, page header borders (editorial signature)
- **3px #111** — date left-border on no-image event fallback

### Shadows
- **None** on cards, buttons, badges
- **shadow-md** — dialogs/modals only
- **shadow-xl** — mobile sidebar overlay only

## Button Variants

| Variant | Background | Border | Text | Radius | Use |
|---------|-----------|--------|------|--------|-----|
| Primary | #111 | none | #fff | 4px | Register, Follow, Check In, Create |
| Outline | transparent | 1px #ddd | #333 | 4px | Events, Cancel, secondary actions |
| Ghost | transparent | none | #555 | 4px | Bookmark, tertiary actions |
| Danger | #dc2626 | none | #fff | 4px | Delete, destructive actions |
| Danger Outline | transparent | 1px #dc2626 | #dc2626 | 4px | Remove, secondary destructive |

Small variants: same colors, reduced padding (6px 14px, 12px font).

## Badge Variants

All badges: uppercase, 10px font, 600 weight, border-radius 2-3px.

| Type | Border | Text color | Background | Use |
|------|--------|-----------|------------|-----|
| Entity | 1px #ccc | #555 | transparent | "Group" label |
| Role (dark) | 1px #ccc | #555 | transparent | "Owner" |
| Role (light) | 1px #e0e0e0 | #888 | transparent | "Moderator" |
| Timeline | 1px #ddd | #555 | transparent | "Event" in timeline |
| Timeline (muted) | 1px #e0e0e0 | #888 | transparent | "Note" in timeline |
| Category | 1px #ddd | #777 | transparent | "Coworking", "Technology" |
| RSVP Going | 1px #bbf7d0 | #16a34a | #f0fdf4 | Status badge |
| RSVP Waitlisted | 1px #fde68a | #d97706 | #fffbeb | Status badge |
| RSVP Declined | 1px #fecaca | #dc2626 | #fef2f2 | Status badge |
| Ad overlay | none | #fff | rgba(0,0,0,0.5) | Banner "Ad" badge |

## Form Inputs

- Border: 1px #ddd, radius 4px
- Font: 14px, color #111
- Placeholder: color #888
- Focus state: border-color #111 (not blue)
- Error state: border-color #dc2626, error message below in red
- Label: 13px, weight 600, color #111, 4px margin-bottom

## Page-by-Page Design

### Navigation (Global)

**Desktop:**
- Left: wordmark "moim" (20px, w800, -0.5px tracking, lowercase)
- Center-left: nav links (EVENTS, GROUPS, PLACES) — 13px, w500, uppercase, 0.5px tracking
- Active nav: w700, 2px underline
- Right: avatar (28px circle) + full fediverse handle (13px, #555)
- Bottom border: 2px solid #111

**Mobile:**
- Left: wordmark "moim" (18px, w800)
- Right: avatar (26px) + hamburger (3 lines, 18px wide, 2px height)
- Expanded: vertical nav links + handle below separator
- Bottom border: 2px solid #111

**Profile dropdown:** Settings, My Groups, My Events, Sign Out.

**Navigation changes from current:**
- Current nav labels "Events" and "Check-ins" → renamed to "EVENTS", "GROUPS", "PLACES"
- "GROUPS" is a new top-level nav item (currently groups are only accessible via My Groups)
- "Check-ins" renamed to "PLACES" to match the broader scope (place detail, check-ins, nearby)
- Current mobile uses a bottom tab bar (Events, Check-ins, Profile) → changes to hamburger menu with vertical nav links. This is a structural change.

### Homepage Hero Carousel

Shared carousel with banners and featured events (current behavior preserved).

**Event slide (with image):**
- Full-width image background with dark gradient overlay (bottom → transparent)
- White text: uppercase date/meta, bold title (28px w800), host info
- Single CTA: "View Event" (white background, #111 text, 4px radius)
- Progress: thin 3px bars (bottom-right), white/30% white

**Event slide (no image):**
- Background: #fafafa, bottom border 2px #111
- Left-aligned: uppercase date, large title (36px w800), host, CTA (#111 bg)
- Right side: watermark date number (96px, w800, #e8e8e8)
- Progress: thin 3px bars, 15%/100% opacity

**Banner/Ad slide:**
- Full-width banner image (2048x680)
- "Ad" badge: top-left, rgba(0,0,0,0.5) background, white text, 10px uppercase
- Progress bars same treatment

### Event Cards & Listings

**List view (homepage, group events):**
- Horizontal layout: image thumbnail (140x94px, 4px radius) or date fallback + content
- Date fallback: 3px left border #111, large date number (36px w800), month (12px uppercase), day abbreviation
- Content: uppercase date/time, bold title (18px w700), "Hosted by **Group Name**", location + attendee count
- Separator: 1px #e0e0e0 between items

**Grid view (category browse, search):**
- 3-column grid, 20px gap
- Card: 1px border #e0e0e0, 6px radius
- Image header (120px) or date fallback on #fafafa background (large number + month)
- Card body: 14px padding, uppercase date, bold title (15px w700), host

**Mobile list:**
- With image: full-width image (160px height, 4px radius), content below
- Without image: date sidebar (3px left border) + content right

### Event Detail Page

**Hero:**
- With image: 280px height, dark overlay, white text (category, 30px title, host)
- No image: #fafafa background, 2px bottom border, left-aligned title (32px), watermark date right (100px, 6% opacity)
- Organizer buttons: "Edit Event" / "Dashboard" in overlay style (if authorized)

**Two-column layout** (pulled up to overlap hero on desktop):
- Main column: About (markdown prose), Organizers (vertical cards in horizontal scroll), Discussions (threaded)
- Sidebar (320px, sticky): unified card containing date (calendar icon) → location (pin icon) → inline map (120px, clickable to fullscreen) → attendee preview (overlapping avatars) → Register CTA (#111) → Bookmark (text link)

**Organizers section:**
- Vertical cards (144px wide) in horizontal scrolling row
- Each card: avatar (56px circle), name (13px w600), handle (11px #888, truncated)
- Thin border (1px #e5e5e5), 6px radius, 16px padding
- Matches current implementation layout

**Discussions:**
- Thread items: avatar (24px) + name (w600) + handle + relative time
- Content indented under avatar
- Reply count link, expandable thread
- Fediverse handle shown on each comment author

**Mobile:**
- Stacked layout, info card (date + location + map + attendees + bookmark)
- Fixed bottom bar: attendee count left, Register button right

### Group Profile Page

**Header:**
- Avatar (56px) + name (22px w800) + "Group" badge + handle
- Summary/description, website link
- Stats row: followers, events, language
- Action buttons: Follow (#111), Events (outline)
- Bottom border: 2px #111

**Places section:**
- Place rows: name (w600), address, category badge (text-only, outline)

**Activity timeline:**
- Vertical line (#e0e0e0) with dots
- Event items: filled dot (#111, 10px), "Event" badge, date, card with event details
- Note items: gray dot (#ccc, 8px), "Note" badge, markdown content

### My Groups

- Header: "My Groups" (22px w800), subtitle, "Create Group" button
- List rows: avatar (40px) + name (15px w700) + role badge + handle + stats (followers, upcoming)
- Border-bottom separators

### Group Dashboard

- Sidebar (220px): group name/handle/role, navigation links with left-border active indicator (2px #111)
- Active nav: w600 + #f5f5f5 background + 2px left border
- Main area: page title (18px w800), action button
- Stat cards: thin border, 4px radius, uppercase label (11px), large number (24px w800)
- Background: #fafafa for dashboard area, #fff for sidebar and cards

### Places / Check-ins Page

**Map:** full-width, 320px desktop / 350px mobile. OpenStreetMap tiles (already neutral). Blue markers for nearby, red for selected/pinned. Dashed radius circle.

**Nearby cards:** horizontal scroll, 180px wide, thin border, selected = 2px #111 border. Place name (14px w700), distance + category text, latest check-in (avatar + relative time).

**Selected place detail:** name (18px w800), address + category, "Check In" button (#111). Recent check-ins list: avatar (28px) + name + timestamp, optional note.

### Place Detail Page

**Header:** category breadcrumb (uppercase), name (26px w800), address, external map links (small outline pills: Google Maps, Naver, Kakao). Action buttons: Events (outline), Check In (#111). Bottom border: 2px #111.

**Map:** 200px height, single marker, full-width below header.

**Two-column:** main (about + recent check-ins) + sidebar (info card with address/website/check-in count + upcoming events at this place).

**Check-in confirmation card:** map snapshot image, green checkmark (#16a34a) + "Checked in" text, place name, note, copy link.

### Categories Page

**Category listing (/categories):**
- Grid of category cards. Current gradient headers replaced with #fafafa background + large bold category name.
- Card: 1px border #e0e0e0, 6px radius, category name (18px w700), event count below.
- No emoji, no color.

**Category detail (/categories/$categoryId):**
- Header: category name (26px w800), event count, ICS subscribe link. Bottom border 2px #111.
- Event listing below uses same grid view treatment as event cards grid.

### Auth Pages

**Sign-in (/auth/signin):**
- Centered card, max-w-sm. Wordmark "moim" at top. Three sign-in method buttons stacked vertically (outline style). Clean, minimal.
- Same 4px radius, 1px borders, no gradients.

**Onboarding (/auth/onboarding):**
- Same centered card treatment. Form inputs follow the standard input style (1px #ddd, focus #111).

### Polls & Notes Pages

**Poll detail (/polls/$pollId):**
- Header: question text (22px w800), group name, bottom border 2px #111.
- Vote options: 1px border cards, 4px radius. Selected = 2px #111 border. Results shown as inline percentage bar (grayscale fill).

**Note detail (/notes/$noteId):**
- Minimal page. Author info (avatar + name + handle), timestamp, markdown content. Bottom border 2px #111 on header.

### Calendar Page

**Calendar (/calendar):**
- Same treatment as group events calendar. EventCalendar component styled with editorial tokens. Day cells with event dots use #111 instead of current accent color.

## Implementation Notes

### Font Family

Keep system sans-serif (`font-sans` / `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`). The editorial character comes from weight contrast and letter-spacing, not a custom typeface.

### Tailwind Config Changes

- Update `--radius` in globals.css from `0.625rem` (10px) to `0.25rem` (4px). This cascades to all shadcn components.
- Update OKLCH values in globals.css to match the hex grayscale palette.
- Remove emerald accent color definitions.

### Component-Level Changes

- **Card** (`src/components/ui/card.tsx`): Remove `rounded-xl` → `rounded`, remove `shadow-sm`, keep `py-6 gap-6` as defaults (pages already override when needed).
- **Badge** (`src/components/ui/badge.tsx`): Change `rounded-full` → `rounded-sm` (new 4px base). Adjust variants for grayscale borders.
- **Button** (`src/components/ui/button.tsx`): Update primary to #111 bg, update outline border to #ddd.
- **Input** (`src/components/ui/input.tsx`): Focus state: `border-color #111` with a subtle `ring-1 ring-[#111]/20` for accessibility (preserves focus visibility without blue color).

### Focus State & Accessibility

Focus ring is preserved for keyboard navigation but recolored: `focus-visible:border-[#111] focus-visible:ring-1 focus-visible:ring-[#111]/20`. This meets WCAG 2.1 focus-visible requirements while staying grayscale.

### Dark Mode

Dark mode is **out of scope** for this redesign. The existing `@custom-variant dark` in globals.css and dark variant styles may be left in place but will not be updated. Light mode only for now.

### Homepage Layout Change

The homepage event listing changes from a 3-column card grid to a list view. This is an intentional layout change to match the editorial style, not just a style change.

## What Does NOT Change

- Information architecture on all pages (same data, same sections)
- Map behavior and interaction patterns (Leaflet, markers, radius, fullscreen dialog)
- RSVP/registration flow
- Discussion threading
- Activity timeline structure
- Dashboard sidebar navigation
- Carousel auto-advance and progress behavior
- Banner geotargeting, scheduling, and analytics
- All API endpoints and data flow
- Responsive breakpoints (md: for desktop)
- Fediverse handle display format (@user@instance)
