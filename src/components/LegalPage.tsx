import { renderMarkdown } from "~/lib/markdown";

export function LegalPage({ content }: { content: string }) {
  return (
    <div className="mx-auto max-w-3xl">
      <div
        className="prose prose-sm max-w-none dark:prose-invert"
        dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
      />
    </div>
  );
}
