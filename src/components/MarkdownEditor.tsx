import { useState, useId } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "~/components/ui/tabs";
import { Textarea } from "~/components/ui/textarea";
import { Label } from "~/components/ui/label";
import { renderMarkdown } from "~/lib/markdown";

type MarkdownEditorProps = {
  id?: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
};

export function MarkdownEditor({
  id,
  label,
  value,
  onChange,
  placeholder = "Supports Markdown formatting...",
  rows = 6,
}: MarkdownEditorProps) {
  const fallbackId = useId();
  const inputId = id ?? fallbackId;
  const [activeTab, setActiveTab] = useState<string>("write");

  return (
    <div className="space-y-1.5">
      {label && <Label htmlFor={inputId}>{label}</Label>}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="write">Write</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
        </TabsList>
        <TabsContent value="write" className="mt-2">
          <Textarea
            id={inputId}
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={rows}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Markdown supported: **bold**, *italic*, [links](url), lists, headings
          </p>
        </TabsContent>
        <TabsContent value="preview" className="mt-2">
          <div className="min-h-[120px] rounded-md border px-3 py-2">
            {value.trim() ? (
              <div
                className="prose prose-sm max-w-none dark:prose-invert"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(value) }}
              />
            ) : (
              <p className="text-sm text-muted-foreground italic">
                Nothing to preview
              </p>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
