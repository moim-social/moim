# Moim refactor audit and contribution taste guide

This document is an audit of the current Moim codebase across three axes:

1. **Code quality**: SOLID, separation of concerns, DRY, community convention, readability.
2. **Frontend complexity**: React state, hooks, data fetching, component boundaries, and page complexity.
3. **Taste**: the product and code standards that should guide future contributions.

It is intentionally opinionated. The goal is not to shame existing code; the goal is to create a shared definition of “good” before starting a broad refactor.

## Executive summary

Moim already has the right architectural direction on the server side: repository, service, and controller layers are documented, and several event/ticketing endpoints have begun moving there. The largest remaining quality risk is uneven enforcement. Some code follows the new layers; other code still mixes routing, persistence, request translation, compatibility forwarding, and business rules.

The frontend is the highest-risk area. Route components are frequently acting as pages, containers, forms, API clients, mutation orchestration, validation, and view components at the same time. Large route files and many independent `useState` calls make behavior hard to reason about, hard to test, and easy to regress. The app should move toward route loaders for initial data, TanStack Query for client-server state, reducers or form libraries for multi-step form state, and small presentational components with explicit props.

The taste bar should be: **domain-first, boring, typed, accessible, small, and locally obvious**. A contributor should be able to open one domain folder, understand where data comes from, where business rules live, where UI state lives, and what tests protect the behavior.

## Audit evidence snapshot

These measurements are meant as signals, not absolute quality judgments.

| Area | Finding | Why it matters |
| --- | --- | --- |
| Overall size | TypeScript/TSX under `src/` is about 46k lines. | Refactors should be incremental and domain-scoped, not a single rewrite. |
| Large route files | `src/routes` has 56 TSX files; 28 are over 300 lines and 12 are over 500 lines. | Routes are carrying too much UI and orchestration responsibility. |
| Largest frontend pages | `events/$eventId/dashboard/edit.tsx` is about 1,018 lines, `events/$eventId/index.tsx` about 906 lines, `events/$eventId/register.tsx` about 859 lines. | These files are too large for confident change and review. |
| Form state smell | `events/create.tsx` has about 16 `useState` calls; dashboard edit has about 23. | Many independent states create invalid combinations and duplicated submit mapping. |
| Data fetching split | Some hooks use TanStack Query, while many pages still use raw `fetch` in effects. | Cache invalidation, loading/error behavior, retries, and cancellation become inconsistent. |
| Server routing | `server-entry.ts` imports many controllers and contains direct DB access for route compatibility helpers. | Routing bootstrap is becoming an application object and should be decomposed. |

## Axis 1: code quality audit

### What is good

- The intended layered architecture is explicit: database schema/client, repositories, services, controllers, and server bootstrap.
- There are reusable primitive UI components under `src/components/ui`, which is a good foundation for visual consistency.
- Event form subcomponents already exist, showing that the codebase is moving away from fully inline pages.
- Several business-heavy services have tests, especially around ticketing and payments.
- Fediverse-specific code is at least isolated into `src/server/fediverse`, which prevents ActivityPub concerns from leaking everywhere.

### Main quality problems

#### 1. Separation of concerns is partially implemented, not enforced

The architecture says controllers should handle HTTP, services should handle business logic, and repositories should handle persistence. That is the right direction. The risk is that the boundary remains aspirational unless every new change follows it.

Observed issues:

- `server-entry.ts` still directly imports database primitives and performs lookup logic in routing compatibility helpers.
- Route-level UI files often contain API calls, response shape assumptions, validation, and mutation payload construction.
- Some hooks are API clients, caches, and view-model builders at the same time.

Refactor criterion:

- A server PR is acceptable only if database access is in repositories, business rules are in services, and HTTP response details are in controllers.
- A frontend PR is acceptable only if route components are not the primary home for domain logic.

#### 2. SOLID is mostly violated by file-level responsibilities, not by classes

This is a functional TypeScript codebase, so SOLID should be interpreted as module-level design:

- **Single responsibility**: many route files do too many things.
- **Open/closed**: adding a new field or flow often requires editing large pages and multiple fetch payload builders.
- **Liskov/interface segregation**: less relevant, but DTOs and props should remain narrow and purpose-specific.
- **Dependency inversion**: services should depend on repository interfaces or repository modules, not on HTTP or UI assumptions.

Refactor criterion:

- If a file exceeds roughly 300 lines, it must justify itself by being either generated, pure configuration, or a low-level primitive. Otherwise, split it.
- If a component has more than 8-10 local state variables, consolidate state with a reducer, form model, or extracted hook.
- If a function constructs both UI and API payloads, split view formatting from domain mutation mapping.

#### 3. DRY is inconsistent

The codebase has healthy reuse in primitive components, but duplication appears in page orchestration:

- Auth/session checks appear as raw fetch effects in pages.
- Event create and edit forms maintain overlapping state models and payload construction.
- Remote interaction dialogs have similar state machines and lookup flows.
- Loading, error, empty, and pagination patterns are present but not consistently applied.

