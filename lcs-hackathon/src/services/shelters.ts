import { CSV_SHELTERS } from '@/data/shelters-csv';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import type { AvailabilityLabel, Service } from '@/types/service';

// Shape of a row returned from the Supabase shelters table
type DbShelter = {
  id: string;
  name: string;
  organization_name: string;
  description: string | null;
  latitude: number | null;
  longitude: number | null;
  address_street: string | null;
  phone: string | null;
  website: string | null;
  hours_json: Record<string, string> | null;
  is_24_hours: boolean;
  wheelchair_accessible: boolean;
  no_stairs: boolean;
  serves_men: boolean;
  serves_women: boolean;
  serves_youth: boolean;
  serves_families: boolean;
  availability_score: number | null;
  availability_label: AvailabilityLabel | null;
  last_availability_at: string | null;
};

function mapDbRow(row: DbShelter): Service {
  return {
    id: row.id,
    name: row.name,
    type: 'shelter',
    description: row.description ?? (row.organization_name !== row.name ? `Operated by ${row.organization_name}` : null),
    latitude: row.latitude,
    longitude: row.longitude,
    address_street: row.address_street,
    phone: row.phone,
    website: row.website,
    hours_json: row.hours_json ? JSON.stringify(row.hours_json) : null,
    is_24_hours: row.is_24_hours,
    wheelchair_accessible: row.wheelchair_accessible,
    no_stairs: row.no_stairs,
    serves_men: row.serves_men,
    serves_women: row.serves_women,
    serves_youth: row.serves_youth,
    serves_families: row.serves_families,
    availability_score: row.availability_score,
    availability_label: row.availability_label,
    last_availability_at: row.last_availability_at
      ? Math.floor(new Date(row.last_availability_at).getTime() / 1000)
      : null,
    is_bookmarked: false,
  };
}

/**
 * Fetches shelters from Supabase.
 * Falls back to the static CSV snapshot if Supabase is not configured or the
 * request fails (e.g. device is offline).
 *
 * Sections that require the DB (reviews, live availability) are intentionally
 * left blank when falling back — callers should handle null availability_score.
 */
export async function fetchShelters(): Promise<{ data: Service[]; source: 'supabase' | 'csv' }> {
  if (!isSupabaseConfigured) {
    return { data: CSV_SHELTERS, source: 'csv' };
  }

  try {
    const { data, error } = await getSupabase()
      .from('shelters')
      .select(
        'id, name, organization_name, description, latitude, longitude, ' +
        'address_street, phone, website, hours_json, is_24_hours, ' +
        'wheelchair_accessible, no_stairs, ' +
        'serves_men, serves_women, serves_youth, serves_families, ' +
        'availability_score, availability_label, last_availability_at',
      )
      .eq('is_active', true)
      .order('name');

    if (error) throw error;

    return { data: (data as unknown as DbShelter[]).map(mapDbRow), source: 'supabase' };
  } catch {
    // Network error or Supabase unavailable — fall back to bundled CSV data
    return { data: CSV_SHELTERS, source: 'csv' };
  }
}
