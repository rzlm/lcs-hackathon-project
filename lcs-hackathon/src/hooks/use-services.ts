import { useEffect, useMemo, useRef, useState } from 'react';

import { expandQuery } from '@/constants/keywords';
import { fetchShelters } from '@/services/shelters';
import type { Service, ServiceFilters } from '@/types/service';
import { haversineDistance } from '@/utils/distance';

import type { LocationCoords } from './use-location';

// Live FastAPI prediction endpoint (optional — app works without it)
const API_BASE_URL = 'https://lcs2026-fastapi.onrender.com';

export type DataSource = 'supabase' | 'csv' | null;

export function useServices(
  filters: ServiceFilters,
  userLocation: LocationCoords,
): { services: Service[]; loading: boolean; error: string | null; source: DataSource } {
  const [allServices, setAllServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<DataSource>(null);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    fetchShelters()
      .then(async ({ data, source: src }) => {
        // Overlay FastAPI forecast predictions on top of base data
        try {
          const response = await fetch(`${API_BASE_URL}/forecast?sector=all`);
          const liveData = await response.json();

          if (Array.isArray(liveData)) {
            const merged = data.map((s) => {
              const liveInfo = liveData.find(
                (l: { shelter_id: number | string; predicted_beds: number }) =>
                  String(l.shelter_id) === s.id || String(l.shelter_id) === s.id.replace('csv-', ''),
              );
              if (liveInfo) {
                const count = liveInfo.predicted_beds;
                return {
                  ...s,
                  availability_score: count > 2 ? 1.0 : count > 0 ? 0.4 : 0.1,
                  availability_label: (count > 2 ? 'available' : count > 0 ? 'limited' : 'full') as Service['availability_label'],
                };
              }
              return s;
            });
            setAllServices(merged);
          } else {
            setAllServices(data);
          }
        } catch {
          // FastAPI not reachable — use base data as-is
          setAllServices(data);
        }

        setSource(src);
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const services = useMemo(() => {
    let result = allServices.map((s) => ({
      ...s,
      distance_m:
        s.latitude != null && s.longitude != null
          ? haversineDistance(userLocation.latitude, userLocation.longitude, s.latitude, s.longitude)
          : undefined,
    }));

    if (filters.query.trim()) {
      const terms = expandQuery(filters.query);
      result = result.filter((s) => {
        const haystack = `${s.name} ${s.description ?? ''} ${s.type}`.toLowerCase();
        return terms.some((t) => haystack.includes(t));
      });
    }

    if (filters.types.length > 0) {
      result = result.filter((s) => filters.types.includes(s.type));
    }

    if (filters.populations.length > 0) {
      result = result.filter((s) =>
        filters.populations.some((p) => {
          const key = p.toLowerCase();
          if (key === 'mixed adult') return s.serves_men && s.serves_women && !s.serves_youth && !s.serves_families;
          if (key === 'men') return s.serves_men;
          if (key === 'women') return s.serves_women;
          if (key === 'youth') return s.serves_youth;
          if (key === 'families') return s.serves_families;
          return false;
        }),
      );
    }

    if (filters.accessibility.length > 0) {
      result = result.filter((s) =>
        filters.accessibility.every((a) => {
          if (a === 'wheelchair') return s.wheelchair_accessible;
          if (a === 'no_stairs') return s.no_stairs;
          return true;
        }),
      );
    }

    if (filters.hasAvailability) {
      result = result.filter(
        (s) => s.availability_score !== null && s.availability_score >= 0.2,
      );
    }

    // Sort by availability first, then distance
    return result.sort((a, b) => {
      const scoreDiff = (b.availability_score ?? 0) - (a.availability_score ?? 0);
      if (scoreDiff !== 0) return scoreDiff;
      if (a.distance_m == null && b.distance_m == null) return 0;
      if (a.distance_m == null) return 1;
      if (b.distance_m == null) return -1;
      return a.distance_m - b.distance_m;
    });
  }, [allServices, filters, userLocation]);

  return { services, loading, error, source };
}
