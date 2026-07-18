# Contributing to Moim

This guide defines the contribution conventions for refactoring and new feature work. The goal is to keep Moim domain-oriented, readable, typed, accessible, and easy to review.

## Refactor taste bar

Optimize for code that is:

- **Domain-first**: business behavior is discoverable by product concept: events, groups, places, polls, actors, tickets.
- **Boring**: prefer explicit, familiar patterns over clever abstractions.
- **Typed at boundaries**: validate network/user-input payloads and keep request/response DTOs explicit.
- **Small enough to review**: route shells, components, hooks, reducers, and controllers should each have one obvious responsibility.
- **Accessible by default**: form labels, error descriptions, semantic controls, keyboard behavior, and loading/empty/error states are part of the feature.
- **Side effects are named**: federation, email, payments, storage, analytics, and background work should be explicit service calls.

## Server conventions

Server code follows the `controller -> service -> repository` direction.

- **Repository**: database access only. No HTTP types, no `Response`, no business orchestration.
- **Service**: validation, authorization decisions, business rules, and side-effect orchestration. Throw `ServiceError`; do not return HTTP responses.
- **Controller**: session checks, request parsing, response serialization, and status-code mapping.
- **Server entry/bootstrap**: middleware, background job startup, federation integration, API router registration, and Start handler wiring only.

### Server as-is / to-be

As-is:

```ts
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

To-be:

```ts
export const POST = async ({ request }) => {
  const user = await requireSessionUser(request);
  const body = createEventSchema.parse(await request.json());
  const event = await EventService.createEvent(user.id, body);
  return Response.json({ event });
};

export async function createEvent(userId: string, params: CreateEventParams) {
  const event = await EventRepo.insert(toNewEvent(userId, params));
  await EventFederationService.publishCreate(event.id);
  return event;
}
```

## Frontend conventions

Route files should not become the primary home for domain logic.

Preferred ownership:

- **Route file**: route declaration, loader/search param glue, and top-level component wiring.
- **Query/API module**: client-server reads and writes with typed DTOs.
- **Reducer/form hook**: multi-field form state, invariants, and transitions.
- **Mapper**: conversion from form/view state to API request DTOs.
- **Component**: presentation and small local UI state.

### React hook guidance

- Use `useState` for small, independent UI state like dialog open state, selected tab, or one local input.
- Use `useReducer` or a form hook for multi-step forms and fields that must change together.
- Use `useEffect` for synchronizing with external systems, not as the default data-fetching tool.
- Use TanStack Query for repeated server-state reads and for mutation invalidation.
- Use `useMemo`/`useCallback` only when they protect expensive work or required referential stability.

### Frontend as-is / to-be

As-is:

```tsx
function EditEventPage() {
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [questions, setQuestions] = useState([]);

  useEffect(() => {
    fetch(`/api/events/${eventId}`).then(/* hydrate every field */);
  }, [eventId]);

  async function handleSubmit() {
    await fetch(`/api/events/${eventId}`, {
      method: "PATCH",
      body: JSON.stringify({ title, questions }),
    });
  }

  return <>{/* route, page, form sections, mutation UI, dialogs */}</>;
}
```

To-be:

```tsx
export const Route = createFileRoute("/events/$eventId/dashboard/edit")({
  component: EventEditRoute,
});

function EventEditRoute() {
  const { eventId } = Route.useParams();
  return <EventEditPage eventId={eventId} />;
}

export function EventEditPage({ eventId }: { eventId: string }) {
  const event = useEventForEditing(eventId);
  const form = useEventEditForm(event.data);
  const update = useUpdateEventMutation(eventId);

  return <EventEditLayout form={form} onSubmit={() => update.mutate(form.toUpdateRequest())} />;
}
```

## Review checklist

Use this checklist for meaningful PRs:

- [ ] Does each changed file have one clear responsibility?
- [ ] Are server boundaries respected: controller -> service -> repository?
- [ ] Are route components free of avoidable business logic?
- [ ] Is repeated server state handled through loaders or TanStack Query instead of raw effect fetching?
- [ ] Are multi-field forms represented by a coherent state model?
- [ ] Are API request and response shapes typed at the boundary?
- [ ] Are loading, empty, and error states explicit?
- [ ] Are accessibility semantics preserved or improved?
- [ ] Is the abstraction justified by current repetition, not imagined future reuse?
- [ ] Can a reviewer understand the change without scrolling through unrelated concerns?
