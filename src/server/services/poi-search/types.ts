export type PoiCandidate = {
  externalId: string;
  source: "kakao";
  name: string;
  address: string | null;
  roadAddress: string | null;
  lat: number;
  lng: number;
  categoryName: string | null;
  distanceMeters: number | null;
};

export type PoiSearchParams = {
  q: string;
  lat: number;
  lng: number;
  radius?: number;
};

export class PoiSearchError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "PoiSearchError";
  }
}
