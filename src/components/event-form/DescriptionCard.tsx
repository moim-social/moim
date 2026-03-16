import { useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardAction, CardContent } from "~/components/ui/card";
import { Textarea } from "~/components/ui/textarea";
import { Button } from "~/components/ui/button";
import { PencilIcon, EyeIcon } from "lucide-react";
import { renderMarkdown } from "~/lib/markdown";
import { cn } from "~/lib/utils";

type DescriptionCardProps = {
  description: string;
  onDescriptionChange: (value: string) => void;
};

export function DescriptionCard({
  description,
  onDescriptionChange,
}: DescriptionCardProps) {
  const [mode, setMode] = useState<"write" | "preview">("write");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Description</CardTitle>
        <CardDescription>Tell attendees what this event is about. Markdown supported.</CardDescription>
        <CardAction>
          <div className="flex items-center rounded-md border bg-muted/50 p-0.5">
            <Button
              type="button"
              variant={mode === "write" ? "secondary" : "ghost"}
              size="xs"
              onClick={() => setMode("write")}
              className={cn(
                "gap-1",
                mode !== "write" && "text-muted-foreground",
              )}
            >
              <PencilIcon className="size-3" />
              Write
            </Button>
            <Button
              type="button"
              variant={mode === "preview" ? "secondary" : "ghost"}
              size="xs"
              onClick={() => setMode("preview")}
              className={cn(
                "gap-1",
                mode !== "preview" && "text-muted-foreground",
              )}
            >
              <EyeIcon className="size-3" />
              Preview
            </Button>
          </div>
        </CardAction>
      </CardHeader>
      <CardContent>
        {mode === "write" ? (
          <div className="space-y-2">
            <Textarea
              id="description"
              placeholder="Describe your event — agenda, what to expect, what to bring..."
              value={description}
              onChange={(e) => onDescriptionChange(e.target.value)}
              rows={8}
            />
            <p className="text-xs text-muted-foreground">
              **bold** &middot; *italic* &middot; [link](url) &middot; # heading &middot; - list
            </p>
          </div>
        ) : (
          <div className="min-h-[180px] rounded-md border px-3 py-2">
            {description.trim() ? (
              <div
                className="prose prose-sm max-w-none dark:prose-invert"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(description) }}
              />
            ) : (
              <p className="text-sm text-muted-foreground italic">
                Nothing to preview yet. Switch to Write to add a description.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
