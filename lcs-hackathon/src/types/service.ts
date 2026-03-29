export type ServiceType =
  | 'shelter'
  | 'food'
  | 'clinic'
  | 'library'
  | 'wifi'
  | 'hygiene'
  | 'warming_centre'
  | 'cooling_centre'
  | 'restroom'
  | 'drop_in';

export type AvailabilityLabel = 'available' | 'limited' | 'full' | 'unknown';
export type MarkerColor = 'green' | 'yellow' | 'red' | 'gray';
export type PopulationFilter = 'men' | 'women' | 'youth' | 'families';
export type AccessibilityFilter = 'wheelchair' | 'no_stairs';

export interface Service {
  id: string;
  name: string;
  type: ServiceType;
  description: string | null;
  latitude: number | null;
  longitude: number | null;
  address_street: string | null;
  phone: string | null;
  website: string | null;
  hours_json: string | null;
  is_24_hours: boolean;
  wheelchair_accessible: boolean;
  no_stairs: boolean;
  serves_men: boolean;
  serves_women: boolean;
  serves_youth: boolean;
  serves_families: boolean;
  availability_score: number | null;
  availability_label: AvailabilityLabel | null;
  last_availability_at: number | null;
  is_bookmarked: boolean;
  distance_m?: number;
}

export interface ServiceFilters {
  query: string;
  types: ServiceType[];
  populations: PopulationFilter[];
  accessibility: AccessibilityFilter[];
  openNow: boolean;
  hasAvailability: boolean;
}

export const EMPTY_FILTERS: ServiceFilters = {
  query: '',
  types: [],
  populations: [],
  accessibility: [],
  openNow: false,
  hasAvailability: false,
};
