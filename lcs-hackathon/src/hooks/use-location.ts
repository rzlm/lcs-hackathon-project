import * as Location from 'expo-location';
import { useEffect, useState } from 'react';

export interface LocationCoords {
  latitude: number;
  longitude: number;
}

// Toronto City Hall — used when location permission is denied or unavailable
export const TORONTO_CENTER: LocationCoords = {
  latitude: 43.6532,
  longitude: -79.3832,
};

export function useLocation(): {
  location: LocationCoords;
  permissionDenied: boolean;
} {
  const [location, setLocation] = useState<LocationCoords>(TORONTO_CENTER);
  const [permissionDenied, setPermissionDenied] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (cancelled) return;

      if (status !== 'granted') {
        setPermissionDenied(true);
        return;
      }

      const coords = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      if (!cancelled) {
        setLocation({
          latitude: coords.coords.latitude,
          longitude: coords.coords.longitude,
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { location, permissionDenied };
}
