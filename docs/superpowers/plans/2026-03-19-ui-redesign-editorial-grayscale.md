# UI/UX Redesign: Editorial Grayscale — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current AI-slopped UI (decorative gradients, emoji categories, uniform roundedness) with an editorial grayscale design language driven by typography, weight contrast, and intentional borders.

**Architecture:** Bottom-up implementation — update design tokens and shared primitives first (globals.css, Card, Badge, Button, Input), then navigation, then page-by-page updates. Each task produces a working commit. Gradient removal is done as a separate pass since it touches many files.

**Tech Stack:** TanStack Start + React, Tailwind CSS v4, shadcn/ui components (CVA-based), Leaflet maps

**Spec:** `docs/superpowers/specs/2026-03-19-ui-redesign-editorial-grayscale-design.md`

---

## File Map

### Foundation (tokens + primitives)
- Modify: `src/styles/globals.css` — update CSS variables, radius, remove emerald colors
- Modify: `src/components/ui/card.tsx` — remove `rounded-xl`, `shadow-sm`
- Modify: `src/components/ui/badge.tsx` — `rounded-full` → `rounded-sm`, grayscale variants
- Modify: `src/components/ui/button.tsx` — update variant colors, remove `shadow-xs`
- Modify: `src/components/ui/input.tsx` — focus state to `#111`
- Modify: `src/components/ui/textarea.tsx` — focus state to match input
- Modify: `src/components/ui/tabs.tsx` — remove `shadow-sm` from TabsTrigger
- Modify: `src/components/ui/select.tsx` — remove `shadow-xs`, update focus ring
- Modify: `src/components/ui/checkbox.tsx` — remove `shadow-xs`, update focus ring

### Navigation
- Modify: `src/routes/__root.tsx` — editorial nav, hamburger mobile, add Groups link, rename Check-ins → Places

### Gradient removal (multi-file pass)
- Modify: `src/routes/index.tsx` — remove gradient imports, update carousel + event cards
- Modify: `src/routes/events/index.tsx` — remove gradient imports
- Modify: `src/routes/events/$eventId/index.tsx` — remove gradient hero fallback
- Modify: `src/routes/categories/index.tsx` — remove gradient headers
- Modify: `src/routes/categories/$categoryId.tsx` — remove gradient, remove `rounded-xl`
- Modify: `src/routes/groups/$identifier/index.tsx` — remove gradient imports
- Modify: `src/components/EventCalendar.tsx` — remove gradient imports
- Modify: `src/components/UpcomingEventList.tsx` — remove gradient imports
- Delete or gut: `src/shared/gradients.ts` — remove `HERO_GRADIENTS` array, keep `pickGradient` as no-op or delete

### Emoji removal from public UI
- Modify: `src/components/PlaceCategorySelect.tsx` — remove emoji prefix from labels
- Modify: `src/components/PlacePicker.tsx` — remove emoji from category display, remove emerald classes

### Page-specific updates
- Modify: `src/routes/index.tsx` — homepage carousel + event list layout
- Modify: `src/routes/events/$eventId/index.tsx` — event detail editorial treatment
- Modify: `src/routes/events/$eventId/register.tsx` — remove `shadow-sm`
- Modify: `src/routes/groups/$identifier/index.tsx` — group profile editorial treatment
- Modify: `src/routes/groups/my.tsx` — my groups list layout
- Modify: `src/routes/groups/$identifier/dashboard/route.tsx` — dashboard sidebar styling
- Modify: `src/routes/places/index.tsx` — check-ins page editorial treatment
- Modify: `src/routes/places/$placeId/index.tsx` — place detail editorial treatment
- Modify: `src/routes/categories/index.tsx` — category grid editorial treatment
- Modify: `src/routes/categories/$categoryId.tsx` — category detail editorial treatment
- Modify: `src/routes/auth/signin.tsx` — sign-in page editorial treatment
- Modify: `src/routes/settings/index.tsx` — remove `shadow-sm`
- Modify: `src/routes/groups/$identifier/edit.tsx` — remove `shadow-sm`
- Modify: `src/routes/calendar/index.tsx` — remove emerald classes
- Modify: `src/routes/auth/onboarding.tsx` — editorial treatment
- Modify: `src/routes/polls/$pollId.tsx` — editorial treatment
- Modify: `src/routes/notes/$noteId.tsx` — editorial treatment, remove `bg-primary/10`
- Modify: `src/components/dashboard/GaugeBar.tsx` — replace emerald hex color

