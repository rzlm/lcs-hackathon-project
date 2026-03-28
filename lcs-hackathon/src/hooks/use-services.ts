import { useMemo } from 'react';

import { expandQuery } from '@/constants/keywords';
import type { Service, ServiceFilters } from '@/types/service';
import { haversineDistance } from '@/utils/distance';

import type { LocationCoords } from './use-location';

// ─── Mock data ────────────────────────────────────────────────────────────────
// Replace with SQLite query via expo-sqlite once DB is wired up.

const MOCK_SERVICES: Service[] = [
  {
    id: '1',
    name: 'Seaton House',
    type: 'shelter',
    description: "Toronto's largest men's shelter with meals, medical, and referral services.",
    latitude: 43.6601,
    longitude: -79.3718,
    address_street: '339 George Street',
    phone: '+14163925000',
    website: null,
    hours_json: null,
    is_24_hours: true,
    wheelchair_accessible: true,
    no_stairs: true,
    serves_men: true,
    serves_women: false,
    serves_youth: false,
    serves_families: false,
    availability_score: 0.65,
    availability_label: 'available',
    last_availability_at: Math.floor(Date.now() / 1000) - 3600,
    is_bookmarked: false,
  },
  {
    id: '2',
    name: "Margaret's Place",
    type: 'shelter',
    description: 'Emergency shelter and transitional housing for women and families.',
    latitude: 43.6559,
    longitude: -79.3807,
    address_street: '80 Cooperage St',
    phone: '+14169259490',
    website: null,
    hours_json: null,
    is_24_hours: true,
    wheelchair_accessible: true,
    no_stairs: false,
    serves_men: false,
    serves_women: true,
    serves_youth: false,
    serves_families: true,
    availability_score: 0.15,
    availability_label: 'full',
    last_availability_at: Math.floor(Date.now() / 1000) - 1800,
    is_bookmarked: false,
  },
  {
    id: '3',
    name: 'The Stop Community Food Centre',
    type: 'food',
    description: 'Hot meals, food bank, community kitchen, and drop-in programs.',
    latitude: 43.6664,
    longitude: -79.4449,
    address_street: '1884 Davenport Road',
    phone: '+14165520320',
    website: null,
    hours_json: null,
    is_24_hours: false,
    wheelchair_accessible: true,
    no_stairs: true,
    serves_men: true,
    serves_women: true,
    serves_youth: true,
    serves_families: true,
    availability_score: 0.8,
    availability_label: 'available',
    last_availability_at: Math.floor(Date.now() / 1000) - 7200,
    is_bookmarked: true,
  },
  {
    id: '4',
    name: 'Regent Park Community Health Centre',
    type: 'clinic',
    description: 'Free primary care, mental health, and dental services. No OHIP required.',
    latitude: 43.6606,
    longitude: -79.3600,
    address_street: '465 Dundas Street East',
    phone: '+14163607011',
    website: null,
    hours_json: null,
    is_24_hours: false,
    wheelchair_accessible: true,
    no_stairs: true,
    serves_men: true,
    serves_women: true,
    serves_youth: true,
    serves_families: true,
    availability_score: 0.4,
    availability_label: 'limited',
    last_availability_at: Math.floor(Date.now() / 1000) - 5400,
    is_bookmarked: false,
  },
  {
    id: '5',
    name: 'Toronto Reference Library',
    type: 'library',
    description: 'Free WiFi, charging stations, computers, and washrooms. Warm and safe.',
    latitude: 43.6717,
    longitude: -79.3867,
    address_street: '789 Yonge Street',
    phone: '+14163953424',
    website: null,
    hours_json: null,
    is_24_hours: false,
    wheelchair_accessible: true,
    no_stairs: true,
    serves_men: true,
    serves_women: true,
    serves_youth: true,
    serves_families: true,
    availability_score: 0.9,
    availability_label: 'available',
    last_availability_at: Math.floor(Date.now() / 1000) - 900,
    is_bookmarked: false,
  },
  {
    id: '6',
    name: 'Moss Park Warming Centre',
    type: 'warming_centre',
    description: 'Seasonal warming centre open when temperature drops below -15°C.',
    latitude: 43.6543,
    longitude: -79.3683,
    address_street: '10 Queen Street East',
    phone: null,
    website: null,
    hours_json: null,
    is_24_hours: true,
    wheelchair_accessible: false,
    no_stairs: false,
    serves_men: true,
    serves_women: true,
    serves_youth: false,
    serves_families: false,
    availability_score: null,
    availability_label: null,
    last_availability_at: null,
    is_bookmarked: false,
  },
  {
    id: '7',
    name: 'Fred Victor Centre',
    type: 'drop_in',
    description: 'Drop-in services, meals, showers, laundry, and social support.',
    latitude: 43.6549,
    longitude: -79.3712,
    address_street: '145 Queen Street East',
    phone: '+14165031105',
    website: null,
    hours_json: null,
    is_24_hours: false,
    wheelchair_accessible: true,
    no_stairs: true,
    serves_men: true,
    serves_women: true,
    serves_youth: true,
    serves_families: false,
    availability_score: 0.55,
    availability_label: 'available',
    last_availability_at: Math.floor(Date.now() / 1000) - 2700,
    is_bookmarked: false,
  },
];

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useServices(
  filters: ServiceFilters,
  userLocation: LocationCoords,
): { services: Service[] } {
  const services = useMemo(() => {
    let result = MOCK_SERVICES.map((s) => ({
      ...s,
      distance_m: haversineDistance(
        userLocation.latitude,
        userLocation.longitude,
        s.latitude,
        s.longitude,
      ),
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
        filters.populations.every((p) => {
          if (p === 'men') return s.serves_men;
          if (p === 'women') return s.serves_women;
          if (p === 'youth') return s.serves_youth;
          if (p === 'families') return s.serves_families;
          return true;
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

    return result.sort((a, b) => (a.distance_m ?? 0) - (b.distance_m ?? 0));
  }, [filters, userLocation]);

  return { services };
}
