import { ExternalLinkIcon } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "~/components/ui/card";
import { Input } from "~/components/ui/input";

type ExternalUrlCardProps = {
  externalUrl: string;
  onExternalUrlChange: (url: string) => void;
};

export function ExternalUrlCard({
  externalUrl,
  onExternalUrlChange,
}: ExternalUrlCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ExternalLinkIcon className="size-4" />
          External Registration
          <span className="text-muted-foreground text-sm font-normal">(optional)</span>
        </CardTitle>
        <CardDescription>
          Redirect attendees to an external service instead of the built-in RSVP.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Input
          id="externalUrl"
          type="url"
          placeholder="https://eventbrite.com/e/..."
          value={externalUrl}
          onChange={(e) => onExternalUrlChange(e.target.value)}
        />
      </CardContent>
    </Card>
  );
}
