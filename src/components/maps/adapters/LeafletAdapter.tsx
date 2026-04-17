import { LeafletMap } from "~/components/LeafletMap";
import type { UserFacingMapProps } from "../types";

export function LeafletAdapter(props: UserFacingMapProps) {
  return <LeafletMap {...props} />;
}