Refactor criterion:

- Extract repeated server-state patterns into hooks under `src/hooks` or domain-local hooks.
- Extract repeated mutation payload mapping into `*.mapper.ts` files or domain modules.
- Keep visual reuse in components, but do not over-abstract before two or three real call sites exist.

#### 4. Community conventions are mixed

The stack already includes TanStack Router, TanStack Query, React 19, Tailwind, and Drizzle. The code should lean into these conventions:

- Use TanStack Router loaders for route-critical initial data and redirects.
- Use TanStack Query for client-server state, not ad-hoc `useEffect + fetch` for most reads.
- Use mutations plus query invalidation for writes.
- Keep server-only concerns out of route UI modules.
- Model runtime API payloads with Zod at boundaries where user input or network data enters.

Refactor criterion:

- Raw `fetch` in a component is acceptable for a simple one-shot user action, but repeated reads should go through a query hook.
- `useEffect` should not be used as a default data-fetching primitive.
- Types shared between server and client should be explicit DTOs, not inferred from arbitrary JSON response shapes inside pages.

#### 5. Readability suffers from “scroll distance”

Many important behaviors require scrolling hundreds of lines between state declarations, effects, handlers, and JSX. That makes review expensive.

Refactor criterion:

- A page component should read like a table of contents: load data, bind view model, render named sections.
- JSX sections over 80-120 lines should be extracted into named components.
- Complex conditional render branches should become named booleans or components.

## Axis 2: frontend complexity audit

### Current frontend risk profile

The frontend currently has three overlapping state types mixed in route components:

1. **Server state**: session, groups, events, categories, RSVP data, discussions.
2. **Form state**: event fields, organizers, questions, anonymous RSVP settings, images.
3. **Ephemeral UI state**: dialogs, expanded rows, tabs, previews, menus, loading spinners.

The main problem is not “using hooks.” The problem is using low-level hooks directly everywhere without assigning ownership.

### React hook standards

#### `useState`

Use for small, independent UI state:

- dialog open/closed
- selected tab
- one input in a small component
- hover/expanded state

Do not use many independent `useState` calls for one domain object. Use a reducer or form model when fields must change together.

#### `useReducer`

Use for multi-step forms and objects with invariants:

- event create/edit forms
- RSVP registration flows
- onboarding flows
- organizer/question collections

A reducer makes valid transitions explicit and avoids invalid combinations like `phase = submitting` while stale errors or partial payloads remain.

#### `useEffect`

Use only for synchronization with external systems:

- browser APIs
- subscriptions
- imperative third-party widgets like maps
- timers/polling

Avoid using `useEffect` as the default way to load route data. Prefer route loaders or TanStack Query.

#### `useMemo` and `useCallback`

Use for expensive calculations, referential stability needed by child memoization, or stable callbacks passed to effects. Do not add them for every derived value; that adds ceremony without clarity.

#### TanStack Query

Use for almost all client-server data:

- list/detail reads
- dashboard data
- categories
- session-derived resource lists
- polling flows

Every query hook should define:

- a stable query key
- a typed return value
- error behavior
- whether it is enabled
- invalidation rules for mutations that change it

### Recommended frontend target architecture

For each domain route, use this shape:

```text
src/routes/events/$eventId/dashboard/edit.tsx     # route shell only
src/features/events/edit/EventEditPage.tsx        # page composition
src/features/events/edit/useEventEditForm.ts      # reducer/form state
src/features/events/edit/event-edit.mapper.ts     # API DTO mapping
src/features/events/api.ts                        # query/mutation functions
src/features/events/types.ts                      # client DTOs/view models
src/features/events/components/*.tsx              # local sections
```

If a full `features/` migration is too large, start with route-local folders:

```text
src/routes/events/$eventId/dashboard/-edit/
  EventEditPage.tsx
  useEventEditForm.ts
  mapper.ts
  sections/*.tsx
```

The important taste rule is not the folder name; it is that route files stop being dumping grounds.

### Frontend refactor priorities

1. **Event create/edit form model**
   - Create a shared `EventFormState` and reducer.
   - Create `toCreateEventRequest` and `toUpdateEventRequest` mappers.
   - Move organizer/question operations into reducer actions.
   - Keep UI cards dumb: props in, callbacks out.

2. **Route data loading**
   - Replace auth guard effects with route-level redirects/loaders where practical.
   - Convert repeated `fetch` effects to TanStack Query hooks.
   - Define domain API functions rather than embedding URLs throughout JSX.

3. **Dashboard pages**
   - Break dashboard edit, discussions, and register pages into sections.
   - Standardize list states: loading, empty, error, pagination.
   - Use mutations and invalidation instead of manual refresh plumbing.

4. **Map components**
   - Keep imperative map lifecycle inside adapter components.
   - Avoid leaking provider-specific concepts into generic UI components.
   - Treat maps as external systems: effects are appropriate there, but should be narrow and well-cleaned-up.

5. **Dialog flows**
   - Model dialogs with small state machines: idle, loading, success, error.
   - Reuse remote actor/instance lookup behavior behind hooks.