---

## Task 1: Update Design Tokens (globals.css)

**Files:**
- Modify: `src/styles/globals.css`

- [ ] **Step 1: Update `:root` CSS variables to grayscale hex values**

In `src/styles/globals.css`, replace the `:root` block (lines 46-80) with:

**Important:** Setting `--radius` to `0.375rem` (6px) so that the derived tokens work correctly: `--radius-sm` = 2px (badges), `--radius-md` = 4px (buttons, inputs), `--radius-lg` = 6px (larger containers). The plain `rounded` class in Tailwind v4 is a hardcoded 4px, used for cards.

```css
:root {
  --radius: 0.375rem;
  --background: #ffffff;
  --foreground: #111111;
  --card: #ffffff;
  --card-foreground: #111111;
  --popover: #ffffff;
  --popover-foreground: #111111;
  --primary: #111111;
  --primary-foreground: #ffffff;
  --secondary: #fafafa;
  --secondary-foreground: #111111;
  --muted: #fafafa;
  --muted-foreground: #888888;
  --accent: #fafafa;
  --accent-foreground: #111111;
  --destructive: #dc2626;
  --destructive-foreground: #dc2626;
  --border: #e5e5e5;
  --input: #dddddd;
  --ring: #111111;
  --chart-1: #111111;
  --chart-2: #555555;
  --chart-3: #888888;
  --chart-4: #bbbbbb;
  --chart-5: #dddddd;
}
```

- [ ] **Step 2: Remove emerald color variables and theme mappings**

Remove lines 32-38 (emerald `--color-*` mappings in `@theme inline`) and lines 72-79 (emerald variable definitions in `:root`).

- [ ] **Step 3: Update ring/focus color in `@layer base`**

The `outline-ring/50` on line 84 will now resolve to `#111111` at 50% opacity, which is correct for the editorial grayscale focus style.

- [ ] **Step 4: Commit**

```bash
git add src/styles/globals.css
git commit -m "feat(tokens): update design tokens to editorial grayscale palette"
```

---

## Task 2: Update Card Component

**Files:**
- Modify: `src/components/ui/card.tsx:9-11`

- [ ] **Step 1: Remove `rounded-xl` and `shadow-sm` from Card base class**

Change line 10 from:
```
"bg-card text-card-foreground flex flex-col gap-6 rounded-xl border py-6 shadow-sm",
```
to:
```
"bg-card text-card-foreground flex flex-col gap-6 rounded border py-6",
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ui/card.tsx
git commit -m "feat(card): remove rounded-xl and shadow-sm for editorial style"
```

---

## Task 3: Update Badge Component

**Files:**
- Modify: `src/components/ui/badge.tsx:7-8`

- [ ] **Step 1: Change `rounded-full` to `rounded-sm` in badge base class**

Change line 8 — replace `rounded-full` with `rounded-sm` in the CVA base string.

- [ ] **Step 2: Update badge variants for grayscale**

Update the variants object:
```typescript
variants: {
  variant: {
    default: "bg-primary text-primary-foreground [a&]:hover:bg-primary/90",
    secondary:
      "bg-secondary text-secondary-foreground border-border [a&]:hover:bg-secondary/90",
    destructive:
      "bg-destructive text-white [a&]:hover:bg-destructive/90 focus-visible:ring-destructive/20",
    outline:
      "border-border text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
    ghost: "[a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
    link: "text-primary underline-offset-4 [a&]:hover:underline",
  },
},
```

