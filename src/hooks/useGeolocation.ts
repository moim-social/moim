import { useEffect, useState } from "react";

type GeolocationState = {
  location: { lat: number; lng: number } | null;
  loading: boolean;
  denied: boolean;
};

export function useGeolocation(): GeolocationState {
  const [state, setState] = useState<GeolocationState>({
    location: null,
    loading: true,
    denied: false,
  });

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState({ location: null, loading: false, denied: false });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setState({
          location: { lat: pos.coords.latitude, lng: pos.coords.longitude },
          loading: false,
          denied: false,
        });
      },
      () => {
        setState({ location: null, loading: false, denied: true });
      },
      { enableHighAccuracy: false, timeout: 5000 },
    );
  }, []);

  return state;
}
