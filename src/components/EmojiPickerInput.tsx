import { useEffect, useRef, useState } from "react";
import { EmojiPicker } from "frimousse";
import { SmilePlus } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";

type EmojiPickerInputProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

export function EmojiPickerInput({
  id,
  value,
  onChange,
  placeholder = "Pick an emoji",
}: EmojiPickerInputProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <div className="flex items-center gap-2">
        <Input
          id={id}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
        <Button
          type="button"
          variant="outline"
          className="shrink-0"
          onClick={() => setOpen((current) => !current)}
          aria-expanded={open}
          aria-label="Open emoji picker"
        >
          {value || <SmilePlus className="size-4" />}
        </Button>
      </div>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[20rem] overflow-hidden rounded-md border bg-background shadow-lg">
          <EmojiPicker.Root
            columns={8}
            onEmojiSelect={({ emoji }) => {
              onChange(emoji);
              setOpen(false);
            }}
            className="flex flex-col"
          >
            <div className="border-b p-2">
              <EmojiPicker.Search
                placeholder="Search emoji..."
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none"
              />
            </div>
            <div className="flex items-center justify-between border-b px-3 py-2 text-xs text-muted-foreground">
              <EmojiPicker.ActiveEmoji>
                {({ emoji }) => (
                  <span>
                    {emoji ? `${emoji.emoji} ${emoji.label}` : "Select an emoji"}
                  </span>
                )}
              </EmojiPicker.ActiveEmoji>
              <EmojiPicker.SkinToneSelector
                className="rounded-md border px-2 py-1 text-sm hover:bg-accent"
                aria-label="Change skin tone"
              />
            </div>
            <EmojiPicker.Viewport
              className="overflow-y-auto p-2"
              style={{ height: "20rem", maxHeight: "20rem" }}
              onWheel={(event) => {
                event.stopPropagation();
                event.currentTarget.scrollTop += event.deltaY;
              }}
            >
              <EmojiPicker.Loading>
                <div className="px-2 py-3 text-sm text-muted-foreground">Loading…</div>
              </EmojiPicker.Loading>
              <EmojiPicker.Empty>
                {({ search }) => (
                  <div className="px-2 py-3 text-sm text-muted-foreground">
                    No emoji found{search ? ` for "${search}"` : ""}.
                  </div>
                )}
              </EmojiPicker.Empty>
              <EmojiPicker.List
                components={{
                  CategoryHeader: ({ category, ...props }) => (
                    <div
                      {...props}
                      className="bg-background px-2 py-1 text-xs font-medium text-muted-foreground"
                    >
                      {category.label}
                    </div>
                  ),
                  Row: ({ children, ...props }) => (
                    <div {...props} className="flex gap-1 px-1 py-0.5">
                      {children}
                    </div>
                  ),
                  Emoji: ({ emoji, ...props }) => (
                    <button
                      {...props}
                      type="button"
                      className={`flex size-9 items-center justify-center rounded-md text-lg ${
                        emoji.isActive ? "bg-accent" : "hover:bg-accent/60"
                      }`}
                    >
                      {emoji.emoji}
                    </button>
                  ),
                }}
              />
            </EmojiPicker.Viewport>
          </EmojiPicker.Root>
        </div>
      )}
    </div>
  );
}
