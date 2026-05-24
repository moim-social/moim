import {
  type ReactNode,
  cloneElement,
  isValidElement,
  useEffect,
  useState,
} from "react";
import { Check, EllipsisVertical, Loader2, Star, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Badge } from "~/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { useRemoteInstance } from "~/hooks/useRemoteInstance";

export type RemoteInteractionKind = "follow" | "vote" | "discussion";

interface ResolvedInstance {
  domain: string;
  title: string;
  software: string | null;
  interactionUrl: string;
}

const KIND_CONFIG: Record<
  RemoteInteractionKind,
  { verb: string; dialogTitle: string; dialogDescription: string; idleLabel: string }
> = {
  follow: {
    verb: "Follow",
    dialogTitle: "Remote Follow",
    dialogDescription: "Follow from your own fediverse instance.",
    idleLabel: "Remote Follow",
  },
  vote: {
    verb: "Vote",
    dialogTitle: "Remote Vote",
    dialogDescription: "Vote on this poll from your fediverse instance.",
    idleLabel: "Remote Vote",
  },
  discussion: {
    verb: "Reply",
    dialogTitle: "Join the Discussion",
    dialogDescription: "Open this post on your own fediverse instance to reply.",
    idleLabel: "Discuss on your instance",
  },
};

async function resolveInstance(
  instance: string,
  kind: RemoteInteractionKind,
  target: string,
): Promise<ResolvedInstance> {
  const res = await fetch("/api/resolve-instance", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      instance,
      target: { type: kind === "follow" ? "handle" : "url", value: target },
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Instance lookup failed.");
  return data as ResolvedInstance;
}

/**
 * A remote follow / vote / reply control. Once the user has interacted from an
 * instance it is remembered, so later interactions become a single click on
 * `{verb} with {instance}`; the `⋮` menu switches instance or adds a new one.
 */
export function RemoteInteractionButton({
  kind,
  target,
  className,
  trigger,
  triggerVariant = "split",
  triggerLabel,
}: {
  kind: RemoteInteractionKind;
  target: string;
  className?: string;
  /** Custom trigger element; when given, the split button is not rendered. */
  trigger?: ReactNode;
  triggerVariant?: "split" | "button" | "ghost" | "link";
  triggerLabel?: ReactNode;
}) {
  const cfg = KIND_CONFIG[kind];
  const { defaultInstance, knownInstances, remember, setDefault, remove } =
    useRemoteInstance();

  // Avoid a hydration mismatch: localStorage is only known after mount.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"input" | "confirm">("input");
  const [inputValue, setInputValue] = useState("");
  const [resolved, setResolved] = useState<ResolvedInstance | null>(null);
  const [loading, setLoading] = useState(false);
  const [quickLoading, setQuickLoading] = useState(false);
  const [error, setError] = useState("");

  const defaultTitle =
    knownInstances.find((i) => i.domain === defaultInstance)?.title ??
    defaultInstance;

  function openDialog() {
    setStep("input");
    setInputValue(defaultInstance ?? "");
    setResolved(null);
    setError("");
    setOpen(true);
  }

  /** One-click path: resolve a known instance and open it in a new tab. */
  async function quickInteract(instance: string) {
    // Open the tab synchronously (inside the click) so it survives popup blockers.
    const win = window.open("about:blank", "_blank");
    setQuickLoading(true);
    setError("");
    try {
      const r = await resolveInstance(instance, kind, target);
      remember({ domain: r.domain, title: r.title, software: r.software });
      if (win) {
        win.opener = null;
        win.location.href = r.interactionUrl;
      } else {
        window.open(r.interactionUrl, "_blank", "noopener,noreferrer");
      }
    } catch (err) {
      win?.close();
      setError(err instanceof Error ? err.message : "Instance lookup failed.");
      setStep("input");
      setInputValue(instance);
      setOpen(true);
    } finally {
      setQuickLoading(false);
    }
  }

  /** Dialog path: look up a typed instance and show its NodeInfo title first. */
  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    const value = inputValue.trim();
    if (!value) {
      setError("Enter an instance domain.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const r = await resolveInstance(value, kind, target);
      setResolved(r);
      setStep("confirm");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Instance lookup failed.");
    } finally {
      setLoading(false);
    }
  }

  function handleConfirm() {
    if (!resolved) return;
    remember({
      domain: resolved.domain,
      title: resolved.title,
      software: resolved.software,
    });
    window.open(resolved.interactionUrl, "_blank", "noopener,noreferrer");
    setOpen(false);
  }

  const showSplit =
    mounted && triggerVariant === "split" && !!defaultInstance && !trigger;

  const triggerEl = (() => {
    if (trigger && isValidElement(trigger)) {
      return cloneElement(
        trigger as React.ReactElement<{ onClick?: () => void }>,
        { onClick: openDialog },
      );
    }
    if (triggerVariant === "link") {
      return (
        <button
          type="button"
          onClick={openDialog}
          className={`text-xs text-muted-foreground hover:text-foreground hover:underline cursor-pointer ${className ?? ""}`}
        >
          {triggerLabel ?? cfg.idleLabel}
        </button>
      );
    }
    if (triggerVariant === "ghost") {
      return (
        <Button
          variant="ghost"
          size="sm"
          onClick={openDialog}
          className={`h-auto px-1.5 py-0.5 text-xs text-muted-foreground gap-1 ${className ?? ""}`}
        >
          {triggerLabel ?? cfg.idleLabel}
        </Button>
      );
    }
    if (!showSplit) {
      return (
        <Button
          variant="outline"
          size="sm"
          className={className}
          onClick={openDialog}
        >
          {triggerLabel ?? cfg.idleLabel}
        </Button>
      );
    }
    return (
      <div className={`inline-flex items-stretch ${className ?? ""}`}>
        <Button
          variant="outline"
          size="sm"
          className="rounded-r-none"
          disabled={quickLoading}
          onClick={() => quickInteract(defaultInstance!)}
        >
          {quickLoading && <Loader2 className="size-3.5 animate-spin" />}
          {cfg.verb} with {defaultTitle}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="icon-sm"
              className="rounded-l-none -ml-px"
              aria-label={`More ${cfg.verb.toLowerCase()} options`}
            >
              <EllipsisVertical />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-56">
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              {cfg.verb} from
            </DropdownMenuLabel>
            {knownInstances.map((inst) => (
              <DropdownMenuItem
                key={inst.domain}
                onSelect={() => quickInteract(inst.domain)}
              >
                <span className="truncate">{inst.title}</span>
                {inst.domain === defaultInstance && (
                  <Check className="ml-auto" />
                )}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={openDialog}>
              {cfg.verb} with another instance…
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  })();

  return (
    <>
      {triggerEl}
      <Dialog open={open} onOpenChange={(next) => !next && setOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{cfg.dialogTitle}</DialogTitle>
            <DialogDescription>{cfg.dialogDescription}</DialogDescription>
          </DialogHeader>

          {step === "input" ? (
            <div className="space-y-4">
              {knownInstances.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">
                    Your instances
                  </Label>
                  <ul className="space-y-1">
                    {knownInstances.map((inst) => (
                      <li
                        key={inst.domain}
                        className="flex items-center gap-1 rounded-md border px-2 py-1.5"
                      >
                        <button
                          type="button"
                          className="min-w-0 flex-1 text-left"
                          onClick={() => {
                            setOpen(false);
                            quickInteract(inst.domain);
                          }}
                        >
                          <span className="block truncate text-sm font-medium">
                            {inst.title}
                          </span>
                          {inst.title !== inst.domain && (
                            <span className="block truncate text-xs text-muted-foreground">
                              {inst.domain}
                            </span>
                          )}
                        </button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          aria-label={
                            inst.domain === defaultInstance
                              ? "Default instance"
                              : "Set as default instance"
                          }
                          onClick={() => setDefault(inst.domain)}
                        >
                          <Star
                            className={
                              inst.domain === defaultInstance
                                ? "fill-current"
                                : ""
                            }
                          />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          aria-label="Remove instance"
                          onClick={() => remove(inst.domain)}
                        >
                          <X />
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <form onSubmit={handleLookup} className="space-y-2">
                <Label htmlFor="remoteInstance">Instance domain</Label>
                <div className="flex gap-2">
                  <Input
                    id="remoteInstance"
                    placeholder="mastodon.social"
                    value={inputValue}
                    onChange={(e) => {
                      setInputValue(e.target.value);
                      if (error) setError("");
                    }}
                    disabled={loading}
                  />
                  <Button type="submit" disabled={loading}>
                    {loading ? "…" : "Continue"}
                  </Button>
                </div>
                {error && (
                  <p className="text-sm text-destructive">{error}</p>
                )}
              </form>
            </div>
          ) : resolved ? (
            <div className="space-y-4">
              <div className="rounded-md border p-3">
                <p className="font-medium">{resolved.title}</p>
                <p className="text-sm text-muted-foreground">
                  {resolved.domain}
                </p>
                {resolved.software && (
                  <Badge variant="outline" className="mt-2 capitalize">
                    {resolved.software}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                You'll be sent to <strong>{resolved.title}</strong> to confirm.
              </p>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setStep("input");
                    setResolved(null);
                  }}
                >
                  Back
                </Button>
                <Button onClick={handleConfirm}>
                  {cfg.verb} with this instance
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