## Finding-by-finding as-is/to-be examples

Use this section as the seed material for future umbrella issues. The examples are intentionally structural and representative; they are not exact patches to apply blindly.

### Finding A: route files own too many responsibilities

**As-is**

```tsx
// src/routes/events/create.tsx
function CreateEventPage() {
  const [title, setTitle] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [groups, setGroups] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/session").then(/* redirect or continue */);
    fetch("/api/me/groups").then(/* set groups */);
  }, []);

  async function submitEvent() {
    const res = await fetch("/api/events", {
      method: "POST",
      body: JSON.stringify({ title, startsAt /* many more fields */ }),
    });
    // mutation result handling, analytics, upload, redirect
  }

  return <main>{/* hundreds of lines of form UI */}</main>;
}
```

**Problem**

The route owns auth, server reads, form state, DTO mapping, submission orchestration, analytics, image upload, navigation, and JSX. Any event-form change risks touching unrelated concerns.

**To-be**

```tsx
// src/routes/events/create.tsx
export const Route = createFileRoute("/events/create")({
  beforeLoad: requireSession,
  component: CreateEventRoute,
});

function CreateEventRoute() {
  return <CreateEventPage />;
}

// src/features/events/create/CreateEventPage.tsx
export function CreateEventPage() {
  const groups = useMyEventHostGroups();
  const form = useEventForm(createEventDefaults());
  const createEvent = useCreateEventMutation();

  return (
    <EventFormLayout
      mode="create"
      form={form}
      groups={groups.data ?? []}
      onSubmit={() => createEvent.mutate(form.toCreateRequest())}
    />
  );
}
```

**Acceptance criteria**

- The route file only declares routing and top-level wiring.
- Server reads use loader/query hooks, not ad-hoc effects.
- Form-to-API mapping is tested outside React.
- The page component can be reviewed without scrolling through section-level JSX.

### Finding B: server state is fetched with raw effects in pages

**As-is**

```tsx
const [events, setEvents] = useState<EventItem[]>([]);
const [loading, setLoading] = useState(true);

useEffect(() => {
  fetch(`/api/events?${params}`)
    .then((r) => r.json())
    .then((data) => setEvents(data.events ?? []))
    .finally(() => setLoading(false));
}, [tab, country]);
```

**Problem**

Every page invents its own loading, error, cancellation, parsing, cache, and refresh behavior. Mutations cannot reliably invalidate this state.

**To-be**

```ts
// src/features/events/api.ts
export async function listEvents(params: ListEventsParams): Promise<ListEventsResult> {
  const query = new URLSearchParams(params).toString();
  const response = await fetch(`/api/events?${query}`);
  if (!response.ok) throw new Error("Failed to load events");
  return listEventsResultSchema.parse(await response.json());
}

// src/features/events/hooks.ts
export function useEvents(params: ListEventsParams) {
  return useQuery({
    queryKey: ["events", params],
    queryFn: () => listEvents(params),
  });
}
```

**Acceptance criteria**

- Repeated reads are represented as query hooks with stable keys.
- API response parsing and error behavior live outside JSX.
- Mutations invalidate the same query keys they affect.
- Loading, empty, and error UI uses shared dashboard/UI primitives where possible.

### Finding C: form state is fragmented across many `useState` calls

**As-is**

```tsx
const [eventType, setEventType] = useState<"in_person" | "online">("in_person");
const [selectedPlace, setSelectedPlace] = useState<SelectedPlace | null>(null);
const [meetingUrl, setMeetingUrl] = useState("");
const [organizerCoords, setOrganizerCoords] = useState(null);
const [questions, setQuestions] = useState<QuestionDraft[]>([]);
const [organizers, setOrganizers] = useState<Organizer[]>([]);
```

**Problem**

The state model allows impossible combinations. For example, an online event can retain stale place fields, or an in-person event can retain stale meeting data. Create/edit/register flows duplicate field handling and payload construction.

**To-be**

```ts
type EventFormState = {
  basics: { title: string; description: string; categoryId?: string };
  schedule: { startsAt: string; endsAt?: string; timezone: string };
  location:
    | { type: "in_person"; place: SelectedPlace | null; venueDetail?: string }
    | { type: "online"; meetingUrl?: string; organizerCoords?: Coordinates };
  organizers: Organizer[];
  questions: QuestionDraft[];
  anonymousRsvp: AnonymousRsvpSettings;
};

type EventFormAction =
  | { type: "set_title"; title: string }
  | { type: "set_location_type"; locationType: "in_person" | "online" }
  | { type: "add_question" }
  | { type: "remove_organizer"; handle: string };
```

**Acceptance criteria**

- Impossible combinations are prevented or normalized in the reducer.
- Create and edit use the same state shape where business rules overlap.
- DTO mappers are unit tested for in-person and online events.
- UI cards receive only the state slice they render and callbacks they need.

### Finding D: create/edit mutation payload mapping is duplicated

**As-is**