Note: The `secondary` variant now explicitly includes `border-border` so it shows the grayscale border.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/badge.tsx
git commit -m "feat(badge): switch to rounded-sm and grayscale variants"
```

---

## Task 4: Update Button Component

**Files:**
- Modify: `src/components/ui/button.tsx:7-8`

- [ ] **Step 1: Update button base class — remove dark mode refs, update focus ring**

In the CVA base string (line 8), replace `focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]` with `focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/20`.

- [ ] **Step 2: Update button variants for grayscale**

Update the `outline` variant — remove `shadow-xs` and dark mode classes:
```typescript
outline:
  "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
```

Update the `destructive` variant — remove dark mode classes:
```typescript
destructive:
  "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20",
```

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/button.tsx
git commit -m "feat(button): simplify variants for editorial grayscale"
```

---

## Task 5: Update Input & Textarea Components

**Files:**
- Modify: `src/components/ui/input.tsx:11-12`
- Modify: `src/components/ui/textarea.tsx`

- [ ] **Step 1: Update Input focus state**

In `src/components/ui/input.tsx`, replace line 12:
```
"focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
```
with:
```
"focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/20",
```

Also remove `shadow-xs` from line 11 and remove `dark:bg-input/30`.

- [ ] **Step 2: Apply same focus state to Textarea**

Apply the same `focus-visible:ring-1 focus-visible:ring-ring/20` pattern and remove `shadow-xs` if present.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/input.tsx src/components/ui/textarea.tsx
git commit -m "feat(input): grayscale focus ring, remove shadow"
```

---

## Task 6: Update Tabs, Select, and Checkbox Components

**Files:**
- Modify: `src/components/ui/tabs.tsx`
- Modify: `src/components/ui/select.tsx`
- Modify: `src/components/ui/checkbox.tsx`

- [ ] **Step 1: Remove `shadow-sm` from TabsTrigger (not TabsList)**

In `src/components/ui/tabs.tsx`, find `data-[state=active]:shadow-sm` in the **TabsTrigger** component and remove it.

- [ ] **Step 2: Update Select component**

In `src/components/ui/select.tsx`, remove `shadow-xs` from SelectTrigger and update focus ring from `focus-visible:ring-[3px]` to `focus-visible:ring-1 focus-visible:ring-ring/20`. Remove any `dark:` mode classes.

- [ ] **Step 3: Update Checkbox component**

In `src/components/ui/checkbox.tsx`, remove `shadow-xs` and update focus ring to match. Remove any `dark:` mode classes.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/tabs.tsx src/components/ui/select.tsx src/components/ui/checkbox.tsx
git commit -m "feat(primitives): update tabs, select, checkbox for editorial grayscale"
```

---

## Task 7: Update Navigation (Root Layout)

**Files:**
- Modify: `src/routes/__root.tsx`

This is the most complex single task. Read the full current file before making changes.

- [ ] **Step 1: Update desktop NavLink component**

Replace the NavLink component (lines 87-96) with editorial styling:
```tsx
function NavLink(props: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={props.to}
      className="text-[13px] font-medium uppercase tracking-[0.5px] text-[#555] transition-colors hover:text-foreground [&.active]:font-bold [&.active]:text-foreground [&.active]:border-b-2 [&.active]:border-foreground [&.active]:pb-px"
    >
      {props.children}
    </Link>
  );
}
```

- [ ] **Step 2: Update header bar**

Replace the header (lines 132-196):
- Remove `backdrop-blur supports-[backdrop-filter]:bg-background/60` and `bg-background/95`
- Use `bg-background border-b-2 border-foreground` (editorial 2px border)
- Replace logo image + "Moim" text with wordmark: `<span className="text-xl font-extrabold tracking-tight">moim</span>`
- Add "Groups" nav link: `<NavLink to="/groups/my">Groups</NavLink>` (links to My Groups since no public groups browse page exists yet)
- Rename "Check-ins" to "Places": `<NavLink to="/places">Places</NavLink>`
- Show full fediverse handle in profile trigger on desktop

- [ ] **Step 3: Replace mobile bottom tab bar with hamburger menu**

