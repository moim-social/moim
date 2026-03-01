import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { CATEGORIES } from "~/shared/categories";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Label } from "~/components/ui/label";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Checkbox } from "~/components/ui/checkbox";
import { PlacePicker, type SelectedPlace } from "~/components/PlacePicker";

export const Route = createFileRoute("/events/$eventId/edit")({
  component: EditEventPage,
});

type QuestionItem = {
  id?: string;
  question: string;
  sortOrder: number;
  required: boolean;
  answerCount: number;
};

function toLocalDatetime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function EditEventPage() {
  const { eventId } = Route.useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [isGroupEvent, setIsGroupEvent] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [selectedPlace, setSelectedPlace] = useState<SelectedPlace | null>(null);
  const [externalUrl, setExternalUrl] = useState("");
  const [questions, setQuestions] = useState<QuestionItem[]>([]);

  useEffect(() => {
    fetch(`/events/detail?id=${eventId}`)
      .then((r) => {
        if (!r.ok) throw new Error("Event not found");
        return r.json();
      })
      .then((data) => {
        if (!data.canEdit) {
          navigate({ to: "/events/$eventId", params: { eventId } });
          return;
        }
        const e = data.event;
        setIsGroupEvent(!!e.groupHandle);
        setTitle(e.title ?? "");
        setDescription(e.description ?? "");
        setCategoryId(e.categoryId ?? "");
        setStartsAt(e.startsAt ? toLocalDatetime(e.startsAt) : "");
        setEndsAt(e.endsAt ? toLocalDatetime(e.endsAt) : "");
        if (e.placeId) {
          setSelectedPlace({
            id: e.placeId,
            name: e.placeName ?? e.location ?? "",
            address: e.placeAddress ?? null,
            latitude: e.placeLatitude ?? null,
            longitude: e.placeLongitude ?? null,
          });
        }
        setExternalUrl(e.externalUrl ?? "");
        setQuestions(
          (data.questions ?? []).map((q: any, idx: number) => ({
            id: q.id,
            question: q.question,
            sortOrder: q.sortOrder ?? idx,
            required: q.required ?? false,
            answerCount: q.answerCount ?? 0,
          })),
        );
        setLoading(false);
      })
      .catch(() => {
        navigate({ to: "/events/$eventId", params: { eventId } });
      });
  }, [eventId, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !startsAt) return;
    if (isGroupEvent && !categoryId) return;

    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/events/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          title: title.trim(),
          description: description.trim() || undefined,
          categoryId: categoryId || undefined,
          startsAt: new Date(startsAt).toISOString(),
          endsAt: endsAt ? new Date(endsAt).toISOString() : undefined,
          placeId: selectedPlace?.id || undefined,
          location: selectedPlace?.name || undefined,
          externalUrl: externalUrl.trim() || undefined,
          questions: questions
            .filter((q) => q.question.trim())
            .map((q, idx) => ({
              id: q.id,
              question: q.question.trim(),
              sortOrder: idx,
              required: q.required,
            })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to update event");
        setSubmitting(false);
        return;
      }
      navigate({ to: "/events/$eventId", params: { eventId } });
    } catch {
      setError("Network error");
      setSubmitting(false);
    }
  }

  function addQuestion() {
    setQuestions([
      ...questions,
      {
        question: "",
        sortOrder: questions.length,
        required: false,
        answerCount: 0,
      },
    ]);
  }

  function removeQuestion(idx: number) {
    setQuestions(questions.filter((_, i) => i !== idx));
  }

  function updateQuestion(idx: number, patch: Partial<QuestionItem>) {
    const updated = [...questions];
    updated[idx] = { ...updated[idx], ...patch };
    setQuestions(updated);
  }

  if (loading) {
    return <p className="text-muted-foreground">Loading...</p>;
  }

  return (
    <main className="mx-auto max-w-2xl">
      <h2 className="text-2xl font-semibold tracking-tight mb-6">
        Edit Event
      </h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Title */}
        <div className="space-y-1.5">
          <Label htmlFor="title">
            Title <span className="text-destructive">*</span>
          </Label>
          <Input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
          />
        </div>

        {/* Category */}
        <div className="space-y-1.5">
          <Label htmlFor="categoryId">
            Category{!isGroupEvent && " (optional)"}
            {isGroupEvent && <span className="text-destructive ml-1">*</span>}
          </Label>
          <select
            id="categoryId"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            required={isGroupEvent}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <option value="">Select a category</option>
            {CATEGORIES.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.label}
              </option>
            ))}
          </select>
        </div>

        {/* Date range */}
        <div className="space-y-1.5">
          <Label>
            Event period <span className="text-destructive">*</span>
          </Label>
          <div className="grid grid-cols-2 gap-4">
            <Input
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              required
            />
            <Input
              type="datetime-local"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
            />
          </div>
          <p className="text-xs text-muted-foreground">End time is optional.</p>
        </div>

        {/* Location */}
        <div className="space-y-1.5">
          <Label>Location (optional)</Label>
          <PlacePicker
            value={selectedPlace}
            onChange={setSelectedPlace}
          />
        </div>

        {/* External registration URL */}
        <div className="space-y-1.5">
          <Label htmlFor="externalUrl">External registration URL (optional)</Label>
          <Input
            id="externalUrl"
            type="url"
            placeholder="https://eventbrite.com/e/..."
            value={externalUrl}
            onChange={(e) => setExternalUrl(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Attendees will be directed to this URL instead of the built-in RSVP.
          </p>
        </div>

        {/* Questions */}
        <fieldset className="space-y-3">
          <legend className="text-sm font-medium">RSVP Questions</legend>

          {questions.map((q, idx) => {
            const hasAnswers = q.answerCount > 0;
            return (
              <div key={q.id ?? `new-${idx}`} className="flex items-start gap-3 border rounded-md p-3">
                <div className="flex-1 space-y-2">
                  <Input
                    placeholder={`Question ${idx + 1}`}
                    value={q.question}
                    onChange={(e) => updateQuestion(idx, { question: e.target.value })}
                  />
                  <label className="flex items-center gap-2">
                    <Checkbox
                      checked={q.required}
                      onCheckedChange={(checked) =>
                        updateQuestion(idx, { required: !!checked })
                      }
                    />
                    <span className="text-sm">Required</span>
                  </label>
                  {hasAnswers && (
                    <p className="text-xs text-muted-foreground">
                      {q.answerCount} answer{q.answerCount !== 1 && "s"} — cannot be removed
                    </p>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  disabled={hasAnswers}
                  onClick={() => removeQuestion(idx)}
                >
                  Remove
                </Button>
              </div>
            );
          })}

          <Button type="button" variant="outline" onClick={addQuestion}>
            + Add Question
          </Button>
        </fieldset>

        <div className="flex gap-3">
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving..." : "Save Changes"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              navigate({ to: "/events/$eventId", params: { eventId } })
            }
          >
            Cancel
          </Button>
        </div>
      </form>
    </main>
  );
}
