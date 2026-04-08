import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Megaphone } from "lucide-react";
import { Trans } from "@lingui/react";
import { renderMarkdownOrHtml } from "~/lib/markdown";

type NoticeProps = {
  id: string;
  content: string;
  createdAt: string;
};

export function NoticesCard({ notices }: { notices: NoticeProps[] }) {
  const [expanded, setExpanded] = useState(false);
  const recent = notices.slice(0, 3);
  const hasMore = notices.length > 3;

  return (
    <Card className="rounded-lg gap-2">
      <CardHeader className="pb-0 pt-3 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Megaphone className="size-4 text-muted-foreground" />
            <CardTitle className="text-xs font-bold uppercase tracking-wide text-[#333]">
              <Trans id="Notices" message="Notices" />
            </CardTitle>
          </div>
          {hasMore && (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {expanded ? (
                <Trans id="Show less" message="Show less" />
              ) : (
                <Trans id="notices.showAll" message="Show all ({count})" values={{ count: notices.length }} />
              )}
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0 pb-2 px-4">
        <div className="divide-y">
          {recent.map((notice) => (
            <NoticeItem key={notice.id} notice={notice} />
          ))}
          {expanded && notices.slice(3).map((notice) => (
            <NoticeItem key={notice.id} notice={notice} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function NoticeItem({ notice }: { notice: NoticeProps }) {
  return (
    <div className="flex items-start gap-2 text-sm py-1.5">
      <span className="shrink-0 text-xs text-muted-foreground/60 leading-5">
        {new Date(notice.createdAt).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        })}
      </span>
      <div
        className="min-w-0 prose prose-sm max-w-none dark:prose-invert text-muted-foreground [&>p]:m-0 [&>p+p]:mt-0.5 [&>small]:text-xs"
        dangerouslySetInnerHTML={{ __html: renderMarkdownOrHtml(notice.content) }}
      />
    </div>
  );
}
