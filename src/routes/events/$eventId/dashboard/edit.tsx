import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { CATEGORIES } from "~/shared/categories";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Label } from "~/components/ui/label";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Checkbox } from "~/components/ui/checkbox";
import { PlacePicker, type SelectedPlace } from "~/components/PlacePicker";
import { TimezonePicker } from "~/components/TimezonePicker";
import { ImageCropper } from "~/components/ImageCropper";
import { utcToDatetimeLocal, datetimeLocalToUTC } from "~/lib/timezone";
import { useDashboard } from "./route";

export const Route = createFileRoute("/events/$eventId/dashboard/edit")({
  component: EditTab,
});

type QuestionItem = {
  id?: string;
  question: string;
  sortOrder: number;
  required: boolean;
  answerCount: number;
};

function EditTab() {
  const { eventId } = Route.useParams();
  const refresh = useDashboard()?.refresh;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [isGroupEvent, setIsGroupEvent] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [timezone, setTimezone] = useState<string | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<SelectedPlace | null>(null);
  const [externalUrl, setExternalUrl] = useState("");
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [headerImageUrl, setHeaderImageUrl] = useState<string | null>(null);
  const [headerImagePreview, setHeaderImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageError, setImageError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/events/${eventId}`)
      .then((r) => {
        if (!r.ok) throw new Error("Event not found");
        return r.json();
      })
      .then((data) => {
        const e = data.event;
        setIsGroupEvent(!!e.groupHandle);
        setTitle(e.title ?? "");
        setDescription(e.description ?? "");
        setCategoryId(e.categoryId ?? "");
        setTimezone(e.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone);
        setStartsAt(e.startsAt ? utcToDatetimeLocal(e.startsAt, e.timezone) : "");
        setEndsAt(e.endsAt ? utcToDatetimeLocal(e.endsAt, e.timezone) : "");
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
        setHeaderImageUrl(e.headerImageUrl ?? null);
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
        setError("Failed to load event");
        setLoading(false);
      });
  }, [eventId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !startsAt) return;
    if (isGroupEvent && !categoryId) return;

    setSubmitting(true);
    setError("");

    try {
      const res = await fetch(`/api/events/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          categoryId: categoryId || undefined,
          startsAt: datetimeLocalToUTC(startsAt, timezone),
          endsAt: endsAt ? datetimeLocalToUTC(endsAt, timezone) : undefined,
          timezone: timezone || undefined,
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
      refresh?.();
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

  async function handleImageUpload(blob: Blob) {
    setImageError("");
    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append("file", blob, "header.webp");
      const res = await fetch(`/api/events/${eventId}/header-image`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setImageError(data.error ?? "Failed to upload image");
        return;
      }
      setHeaderImageUrl(data.headerImageUrl);
      setHeaderImagePreview(null);
    } catch {
      setImageError("Network error");
    } finally {
      setUploadingImage(false);
    }
  }

  if (loading) {
    return <p className="text-muted-foreground">Loading...</p>;
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h2 className="text-2xl font-semibold tracking-tight mb-6">
        Edit Event
      </h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Header Image */}
        <div className="space-y-1.5">
          <Label>Header Image (optional)</Label>
          {(headerImagePreview || headerImageUrl) && (
            <img
              src={headerImagePreview ?? headerImageUrl!}
              alt="Header preview"
              className="w-full rounded-md object-cover aspect-[1200/630]"
            />
          )}
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setCropSrc(URL.createObjectURL(file));
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploadingImage}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploadingImage ? "Uploading..." : headerImageUrl ? "Change Image" : "Upload Image"}
            </Button>
            {headerImageUrl && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                disabled={uploadingImage}
                onClick={async () => {
                  await fetch(`/api/events/${eventId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      title: title.trim(),
                      startsAt: startsAt,
                      headerImageUrl: null,
                    }),
                  });
                  setHeaderImageUrl(null);
                  setHeaderImagePreview(null);
                }}
              >
                Remove
              </Button>
            )}
          </div>
          {cropSrc && (
            <ImageCropper
              imageSrc={cropSrc}
              open
              onClose={() => setCropSrc(null)}
              onCropped={(blob) => {
                setCropSrc(null);
                setHeaderImagePreview(URL.createObjectURL(blob));
                handleImageUpload(blob);
              }}
            />
          )}
          {imageError && (
            <p className="text-sm text-destructive">{imageError}</p>
          )}
          <p className="text-xs text-muted-foreground">
            Landscape image recommended. Max 10 MB. Will be resized to 1200x630.
          </p>
        </div>

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
          <div className="mt-2">
            <Label>Timezone</Label>
            <TimezonePicker
              value={timezone}
              onChange={setTimezone}
            />
          </div>
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
        </div>
      </form>
    </div>
  );
}