```tsx
body: JSON.stringify({
  title,
  description: description || undefined,
  eventType,
  meetingUrl: eventType === "online" ? meetingUrl.trim() || undefined : undefined,
  placeId: eventType === "in_person" ? selectedPlace?.id || undefined : undefined,
  startsAt: datetimeLocalToUTC(startsAt, timezone),
  endsAt: endsAt ? datetimeLocalToUTC(endsAt, timezone) : undefined,
  questions: questions.map(/* inline mapping */),
});
```

**Problem**

Business meaning is hidden in request construction. Create/edit can drift when one payload gets a field or nullability behavior the other lacks.

**To-be**

```ts
export function toCreateEventRequest(form: EventFormState): CreateEventRequest {
  return {
    ...mapEventBasics(form),
    ...mapEventSchedule(form.schedule),
    ...mapEventLocation(form.location, { emptyClearsValue: false }),
    organizers: mapOrganizers(form.organizers),
    questions: mapQuestions(form.questions),
  };
}

export function toUpdateEventRequest(form: EventFormState): UpdateEventRequest {
  return {
    ...mapEventBasics(form),
    ...mapEventSchedule(form.schedule),
    ...mapEventLocation(form.location, { emptyClearsValue: true }),
    organizers: mapOrganizers(form.organizers),
    questions: mapQuestions(form.questions),
  };
}
```

**Acceptance criteria**

- Create/update differences are explicit options, not accidental `undefined`/`null` drift.
- Date/time conversion is isolated and tested.
- Question and organizer mapping is reused.
- React components call mapper functions rather than building raw request bodies.

### Finding E: server bootstrap has application logic

**As-is**

```ts
// src/server-entry.ts
import { db } from "./server/db/client";
import { actors } from "./server/db/schema";

async function resolveGroupHandle(groupId: string): Promise<string | null> {
  const [group] = await db.select(/* ... */).from(actors).where(/* ... */).limit(1);
  return group?.handle ?? null;
}

apiRouter.post("/groups/:groupId/events", defineEventHandler(async (event) => {
  // compatibility forwarding and request mutation
}));
```

**Problem**

The bootstrap file becomes a god object: middleware, security headers, cleanup jobs, route table, compatibility translation, and data lookup. This makes routing changes noisy and weakens the repository/service boundary.

**To-be**

```ts
// src/server/api-router.ts
export function createApiRouter() {
  const router = createRouter();
  registerAuthRoutes(router);
  registerEventRoutes(router);
  registerGroupRoutes(router);
  registerPlaceRoutes(router);
  return router;
}

// src/server/controllers/groups/compat-events.ts
export const POST = async ({ request, params }) => {
  const forwarded = await GroupEventCompatService.toCreateEventRequest(request, params.groupId);
  return createEvent({ request: forwarded });
};
```

**Acceptance criteria**

- `server-entry.ts` only composes middleware, background jobs, federation, API router, and Start handler.
- Domain route registration is split into small files.
- Direct DB lookup moves behind repository/service functions.
- Compatibility behavior is named, tested, and scheduled for removal if temporary.

### Finding F: hooks mix API client, cache, and view-model responsibilities

**As-is**

```ts
let cachedCategories: EventCategoryOption[] | null = null;
let fetchPromise: Promise<EventCategoryOption[]> | null = null;

export function useEventCategories() {
  const [categories, setCategories] = useState(cachedCategories ?? []);
  useEffect(() => {
    fetchCategories().then(setCategories);
  }, []);
  return { categories, loading };
}
```

**Problem**

A module-level cache duplicates TanStack Query semantics, has no standard invalidation path, and can become stale after admin category edits.

**To-be**

```ts
export function useEventCategories() {
  return useQuery({
    queryKey: ["event-categories"],
    queryFn: listEventCategories,
    select: (data) => data.categories
      .filter((category) => category.enabled)
      .sort(compareEventCategories),
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateEventCategoryMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateEventCategory,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["event-categories"] }),
  });
}
```

**Acceptance criteria**

- Module-level frontend caches are replaced with query cache where mutation invalidation matters.
- Transformations are pure functions and covered by small tests if non-trivial.
- Hooks return query objects or clearly named view models, not a mix of both.

### Finding G: visual and interaction taste is implicit

**As-is**

```tsx
<button className="rounded px-3 py-2 text-sm" onClick={submit}>
  Save
</button>
<div className="text-red-500">{error}</div>
```

**Problem**

Small one-off UI decisions accumulate into inconsistent spacing, states, accessibility, and visual hierarchy. This is where inconsistent frontend implementation usually becomes visible.

**To-be**

```tsx
<form aria-describedby={error ? "event-form-error" : undefined} onSubmit={onSubmit}>
  {error && <Alert id="event-form-error" variant="destructive">{error}</Alert>}
  <Button type="submit" disabled={isSubmitting}>
    {isSubmitting ? "Saving…" : "Save"}
  </Button>
</form>
```

**Acceptance criteria**