Replace the mobile bottom nav (lines 218-250) with a hamburger-triggered slide menu or dropdown. The `bottomBar` slot for page-specific CTAs (like Register on event detail) should be preserved.

Key changes:
- Remove `<CalendarDays>`, `<MapPin>`, `<User>` icon tab bar
- Add hamburger icon button in mobile header (visible `md:hidden`)
- Mobile menu: vertical nav links (Events, Groups, Places) + handle + sign out
- Keep the `bottomBar` slot div for page-specific mobile CTAs

- [ ] **Step 4: Update footer**

Update footer (lines 206-216) to use "Places" instead of "Check-ins". Add "Groups" link.

- [ ] **Step 5: Commit**

```bash
git add src/routes/__root.tsx
git commit -m "feat(nav): editorial navigation with hamburger mobile menu"
```

---

## Task 8: Remove Gradients — Multi-File Pass

**Files:**
- Modify: `src/routes/index.tsx`
- Modify: `src/routes/events/index.tsx`
- Modify: `src/routes/events/$eventId/index.tsx`
- Modify: `src/routes/categories/index.tsx`
- Modify: `src/routes/categories/$categoryId.tsx`
- Modify: `src/routes/groups/$identifier/index.tsx`
- Modify: `src/components/EventCalendar.tsx`
- Modify: `src/components/UpcomingEventList.tsx`
- Delete: `src/shared/gradients.ts`

- [ ] **Step 1: Search for all imports of gradients**

Run: `grep -rn "from.*gradients" src/`

For each file found, remove the import line and replace gradient usage:

- [ ] **Step 2: Update `src/routes/index.tsx` — homepage**

Remove `import { pickGradient } from "~/shared/gradients"` and all `pickGradient()` calls. For the carousel event slides, replace gradient backgrounds with:
- If `headerImageUrl` exists: use image with dark overlay (already works)
- If no image: use `background: "#fafafa"` with `border-bottom: 2px solid #111`

For the event cards grid below the carousel, remove gradient headers. Use #fafafa background for no-image cards.

- [ ] **Step 3: Update `src/routes/events/$eventId/index.tsx` — event detail**

Remove gradient import. Replace the hero background style (line 664-665):
- If `headerImageUrl`: keep the dark overlay treatment
- If no image: use `background: "#fafafa"` instead of `linear-gradient(135deg, gradFrom, gradTo)`

- [ ] **Step 4: Update remaining files**

For each of these files, remove the gradient import and replace gradient usage with #fafafa backgrounds:
- `src/routes/events/index.tsx`
- `src/routes/categories/index.tsx`
- `src/routes/categories/$categoryId.tsx`
- `src/routes/groups/$identifier/index.tsx`
- `src/components/EventCalendar.tsx`
- `src/components/UpcomingEventList.tsx`

- [ ] **Step 5: Delete `src/shared/gradients.ts`**

```bash
rm src/shared/gradients.ts
```

- [ ] **Step 6: Verify no remaining references**

Run: `grep -rn "gradients" src/ --include="*.ts" --include="*.tsx"`

Should return zero results (except possibly comments).

- [ ] **Step 7: Commit**

```bash
git add src/ && git diff --cached --stat
git commit -m "feat: remove all decorative gradients, use typography fallback"
```

Note: Use `git add src/` instead of `git add -A` to avoid staging unrelated files.

---

## Task 9: Remove Emoji from Public Place Category UI

**Files:**
- Modify: `src/components/PlaceCategorySelect.tsx`
- Modify: `src/components/PlacePicker.tsx`

Note: Do NOT modify `src/shared/place-categories.ts` — the emoji field stays in the data (used for map markers in LeafletMap). Only remove emoji from text labels in the UI.

- [ ] **Step 1: Update PlaceCategorySelect**

Find where the select options format labels as `${emoji} ${label}` and change to just `${label}`.

- [ ] **Step 2: Update PlacePicker — emoji removal and extensive emerald class replacement**

