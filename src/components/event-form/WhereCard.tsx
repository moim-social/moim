import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "~/components/ui/card";
import { PlacePicker, type SelectedPlace } from "~/components/PlacePicker";

type WhereCardProps = {
  selectedPlace: SelectedPlace | null;
  onSelectedPlaceChange: (place: SelectedPlace | null) => void;
  groupActorId?: string;
};

export function WhereCard({
  selectedPlace,
  onSelectedPlaceChange,
  groupActorId,
}: WhereCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Where</CardTitle>
        <CardDescription>Add a location for your event.</CardDescription>
      </CardHeader>
      <CardContent>
        <PlacePicker
          value={selectedPlace}
          onChange={onSelectedPlaceChange}
          groupActorId={groupActorId}
        />
      </CardContent>
    </Card>
  );
}