- Prefer existing UI primitives before ad-hoc elements.
- Interactive elements expose semantic roles, labels, disabled states, and error descriptions.
- Loading/error/empty states are designed as part of the component, not appended later.
- Styling choices reinforce hierarchy rather than novelty.

## Draft umbrella issue plan

Do not create these issues yet. Use this as the structure when the team is ready to turn findings into trackable work.


### Umbrella issue representation

Each umbrella issue should be represented as a **GitHub issue that owns a refactor theme**, not a single implementation PR. It should have enough structure to coordinate multiple small PRs without becoming a vague wishlist.

Recommended title format:

```text
[Refactor Audit] <domain or layer>: <outcome>
```

Recommended labels:

```text
refactor, umbrella, architecture
```

Add one more scoped label when useful:

```text
frontend | server | events | groups | places | polls | accessibility | tech-debt
```

Recommended issue body:

```md
## Problem

What is structurally wrong today? Describe the current risk, not just the desired solution.

## Evidence

- Files, commands, metrics, or examples that prove the problem exists.
- Link to the relevant section of `docs/refactor-audit.md`.

## Desired end state

What should the codebase look like after this umbrella is complete?

## Scope

### In scope

- Concrete files, domains, or flows this umbrella may change.

### Out of scope

- Explicit boundaries to prevent accidental rewrites.

## Work breakdown

- [ ] PR 1: Small preparatory extraction or test coverage.
- [ ] PR 2: First behavior-preserving migration.
- [ ] PR 3: Follow-up migration.
- [ ] PR 4: Cleanup and remove deprecated path.

## Acceptance criteria

- [ ] The target ownership boundary is true in the changed area.
- [ ] Old and new behavior are covered by tests or documented smoke checks.
- [ ] Existing public API/URL behavior remains compatible unless explicitly called out.
- [ ] Documentation or contributor guidance is updated if the convention changed.

## Risk and rollout

- Risk level: low / medium / high.
- Rollout strategy: behavior-preserving, behind flag, domain-by-domain, or breaking change.
- Manual verification steps.

## Related findings

- Finding A/B/C/etc. from `docs/refactor-audit.md`.
```

A filled example should look like this:

```md
# [Refactor Audit] Events frontend: extract event form ownership

## Problem

Event create and edit pages duplicate form fields, location rules, organizer/question handling, and request-body mapping. Because form state is spread across many independent `useState` calls, impossible states can persist and create/edit behavior can drift.

## Evidence

- `events/create.tsx` and dashboard edit both construct event mutation payloads inline.
- Audit Finding C describes fragmented form state.
- Audit Finding D describes duplicated mutation payload mapping.

## Desired end state

Create and edit share an `EventFormState`, reducer/actions, and create/update DTO mappers. Route/page components render sections and call mutations; they do not own field invariants or request-body construction.

## Scope

### In scope

- Event create form.
- Event dashboard edit form.
- Organizer and question state operations.
- Online/in-person location switching.
- Create/update request DTO mapping.

### Out of scope

- Redesigning the event form UI.
- Changing event API semantics.
- Refactoring RSVP registration.
- Changing database schema.

## Work breakdown

- [ ] PR 1: Add mapper tests around current create/edit payload behavior.
- [ ] PR 2: Introduce `EventFormState` and pure reducer with tests.
- [ ] PR 3: Move create page to the shared form model.
- [ ] PR 4: Move dashboard edit page to the shared form model.
- [ ] PR 5: Remove duplicated inline payload mapping and document the pattern.

## Acceptance criteria

- [ ] Create and edit use the same state shape for overlapping fields.
- [ ] Online/in-person switching clears or ignores incompatible fields consistently.
- [ ] `toCreateEventRequest` and `toUpdateEventRequest` are tested.
- [ ] Route files no longer construct raw event request bodies.
- [ ] No user-visible behavior changes except documented bug fixes.

## Risk and rollout

- Risk level: medium, because event creation and editing are core flows.
- Rollout strategy: behavior-preserving PRs with mapper tests before component migration.
- Manual verification: create online event, create in-person event, edit each type, add/remove organizer, add/remove question, toggle anonymous RSVP.

## Related findings

- Finding A: route files own too many responsibilities.
- Finding C: form state is fragmented across many `useState` calls.
- Finding D: create/edit mutation payload mapping is duplicated.
```

Use this representation because it forces each issue to answer five questions before implementation starts:

1. What current structure is harmful?
2. What evidence proves it?
3. What exact end state are we moving toward?
4. What is deliberately out of scope?
5. How can reviewers know the umbrella is complete?

### [Refactor Audit] Umbrella issue 1: Frontend route ownership and page decomposition

**Problem statement**

Route files currently own too many responsibilities, making frontend changes risky and reviews expensive.

**Scope**

- Event create page.
- Event dashboard edit page.
- Event detail/register pages.
- Group dashboard route pages after the event pattern is proven.

**As-is example**

