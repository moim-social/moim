import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { useEventCategories } from "~/hooks/useEventCategories";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { DateTimePicker } from "~/components/DateTimePicker";
import { Textarea } from "~/components/ui/textarea";
import { PencilIcon, EyeIcon } from "lucide-react";
import { renderMarkdown } from "~/lib/markdown";
import { Label } from "~/components/ui/label";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Checkbox } from "~/components/ui/checkbox";
import { PlacePicker, type SelectedPlace } from "~/components/PlacePicker";
import { TimezonePicker } from "~/components/TimezonePicker";
import { ImageCropper } from "~/components/ImageCropper";
import { Switch } from "~/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "~/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
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
  const navigate = useNavigate();
  const { categories } = useEventCategories();
  const { eventId } = Route.useParams();
  const { refresh } = useDashboard();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showSavedDialog, setShowSavedDialog] = useState(false);

  const [isGroupEvent, setIsGroupEvent] = useState(false);
  const [groupActorId, setGroupActorId] = useState<string | null>(null);
  const [groups, setGroups] = useState<
    { id: string; handle: string; name: string | null; timezone: string | null }[]
  >([]);
  const [groupsLoaded, setGroupsLoaded] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [timezone, setTimezone] = useState<string | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<SelectedPlace | null>(null);
  const [venueDetail, setVenueDetail] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [headerImageUrl, setHeaderImageUrl] = useState<string | null>(null);
  const [headerImagePreview, setHeaderImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageError, setImageError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [showConvertDialog, setShowConvertDialog] = useState(false);
  const [descriptionMode, setDescriptionMode] = useState<"write" | "preview">("write");
  const [allowAnonymousRsvp, setAllowAnonymousRsvp] = useState(false);
  const [anonymousContactFields, setAnonymousContactFields] = useState<{
    email?: string;
    phone?: string;
  } | null>(null);

  // Fetch user's groups for personal→group conversion
  useEffect(() => {
    fetch("/api/me/groups")
      .then((r) => r.json())
      .then((data) => {
        setGroups(data.groups ?? []);
        setGroupsLoaded(true);
      })
      .catch(() => setGroupsLoaded(true));
  }, []);

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
        setVenueDetail(e.venueDetail ?? "");
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
        setAllowAnonymousRsvp(e.allowAnonymousRsvp ?? false);
        setAnonymousContactFields(e.anonymousContactFields ?? null);
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

  const willBeGroupEvent = isGroupEvent || !!groupActorId;

  async function handleConvertToGroup() {
    if (!groupActorId || !title.trim() || !startsAt) return;

    setShowConvertDialog(false);
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
          venueDetail: venueDetail.trim() || undefined,
          externalUrl: externalUrl.trim() || undefined,
          groupActorId,
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
        setError(data.error ?? "Failed to move event to group");
        setSubmitting(false);
        setGroupActorId(null);
        return;
      }
      refresh?.();
      setSubmitting(false);
      setIsGroupEvent(true);
      setGroupActorId(null);
      setShowSavedDialog(true);
    } catch {
      setError("Network error");
      setSubmitting(false);
      setGroupActorId(null);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !startsAt) return;
    if (willBeGroupEvent && !categoryId) return;

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
          venueDetail: venueDetail.trim() || undefined,
          externalUrl: externalUrl.trim() || undefined,
          allowAnonymousRsvp: allowAnonymousRsvp || undefined,
          anonymousContactFields: allowAnonymousRsvp ? anonymousContactFields : undefined,
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
      setSubmitting(false);
      setShowSavedDialog(true);
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
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold tracking-tight">
          Edit Event
        </h2>
        {!isGroupEvent && groupsLoaded && groups.length > 0 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowConvertDialog(true)}
          >
            Move to Group
          </Button>
        )}
      </div>

      <Dialog open={showConvertDialog} onOpenChange={(open) => {
        if (!open) {
          setShowConvertDialog(false);
          setGroupActorId(null);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move to Group</DialogTitle>
            <DialogDescription>
              Select a group to transfer this event to.
            </DialogDescription>
          </DialogHeader>
          <Select
            value={groupActorId ?? undefined}
            onValueChange={setGroupActorId}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a group" />
            </SelectTrigger>
            <SelectContent>
              {groups.map((g) => (
                <SelectItem key={g.id} value={g.id}>
                  {g.name ?? g.handle}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {groupActorId && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="convertCategory">
                  Category <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={categoryId || undefined}
                  onValueChange={setCategoryId}
                >
                  <SelectTrigger id="convertCategory">
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.slug} value={cat.slug}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Alert className="border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200 [&>svg]:text-amber-600 dark:[&>svg]:text-amber-400">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-4">
                  <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 6a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 6Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
                </svg>
                <AlertDescription>
                  This is irreversible. The event will be unpublished and moved to the group permanently.
                </AlertDescription>
              </Alert>
            </>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowConvertDialog(false);
              setGroupActorId(null);
            }}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!groupActorId || !categoryId || submitting}
              onClick={handleConvertToGroup}
            >
              Move to Group
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
          <div className="flex items-center justify-between">
            <Label>Description</Label>
            <div className="flex items-center rounded-md border bg-muted/50 p-0.5">
              <Button
                type="button"
                variant={descriptionMode === "write" ? "secondary" : "ghost"}
                size="xs"
                onClick={() => setDescriptionMode("write")}
                className={descriptionMode !== "write" ? "text-muted-foreground" : ""}
              >
                <PencilIcon className="size-3" />
                Write
              </Button>
              <Button
                type="button"
                variant={descriptionMode === "preview" ? "secondary" : "ghost"}
                size="xs"
                onClick={() => setDescriptionMode("preview")}
                className={descriptionMode !== "preview" ? "text-muted-foreground" : ""}
              >
                <EyeIcon className="size-3" />
                Preview
              </Button>
            </div>
          </div>
          {descriptionMode === "write" ? (
            <Textarea
              id="description"
              placeholder="Describe your event — agenda, what to expect, what to bring..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={6}
            />
          ) : (
            <div className="min-h-[150px] rounded-md border px-3 py-2">
              {description.trim() ? (
                <div
                  className="prose prose-sm max-w-none dark:prose-invert"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(description) }}
                />
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  Nothing to preview yet.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Category */}
        <div className="space-y-1.5">
          <Label htmlFor="categoryId">
            Category{!willBeGroupEvent && " (optional)"}
            {willBeGroupEvent && <span className="text-destructive ml-1">*</span>}
          </Label>
          <Select value={categoryId || undefined} onValueChange={setCategoryId}>
            <SelectTrigger id="categoryId">
              <SelectValue placeholder="Select a category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((cat) => (
                <SelectItem key={cat.slug} value={cat.slug}>
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Date range */}
        <div className="space-y-1.5">
          <Label>
            Event period <span className="text-destructive">*</span>
          </Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <DateTimePicker value={startsAt} onChange={setStartsAt} required />
            <DateTimePicker value={endsAt} onChange={setEndsAt} />
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
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Location (optional)</Label>
            <PlacePicker
              value={selectedPlace}
              onChange={setSelectedPlace}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="venueDetail">Venue detail (optional)</Label>
            <Input
              id="venueDetail"
              type="text"
              placeholder="e.g. 3F, Room 301"
              value={venueDetail}
              onChange={(e) => setVenueDetail(e.target.value)}
            />
          </div>
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

        {/* Anonymous RSVP */}
        <fieldset className="space-y-3">
          <legend className="text-sm font-medium">RSVP Settings</legend>
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="allow-anon-rsvp" className="text-sm">Allow anonymous registration</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Let people register without signing in. Name, email, and phone are collected instead.
              </p>
            </div>
            <Switch
              id="allow-anon-rsvp"
              checked={allowAnonymousRsvp}
              onCheckedChange={(checked) => {
                setAllowAnonymousRsvp(checked);
                if (checked && !anonymousContactFields) {
                  setAnonymousContactFields({ email: "optional", phone: "hidden" });
                }
              }}
            />
          </div>
          {allowAnonymousRsvp && (
            <div className="rounded-md border p-3 space-y-3 bg-muted/30">
              <p className="text-xs text-muted-foreground">
                Name is always required. Configure which contact fields anonymous attendees must provide.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Email</Label>
                  <select
                    className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
                    value={anonymousContactFields?.email ?? "optional"}
                    onChange={(e) =>
                      setAnonymousContactFields({
                        ...anonymousContactFields,
                        email: e.target.value,
                      })
                    }
                  >
                    <option value="required">Required</option>
                    <option value="optional">Optional</option>
                    <option value="hidden">Hidden</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Phone</Label>
                  <select
                    className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
                    value={anonymousContactFields?.phone ?? "hidden"}
                    onChange={(e) =>
                      setAnonymousContactFields({
                        ...anonymousContactFields,
                        phone: e.target.value,
                      })
                    }
                  >
                    <option value="required">Required</option>
                    <option value="optional">Optional</option>
                    <option value="hidden">Hidden</option>
                  </select>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Contact info is auto-deleted 30 days after the event ends.
              </p>
            </div>
          )}
        </fieldset>

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

      <Dialog open={showSavedDialog} onOpenChange={setShowSavedDialog}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Changes saved</DialogTitle>
            <DialogDescription>
              Your event has been updated. Would you like to view the public page?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSavedDialog(false)}>
              Stay here
            </Button>
            <Button
              onClick={() =>
                navigate({
                  to: "/events/$eventId",
                  params: { eventId },
                })
              }
            >
              View event
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
