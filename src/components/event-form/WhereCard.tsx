import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { PlacePicker, type SelectedPlace } from "~/components/PlacePicker";

type WhereCardProps = {
  selectedPlace: SelectedPlace | null;
  onSelectedPlaceChange: (place: SelectedPlace | null) => void;
  venueDetail: string;
  onVenueDetailChange: (value: string) => void;
  groupActorId?: string;
};

export function WhereCard({
  selectedPlace,
  onSelectedPlaceChange,
  venueDetail,
  onVenueDetailChange,
  groupActorId,
}: WhereCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Where</CardTitle>
        <CardDescription>Add a location for your event.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <PlacePicker
          value={selectedPlace}
          onChange={onSelectedPlaceChange}
          groupActorId={groupActorId}
        />
        <div className="space-y-1.5">
          <Label htmlFor="venueDetail">Venue detail (optional)</Label>
          <Input
            id="venueDetail"
            type="text"
            placeholder="e.g. 3F, Room 301"
            value={venueDetail}
            onChange={(e) => onVenueDetailChange(e.target.value)}
          />
        </div>
      </CardContent>
    </Card>
  );
}