```tsx
// src/routes/events/$eventId/dashboard/edit.tsx
export const Route = createFileRoute("/events/$eventId/dashboard/edit")({
  component: EditTab,
});

function EditTab() {
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [questions, setQuestions] = useState([]);

  useEffect(() => {
    fetch(`/api/events/${eventId}`).then(/* hydrate every field */);
  }, [eventId]);

  async function handleSubmit() {
    await fetch(`/api/events/${eventId}`, { method: "PATCH", body: JSON.stringify(/* form */) });
  }

  return <>{/* route, page, form sections, mutation UI, dialogs */}</>;
}
```

**To-be example**

```tsx
// src/routes/events/$eventId/dashboard/edit.tsx
export const Route = createFileRoute("/events/$eventId/dashboard/edit")({
  component: EventEditRoute,
});

function EventEditRoute() {
  const { eventId } = Route.useParams();
  return <EventEditPage eventId={eventId} />;
}

// src/features/events/edit/EventEditPage.tsx
export function EventEditPage({ eventId }: { eventId: string }) {
  const event = useEventForEditing(eventId);
  const form = useEventEditForm(event.data);
  const update = useUpdateEventMutation(eventId);

  return <EventEditLayout form={form} onSubmit={() => update.mutate(form.toUpdateRequest())} />;
}
```

**Deliverables**

- Route shell convention documented and applied to one pilot route.
- Page composition components extracted.
- Section components extracted for long JSX blocks.
- No behavior changes except bug fixes discovered during extraction.

**Definition of done**

- Pilot route file is under 100 lines or has a documented exception.
- Domain logic is in hooks/reducers/mappers, not JSX.
- Existing user flows still pass manual smoke testing.

### [Refactor Audit] Umbrella issue 2: Event form state model and DTO mappers

**Problem statement**

Event create/edit forms duplicate field state, mapping logic, and validity rules.

**Scope**

- Shared event form state type.
- Reducer/actions for location, schedule, organizers, questions, and anonymous RSVP.
- Create/update request mappers.
- Unit tests for reducer and mappers.

**As-is example**

```tsx
const [eventType, setEventType] = useState<"in_person" | "online">("in_person");
const [selectedPlace, setSelectedPlace] = useState<SelectedPlace | null>(null);
const [meetingUrl, setMeetingUrl] = useState("");
const [questions, setQuestions] = useState<QuestionDraft[]>([]);

const requestBody = {
  eventType,
  meetingUrl: eventType === "online" ? meetingUrl : undefined,
  placeId: eventType === "in_person" ? selectedPlace?.id : undefined,
  questions: questions.map((question, sortOrder) => ({ ...question, sortOrder })),
};
```

**To-be example**

```ts
const form = useEventForm(initialEventFormState);

form.dispatch({ type: "set_location_type", locationType: "online" });
form.dispatch({ type: "add_question", question: "Dietary restrictions?" });

const requestBody = toUpdateEventRequest(form.state);
```

**Deliverables**

- `EventFormState` model.
- `useEventForm` hook or reducer.
- `toCreateEventRequest` and `toUpdateEventRequest` functions.
- Tests covering online/in-person switching, time conversion, organizers, questions, and anonymous RSVP settings.

**Definition of done**

- Create and edit forms use the same model for overlapping fields.
- No inline event payload mapping remains in route/page components.
- Reducer prevents stale incompatible location fields.

### [Refactor Audit] Umbrella issue 3: TanStack Query normalization

**Problem statement**

Server state is loaded inconsistently through raw effects, custom module caches, and query hooks.

**Scope**

- Event list/detail/dashboard data.
- Session and user group reads.
- Event/place category reads.
- Admin category mutation invalidation.

**As-is example**

```tsx
const [groups, setGroups] = useState([]);
const [groupsLoaded, setGroupsLoaded] = useState(false);

useEffect(() => {
  fetch("/api/me/groups")
    .then((r) => r.json())
    .then((data) => setGroups(data.groups ?? []))
    .finally(() => setGroupsLoaded(true));
}, []);
```

**To-be example**

```ts
export function useMyGroups() {
  return useQuery({
    queryKey: ["me", "groups"],
    queryFn: getMyGroups,
  });
}

export function useCreateGroupMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createGroup,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["me", "groups"] }),
  });
}
```

**Deliverables**

- Domain API modules with typed functions.
- Query key conventions.
- Mutation invalidation conventions.
- Replacement of ad-hoc module-level caches where they can go stale.

**Definition of done**

- Repeated reads use TanStack Query or route loaders.
- Query keys are documented and reused by mutations.
- Loading/error/empty states are consistent.

### [Refactor Audit] Umbrella issue 4: Server bootstrap and API registration cleanup

**Problem statement**

`server-entry.ts` is too broad and contains application-level details that should live in domain routers/controllers/services.

**Scope**

- API route registration split by domain.
- Compatibility forwarding handlers.
- Direct DB access in bootstrap.
- Background job startup naming and grouping.

**As-is example**

```ts
// src/server-entry.ts
const app = createApp({ onError });
app.use(integrateFederation(federation, () => undefined));
app.use(defineEventHandler(setSecurityHeaders));
startCleanupInterval();

const apiRouter = createRouter();
apiRouter.post("/auth/otp-requests", defineEventHandler(/* ... */));
apiRouter.get("/events", defineEventHandler(/* ... */));
apiRouter.post("/groups/:groupId/events", defineEventHandler(/* compatibility + lookup */));
```