This file has deeply embedded emerald styling across many elements. You must replace ALL of these:
- `border-emerald-500`, `bg-emerald-50`, `dark:bg-emerald-950/30`, `border-l-emerald-500` → use `border-foreground`, `bg-muted`
- `bg-emerald-600 hover:bg-emerald-700` → use `bg-foreground hover:bg-foreground/90`
- `dark:bg-emerald-700` → remove
- `hover:bg-emerald-100` → use `hover:bg-muted`
- `border-emerald-300 dark:border-emerald-700` → use `border-border`
- `hover:bg-primary/10` → use `hover:bg-muted`

Also remove emoji display from place category badges/labels.

Run `grep -n "emerald" src/components/PlacePicker.tsx` to find all occurrences before starting. There are ~10 instances.

- [ ] **Step 3: Commit**

```bash
git add src/components/PlaceCategorySelect.tsx src/components/PlacePicker.tsx
git commit -m "feat: remove emoji from place category labels in public UI"
```

---

## Task 10: Homepage — Carousel & Event Listings

**Files:**
- Modify: `src/routes/index.tsx`

This file was partially updated in Task 8 (gradient removal). Now apply the editorial layout.

- [ ] **Step 1: Update carousel event slide markup**

For event slides without images, add the large watermark date on the right side and editorial typography (uppercase date, large bold title, host info, single CTA button).

- [ ] **Step 2: Update carousel banner/ad slide**

Change the "AD" badge from `bg-yellow-400 text-black` to `bg-black/50 text-white text-[10px] uppercase tracking-wide`. Also remove `shadow-sm` from the AD badge if present.

- [ ] **Step 3: Update progress indicator**

Replace the current full-width progress bar with per-slide indicator bars (thin 3px bars, bottom-right).

- [ ] **Step 4: Change event listing from grid to list**

Replace the current `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` event card grid with a list layout:
- Horizontal rows: image thumbnail (140x94px, rounded) or date fallback (3px left border, large date) + content
- Separator `border-b border-[#e0e0e0]` between items
- Uppercase date/time label, bold title (text-lg font-bold), host name, location + attendee count

- [ ] **Step 5: Commit**

```bash
git add src/routes/index.tsx
git commit -m "feat(home): editorial carousel and list-view event listings"
```

---

## Task 11: Event Detail Page

**Files:**
- Modify: `src/routes/events/$eventId/index.tsx`

This file was partially updated in Task 8. Now apply the full editorial treatment.

- [ ] **Step 1: Update hero section**

For no-image hero: use #fafafa background, 2px bottom border, large title (text-3xl font-extrabold tracking-tight), watermark date number (absolute positioned, right side, 100px, 6% opacity).

For image hero: keep dark overlay but remove the category badge's emerald/colored styling. Use `bg-black/50 text-white` for the badge.

- [ ] **Step 2: Update sidebar card**

The sidebar should be a single unified card: date (with calendar icon) → location (with pin icon) → inline map → attendee preview → Register CTA → Bookmark. Ensure the card uses the updated Card component (no shadow, no rounded-xl).

- [ ] **Step 3: Update section headers**

Change "About", "Organizers", "Discussion" CardTitle elements to use uppercase editorial section headers: `text-xs font-bold uppercase tracking-wide text-[#333]`.

- [ ] **Step 4: Update organizer cards**

