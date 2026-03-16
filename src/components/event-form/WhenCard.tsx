import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "~/components/ui/card";
import { Label } from "~/components/ui/label";
import { DateTimePicker } from "~/components/DateTimePicker";
import { TimezonePicker } from "~/components/TimezonePicker";

type WhenCardProps = {
  startsAt: string;
  onStartsAtChange: (value: string) => void;
  endsAt: string;
  onEndsAtChange: (value: string) => void;
  timezone: string | null;
  onTimezoneChange: (tz: string | null) => void;
};

export function WhenCard({
  startsAt,
  onStartsAtChange,
  endsAt,
  onEndsAtChange,
  timezone,
  onTimezoneChange,
}: WhenCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          When <span className="text-destructive">*</span>
        </CardTitle>
        <CardDescription>Set the event schedule.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Start</Label>
            <DateTimePicker
              value={startsAt}
              onChange={onStartsAtChange}
              placeholder="Start date & time"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>End (optional)</Label>
            <DateTimePicker
              value={endsAt}
              onChange={onEndsAtChange}
              placeholder="End date & time"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Timezone</Label>
          <TimezonePicker value={timezone} onChange={onTimezoneChange} />
        </div>
      </CardContent>
    </Card>
  );
}