**To-be example**

```ts
// src/server-entry.ts
const app = createApp({ onError });
app.use(createFederationMiddleware());
app.use(createSecurityHeadersMiddleware());
startBackgroundJobs();
app.use("/api", createApiRouter());
app.use(toWebHandler(startFetch));

// src/server/api-router.ts
export function createApiRouter() {
  const router = createRouter();
  registerAuthRoutes(router);
  registerEventRoutes(router);
  registerGroupRoutes(router);
  return router;
}
```

**Deliverables**

- `src/server/api-router.ts` plus domain registration modules.
- Repository/service wrapper for group handle resolution.
- Compatibility controller/service for forwarded group-event routes.
- Smoke tests or lightweight integration tests for route registration where feasible.

**Definition of done**

- `server-entry.ts` reads as app bootstrap only.
- No new direct DB access is introduced in bootstrap.
- Existing API paths continue to work.

### [Refactor Audit] Umbrella issue 5: UI taste and accessibility baseline

**Problem statement**

Visual and interaction conventions are implicit, causing inconsistent UI quality.

**Scope**

- Form errors and descriptions.
- Loading/empty/error states.
- Buttons, dialogs, popovers, tabs, and command menus.
- Reusable dashboard primitives.

**As-is example**

```tsx
<div className="space-y-2">
  <input value={title} onChange={(event) => setTitle(event.target.value)} />
  {error && <p className="text-red-500">{error}</p>}
  <button onClick={submit}>Submit</button>
</div>
```

**To-be example**

```tsx
<FormField
  id="event-title"
  label="Event title"
  error={errors.title}
  required
>
  <Input
    id="event-title"
    value={title}
    aria-invalid={!!errors.title}
    aria-describedby={errors.title ? "event-title-error" : undefined}
    onChange={(event) => setTitle(event.target.value)}
  />
</FormField>
<Button type="submit" disabled={isSubmitting}>
  {isSubmitting ? "Submitting…" : "Submit"}
</Button>
```

**Deliverables**

- UI checklist added to contributor docs.
- A11y pass over event create/edit/register flows.
- Shared examples for form field layout and destructive actions.
- Screenshots for perceptible UI changes in future PRs.

**Definition of done**

- New UI work uses primitives and semantic markup by default.
- Major flows have explicit loading, empty, and error states.
- Keyboard and screen-reader affordances are considered in review.

### [Refactor Audit] Umbrella issue 6: Server layer enforcement

**Problem statement**

The repository/service/controller boundary exists but is not yet consistently enforceable.

**Scope**

- New server changes across places, groups, polls, and events.
- Old route handlers still holding API logic.
- Inline queries outside repositories.
- Service errors and response mapping.

**As-is example**

```ts
// controller or route handler
export const POST = async ({ request }) => {
  const user = await getSessionUser(request);
  const body = await request.json();
  const [event] = await db.insert(events).values({
    title: body.title,
    organizerId: user.id,
  }).returning();
  await publishCreateActivity(event);
  return Response.json({ event });
};
```

**To-be example**

```ts
// controller
export const POST = async ({ request }) => {
  const user = await requireSessionUser(request);
  const body = createEventSchema.parse(await request.json());
  const event = await EventService.createEvent(user.id, body);
  return Response.json({ event });
};

// service
export async function createEvent(userId: string, params: CreateEventParams) {
  const event = await EventRepo.insert(toNewEvent(userId, params));
  await EventFederationService.publishCreate(event.id);
  return event;
}
```

**Deliverables**

- Review checklist for server layer changes.
- Optional lint/import-boundary rules.
- Domain migration tracking list.
- Tests around migrated service behavior.

**Definition of done**

- New server PRs follow controller -> service -> repository.
- Exceptions are documented and temporary.
- Migration progress is trackable per domain.

## Axis 3: taste definition and audit

“Taste” is the standard that tells contributors what to optimize for when there is no obvious right answer.

### Moim taste principles

#### 1. Domain-first

Code should be organized around product concepts: events, groups, places, polls, actors, tickets. Technical folders are useful for primitives, but business behavior should be discoverable by domain.

Good:

- `events` service owns event lifecycle rules.
- `places` service owns place creation, audit, and geospatial behavior.
- `components/ui` owns generic primitives only.

Bad:

- Route components owning event lifecycle rules.
- Generic utility files becoming junk drawers.

#### 2. Boring beats clever

Prefer explicit, familiar patterns over clever abstractions. A contributor should understand the flow without knowing hidden framework magic.

Good:

- `queryKey: ["event", eventId]`
- `createEvent(userId, params)`
- `toUpdateEventRequest(form)`

Bad:

- implicit global caches
- untyped JSON plumbing
- helper names that hide side effects

#### 3. Typed at boundaries