Ensure organizer cards (vertical layout, horizontal scroll) use the thin border (1px #e5e5e5), rounded (4px), and remove any colored avatar fallbacks (`bg-primary/10`) — use `bg-muted` instead.

- [ ] **Step 5: Remove `shadow-sm` from `src/routes/events/$eventId/register.tsx`**

Search for `shadow-sm` and remove it.

- [ ] **Step 6: Commit**

```bash
git add src/routes/events/\$eventId/index.tsx src/routes/events/\$eventId/register.tsx
git commit -m "feat(event-detail): editorial grayscale treatment"
```

---

## Task 12: Event Listings Page

**Files:**
- Modify: `src/routes/events/index.tsx`
- Modify: `src/components/EventCalendar.tsx`
- Modify: `src/components/UpcomingEventList.tsx`

- [ ] **Step 1: Update events index page**

Apply list-view treatment consistent with homepage. Remove any gradient-dependent card styling.

- [ ] **Step 2: Update EventCalendar component**

Remove gradient usage (done in Task 8). Update any remaining colored styling to grayscale. Calendar day dots should use `bg-foreground` (#111) instead of accent colors.

- [ ] **Step 3: Update UpcomingEventList component**

Remove gradient usage (done in Task 8). Apply editorial card treatment to event items.

- [ ] **Step 4: Commit**

```bash
git add src/routes/events/index.tsx src/components/EventCalendar.tsx src/components/UpcomingEventList.tsx
git commit -m "feat(events): editorial treatment for event listings and calendar"
```

---

## Task 13: Group Pages

**Files:**
- Modify: `src/routes/groups/$identifier/index.tsx`
- Modify: `src/routes/groups/my.tsx`
- Modify: `src/routes/groups/$identifier/dashboard/route.tsx`
- Modify: `src/routes/groups/$identifier/edit.tsx`

- [ ] **Step 1: Update group profile page**

Apply editorial treatment:
- Header: 2px bottom border, bold name (text-2xl font-extrabold), "Group" badge (outline, uppercase, small)
- Follow button: `bg-foreground text-background` (#111), Events button: outline
- Activity timeline: dots use #111 for events, #ccc for notes
- Remove any gradient or colored styling

- [ ] **Step 2: Update My Groups page**

Change from card grid to list rows:
- Avatar (40px) + name (font-bold) + role badge (outline) + handle + stats
- `border-b` separators between rows

- [ ] **Step 3: Update dashboard sidebar**

In `src/routes/groups/$identifier/dashboard/route.tsx`:
- Active nav item: `border-l-2 border-foreground bg-[#f5f5f5] font-semibold`
- Remove any colored active indicators

- [ ] **Step 4: Remove `shadow-sm` from group edit page**

In `src/routes/groups/$identifier/edit.tsx`, find and remove `shadow-sm`.

- [ ] **Step 5: Commit**

```bash
git add src/routes/groups/
git commit -m "feat(groups): editorial grayscale for group pages and dashboard"
```

---

## Task 14: Places Pages

**Files:**
- Modify: `src/routes/places/index.tsx`
- Modify: `src/routes/places/$placeId/index.tsx`

- [ ] **Step 1: Update check-ins page**

- Nearby cards: thin border, selected = `border-2 border-foreground`, category as text (no emoji)
- Selected place detail: editorial header (font-extrabold), Check In button (#111)
- Check-in list: minimal rows (avatar + name + time), no card wrapping each entry
- Remove any emerald or colored classes

- [ ] **Step 2: Update place detail page**

- Header: category as uppercase breadcrumb, bold name, 2px bottom border
- Map link buttons: small outline pills (border, rounded, text-xs)
- Two-column layout with editorial section headers (uppercase)

- [ ] **Step 3: Commit**

```bash
git add src/routes/places/
git commit -m "feat(places): editorial grayscale for check-ins and place detail"
```

---

## Task 15: Categories Pages

**Files:**
- Modify: `src/routes/categories/index.tsx`
- Modify: `src/routes/categories/$categoryId.tsx`

- [ ] **Step 1: Update category listing**

Replace gradient card headers with #fafafa background + large bold category name. Remove emoji. Cards use 1px border, 6px radius.

- [ ] **Step 2: Update category detail page**

Header: category name (text-2xl font-extrabold), event count, 2px bottom border. Remove `rounded-xl` usage. Event listing uses grid view editorial treatment.

- [ ] **Step 3: Commit**

```bash
git add src/routes/categories/
git commit -m "feat(categories): editorial grayscale category pages"
```

---

## Task 16: Auth, Settings, Calendar, Polls, Notes Pages

**Files:**
- Modify: `src/routes/auth/signin.tsx`
- Modify: `src/routes/auth/onboarding.tsx`
- Modify: `src/routes/settings/index.tsx`
- Modify: `src/routes/calendar/index.tsx`
- Modify: `src/routes/polls/$pollId.tsx`
- Modify: `src/routes/notes/$noteId.tsx`
- Modify: `src/components/dashboard/GaugeBar.tsx`

- [ ] **Step 1: Update sign-in page**

Ensure the sign-in card uses updated primitives (no rounded-xl, no shadow). The three sign-in method buttons should use outline variant. Wordmark "moim" at top of card.

- [ ] **Step 2: Update onboarding page**

Same centered card treatment as sign-in. Ensure form inputs use standard input style (cascades from Task 5 primitives update).

- [ ] **Step 3: Update settings page**

Remove `shadow-sm` from any card usage. Ensure consistent with new Card component.

- [ ] **Step 4: Update calendar page**

Remove emerald color classes. Calendar day markers should use `bg-foreground` or `bg-[#111]` instead of emerald.

- [ ] **Step 5: Update poll detail page**

Apply editorial treatment: question text (text-2xl font-extrabold), group name, 2px bottom border. Vote option cards: 1px border, selected = 2px border-foreground. Results percentage bar: grayscale fill (bg-foreground/20 for bar background, bg-foreground for fill).

- [ ] **Step 6: Update note detail page**

Apply editorial treatment: author info (avatar + name + handle), timestamp, 2px bottom border on header. Replace `bg-primary/10` avatar fallback with `bg-muted`.

- [ ] **Step 7: Update GaugeBar component**

In `src/components/dashboard/GaugeBar.tsx`, replace the `#10b981` (emerald) in `GAUGE_COLORS` with a grayscale value (e.g., `#555555`).

- [ ] **Step 8: Commit**

```bash
git add src/routes/auth/ src/routes/settings/ src/routes/calendar/ src/routes/polls/ src/routes/notes/ src/components/dashboard/GaugeBar.tsx
git commit -m "feat: editorial grayscale for auth, settings, calendar, polls, notes pages"
```

---

## Task 17: Remaining Cleanup

**Files:**
- Various files with `bg-primary/10` avatar fallbacks
- Any remaining `shadow-sm`, emerald, or gradient references

- [ ] **Step 1: Find and replace `bg-primary/10` avatar fallbacks**

Run: `grep -rn "bg-primary/10" src/`

Replace all instances with `bg-muted` (which is now #fafafa).

- [ ] **Step 2: Final sweep for remaining issues**

Run these checks:
```bash
grep -rn "shadow-sm" src/ --include="*.tsx"
grep -rn "rounded-xl" src/ --include="*.tsx"
grep -rn "emerald" src/ --include="*.tsx" --include="*.css"
grep -rn "from.*gradients" src/ --include="*.tsx" --include="*.ts"
```

Fix any remaining instances found.

- [ ] **Step 3: Run typecheck**

```bash
pnpm typecheck
```

Fix any TypeScript errors (e.g., from deleted gradients.ts imports).

- [ ] **Step 4: Commit**

```bash
git add src/ && git diff --cached --stat
git commit -m "chore: final cleanup — remove remaining old design artifacts"
```

---

## Task 18: Visual Verification

- [ ] **Step 1: Start dev server**

```bash
pnpm dev
```

- [ ] **Step 2: Check each major page**

Open browser and verify:
- [ ] Homepage: carousel, event list, no gradients
- [ ] Event detail: hero, sidebar, organizers, discussions
- [ ] Groups listing, group profile, group dashboard
- [ ] Places / check-ins, place detail
- [ ] Categories listing, category detail
- [ ] Sign-in page, onboarding page
- [ ] Settings page
- [ ] Calendar page
- [ ] Poll detail, note detail
- [ ] Mobile responsive: navigation, event cards, event detail bottom bar

- [ ] **Step 3: Check for visual regressions**

Look for:
- Broken layouts from radius changes
- Missing borders or unexpected gaps
- Color bleeding from missed cleanup
- Focus states working on buttons and inputs (keyboard navigation)
- Map markers still showing correctly (blue/red)
