import { useEffect, useMemo, useRef, useState } from 'react';
import { expandQuery } from '@/constants/keywords';
import { fetchShelters } from '@/services/shelters';
import type { Service, ServiceFilters } from '@/types/service';
import { haversineDistance } from '@/utils/distance';
import type { LocationCoords } from './use-location';

const API_BASE_URL = 'https://lcs2026-fastapi.onrender.com';

export type DataSource = 'supabase' | 'csv' | null;

// Module-level cache — persists across re-renders in the same session
let cachedServices: Service[] | null = null;
let cachedSource: DataSource = null;
let fetchStarted = false;

// Subscribers that want to be notified when the cache updates
const updateListeners = new Set<() => void>();

function notifyAll() {
  updateListeners.forEach((fn) => fn());
}

/**
 * Phase 1: fetch shelter list from Supabase (fast).
 * Phase 2: enrich with ML predictions in the background.
 * Components are notified after each phase so they render immediately
 * with base data, then update once ML scores arrive.
 */
function startFetch() {
  if (fetchStarted) return;
  fetchStarted = true;

  fetchShelters()
    .then(async ({ data, source: src }) => {
      // --- Phase 1: show shelters right away ---
      // Keep CSV fallback visibly offline/unknown so markers stay gray.
      cachedServices = data.map((s) => ({
        ...s,
        availability_score: src === 'csv' ? null : 0.5,
        availability_label: src === 'csv' ? null : ('unknown' as const),
        predicted_count: undefined,
      }));
      cachedSource = src;
      notifyAll();

      // --- Phase 2: enrich with live ML predictions ---
      // Skip this when we're already on the bundled offline fallback.
      if (src === 'csv') return;

      try {
        const controller = new AbortController();
        // 15 s — gives a warm Render server time to respond (~5 s observed)
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        const response = await fetch(`${API_BASE_URL}/forecast?sector=all`, {
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!response.ok) throw new Error('API offline');

        const liveData: { shelter_id: number | string; predicted_beds: number }[] =
          await response.json();

        if (Array.isArray(liveData)) {
          cachedServices = cachedServices!.map((s) => {
            const hit = liveData.find(
              (l) => s.external_id != null && Number(l.shelter_id) === s.external_id,
            );
            if (!hit) return s;
            const count = hit.predicted_beds;
            return {
              ...s,
              predicted_count: count,
              availability_score: count > 2 ? 1.0 : count > 0 ? 0.4 : 0.1,
              availability_label: (
                count > 2 ? 'available' : count > 0 ? 'limited' : 'full'
              ) as Service['availability_label'],
            };
          });
          notifyAll();
        }
      } catch {
        // ML unavailable — shelters already visible with neutral scores
        console.log('FastAPI unreachable: showing neutral availability.');
      }
    })
    .catch(() => {
      // Allow retry on next mount
      fetchStarted = false;
    });
}

export function useServices(
  filters: ServiceFilters,
  userLocation: LocationCoords,
): { services: Service[]; loading: boolean; error: string | null; source: DataSource } {
  const [allServices, setAllServices] = useState<Service[]>(cachedServices ?? []);
  const [loading, setLoading] = useState(cachedServices === null);
  const [error] = useState<string | null>(null);
  const [source, setSource] = useState<DataSource>(cachedSource);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    // Called by notifyAll() after each fetch phase
    const onCacheUpdate = () => {
      if (!mountedRef.current || !cachedServices) return;
      setAllServices([...cachedServices]);
      setSource(cachedSource);
      setLoading(false);
    };

    updateListeners.add(onCacheUpdate);

    if (cachedServices !== null) {
      // Cache already populated from a previous mount — use it immediately
      onCacheUpdate();
    } else {
      startFetch();
    }

    return () => { updateListeners.delete(onCacheUpdate); };
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
        (s) => s.availability_score !== null && s.availability_score !== 0.1,
      );
    }

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