Network, user input, database rows, and federation payloads are boundaries. Validate and type these carefully. Inside trusted code, keep types ergonomic.

Good:

- Zod for request bodies.
- DTOs for client responses.
- Repository return types from Drizzle models.

Bad:

- `any` in response mapping.
- components that assume optional API fields without normalization.

#### 4. Small enough to review

The unit of code should fit in a reviewer’s head.

Targets:

- Route shell: under 100 lines when possible.
- Page composition component: under 250-300 lines.
- Presentational component: under 150 lines.
- Hook/reducer: under 200 lines unless it has dense, well-tested domain logic.
- Server controller: under 120 lines for typical endpoints.

These are taste thresholds, not laws. Exceeding them requires a reason.

#### 5. One source of truth for each state

Do not duplicate the same fact in multiple states unless one is explicitly derived.

Good:

- `eventType` determines whether place fields or meeting URL fields are submitted.
- form reducer resets incompatible fields when event type changes.

Bad:

- independent fields that can represent impossible states.
- derived maps recreated on every render without memoization when passed downstream.

#### 6. Accessible by default

Moim is an events and places product; accessibility is not polish. It is core functionality.

Standards:

- Use semantic buttons, labels, headings, and form errors.
- Preserve keyboard navigation in dialogs, popovers, maps, and command menus.
- Do not rely only on color or emoji to convey meaning.
- Keep loading and error states visible to screen readers where practical.

#### 7. Federation side effects are explicit

ActivityPub delivery, remote actor resolution, and object publication are side effects. They should be named and isolated.

Good:

- service function clearly calls `publishEventActivity` or similar.
- background failures are logged and categorized.

Bad:

- a controller or route handler silently causing federation side effects through a helper.

## Contribution convention

### Before changing code

1. Identify the domain: events, groups, places, polls, auth, admin, federation, or UI primitive.
2. Identify the state type: server state, form state, ephemeral UI state, or external-system state.
3. Identify the layer that should own the change.
4. Add or update tests around the behavior before broad cleanup when practical.

### Required change shape

#### Server changes

- Repository: database only.
- Service: business rules, validation, authorization decisions, side-effect orchestration.
- Controller: HTTP parsing and serialization only.
- Server entry: registration only. No new direct database queries.

#### Frontend changes

- Route file: route definition, loader/search params, and high-level component wiring.
- Query hook/API module: client-server data.
- Reducer/form hook: multi-field form state and transitions.
- Component: presentation and local UI state.
- Mapper: converting form state to API request DTOs.

#### Styling changes

- Prefer existing `components/ui` primitives.
- Prefer Tailwind utility classes that express layout directly.
- Extract repeated visual patterns into components only after repetition is clear.
- Avoid component props that expose arbitrary styling escape hatches unless the component is a primitive.

### Review checklist

Use this checklist for every meaningful PR:

- [ ] Does each changed file have one clear responsibility?
- [ ] Are server boundaries respected: controller -> service -> repository?
- [ ] Are route components free of avoidable business logic?
- [ ] Is server state handled through loaders or TanStack Query instead of raw effect fetching?
- [ ] Are multi-field forms represented by a coherent state model?
- [ ] Are API request and response shapes typed at the boundary?
- [ ] Are loading, empty, and error states explicit?
- [ ] Are accessibility semantics preserved or improved?
- [ ] Is the abstraction justified by current repetition, not imagined future reuse?
- [ ] Can a reviewer understand the change without scrolling through unrelated concerns?

## Recommended refactor roadmap

### Phase 0: Guardrails

- Add this document to contributor onboarding.
- Add lint rules or review guidance for no new raw DB access outside repositories, except migrations and bootstrap exceptions.
- Add frontend review guidance for route file size, raw fetch usage, and `useEffect` data fetching.

### Phase 1: Event form extraction

- Extract shared event form state and reducer.
- Extract create/update request mappers.
- Split dashboard edit into route shell, page composition, and sections.
- Add unit tests for reducer transitions and mapper output.

### Phase 2: Query normalization

- Create domain API modules for events, groups, places, auth, and admin.
- Move repeated reads to TanStack Query hooks.
- Standardize mutation invalidation.
- Replace ad-hoc category caching with query cache semantics.

### Phase 3: Server routing cleanup

- Split `server-entry.ts` API registrations by domain.
- Move direct routing-time DB lookups behind repositories/services.
- Keep `server-entry.ts` as bootstrap and middleware composition only.

### Phase 4: Domain-by-domain migration

Follow the existing migration order:

1. Places
2. Groups
3. Polls
4. Events

For each domain, migrate route handlers to controllers, queries to repositories, and business logic to services. Avoid cross-domain rewrites unless a domain boundary requires it.

## Non-goals

- Do not rewrite the whole app in one PR.
- Do not introduce a heavy state-management library before TanStack Query plus reducers are exhausted.
- Do not create generic abstractions for one use case.
- Do not move files only to make the tree look cleaner; move files when ownership becomes clearer.
- Do not refactor federation behavior casually. Federation bugs are hard to detect and should be isolated behind tests.
