import type { ReactElement } from "react";
import type { UserFacingMapProps } from "../types";

export function GoogleAdapter(_props: UserFacingMapProps): ReactElement {
  throw new Error(
    "GoogleAdapter is not implemented yet. Set MAP_PROVIDER to 'osm' or 'kakao'.",
  );
}
