# Data Sources Reference

> All primary data for this app comes from Toronto Open Data. This document covers every data source we use: the API endpoints, field mappings, update frequency, normalization steps, and what to do when the data is unavailable.

---

## Table of Contents

1. [Toronto Open Data Overview](#toronto-open-data-overview)
2. [Daily Shelter & Overnight Service Occupancy](#1-daily-shelter--overnight-service-occupancy--capacity)
3. [Warming Centres](#2-warming-centres)
4. [Cooling Centres](#3-cooling-centres)
5. [Drop-In Directory](#4-drop-in-directory)
6. [Toronto Public Library Branches (Wi-Fi)](#5-toronto-public-library-branches-wi-fi)
7. [Weather Data (Open-Meteo)](#6-weather-data-open-meteo)
8. [Postal Code Geocoding](#7-postal-code-geocoding)
9. [Handling Downtime and Stale Data](#handling-downtime-and-stale-data)
10. [Data Normalization Reference](#data-normalization-reference)

---

## Toronto Open Data Overview

**Base URL for the CKAN API:** `https://ckan0.cf.opendata.inter.prod-toronto.ca/api/3/action/`

**API format:** All endpoints return JSON with the structure:
```json
{
  "success": true,
  "result": {
    "records": [...],
    "total": 123,
    "resource_id": "...",
    "_links": { "next": "..." }
  }
}
```

**Authentication:** None required. Public API. No API key.

**Pagination:** Use `?limit=500&offset=0` parameters. The default limit is 100. Most Toronto datasets have fewer than 500 records, so a single request with `limit=500` should get everything.

**Rate limits:** Undocumented but observed. Do not hit the API more than once per minute per endpoint. Our 30-minute cron interval is well within safe limits.

**CORS:** The API supports CORS for browser requests. It can be called from Supabase Edge Functions (server-side) without CORS issues.

---

## 1. Daily Shelter & Overnight Service Occupancy & Capacity

**This is the most important data source.** It provides real-time (hourly) occupancy data for all city-administered and city-funded shelters in Toronto.

### Endpoint

```
GET https://ckan0.cf.opendata.inter.prod-toronto.ca/api/3/action/datastore_search
  ?resource_id=21c83b32-d5a8-4106-a54f-010dbe82f3c6
  &limit=500
```

**Dataset page:** https://open.toronto.ca/dataset/daily-shelter-overnight-service-occupancy-capacity/

**Update frequency:** Approximately every hour during operating hours (roughly 6 AM – midnight). Can lag by 1–2 hours.

### Sample Response Record

```json
{
  "_id": 12345,
  "OCCUPANCY_DATE": "2026-03-28T00:00:00",
  "ORGANIZATION_NAME": "City of Toronto",
  "SHELTER_NAME": "Seaton House",
  "SHELTER_ADDRESS": "339 George Street",
  "SHELTER_CITY": "Toronto",
  "SHELTER_PROVINCE": "ON",
  "SHELTER_POSTAL_CODE": "M5A 2N3",
  "FACILITY_NAME": "Seaton House - Men's Residence",
  "PROGRAM_NAME": "Men's Dorm",
  "SECTOR": "Men",
  "PROGRAM_MODEL": "Emergency",
  "OVERNIGHT_SERVICE_TYPE": "Emergency Shelter",
  "PROGRAM_AREA": "Shelter",
  "CAPACITY_TYPE": "Bed Based Capacity",
  "CAPACITY_ACTUAL_BED": 450,
  "CAPACITY_FUNDING_BED": 450,
  "OCCUPIED_BEDS": 387,
  "UNOCCUPIED_BEDS": 63,
  "UNAVAILABLE_BEDS": 12,
  "OCCUPANCY_RATE_BEDS": 86.0,
  "CAPACITY_ACTUAL_ROOM": 0,
  "CAPACITY_FUNDING_ROOM": 0,
  "OCCUPIED_ROOMS": 0,
  "UNOCCUPIED_ROOMS": 0,
  "UNAVAILABLE_ROOMS": 0,
  "OCCUPANCY_RATE_ROOMS": 0
}
```

### Key Fields and Mapping

| API Field | Local Field | Type | Notes |
|-----------|-------------|------|-------|
| `SHELTER_NAME` | `name` | TEXT | Display name |
| `SHELTER_ADDRESS` + `SHELTER_CITY` | `address_street`, `address_city` | TEXT | Combine for full address |
| `SHELTER_POSTAL_CODE` | `postal_code` | TEXT | Use for geocoding if lat/lng missing |
| `SECTOR` | `serves_men`, `serves_women`, `serves_youth`, `serves_families` | BOOL | See mapping table below |
| `OVERNIGHT_SERVICE_TYPE` | `type` | TEXT | Map to our enum |
| `CAPACITY_ACTUAL_BED` | `total_capacity` | INT | Use bed-based unless 0 |
| `OCCUPIED_BEDS` | `current_occupancy` | INT | |
| `UNOCCUPIED_BEDS` | `available_count` | INT | |
| `OCCUPANCY_RATE_BEDS` | `occupancy_pct` | REAL | Divide by 100 to get 0–1 |

**Note:** This dataset does NOT include lat/lng coordinates. You must geocode from the address. For hackathon, pre-build a lookup table of shelter addresses to coordinates (one-time geocoding run).

### SECTOR → Population Flag Mapping

| API value | serves_men | serves_women | serves_youth | serves_families |
|-----------|-----------|--------------|--------------|-----------------|
| "Men" | true | false | false | false |
| "Women" | false | true | false | false |
| "Youth" | false | false | true | false |
| "Co-ed" | true | true | false | false |
| "Family" | true | true | false | true |
| "Mixed Adult" | true | true | false | false |

### OVERNIGHT_SERVICE_TYPE → type Mapping

| API value | Our `type` |
|-----------|------------|
| "Emergency Shelter" | shelter |
| "Transitional Housing" | shelter |
| "Isolation/Recovery Site" | shelter |
| "Motel/Hotel" | shelter |
| "24-Hour Respite Site" | drop_in |
| "Warming Centre" | warming_centre |
| "Overnight Service" | shelter |

### How to Fetch and Store

```typescript
// supabase/functions/ingest-shelters/index.ts

const SHELTER_RESOURCE_ID = '21c83b32-d5a8-4106-a54f-010dbe82f3c6';
const API_BASE = 'https://ckan0.cf.opendata.inter.prod-toronto.ca/api/3/action';

async function fetchShelterData(): Promise<RawShelterRecord[]> {
  const url = `${API_BASE}/datastore_search?resource_id=${SHELTER_RESOURCE_ID}&limit=500`;
  const response = await fetch(url, {
    headers: { 'User-Agent': 'LCS-Hackathon-HomelessServices/1.0' }
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }

  const json = await response.json();
  if (!json.success) {
    throw new Error(`API returned success=false: ${JSON.stringify(json.error)}`);
  }

  return json.result.records;
}

function normalizeShelterRecord(raw: RawShelterRecord): NormalizedService {
  return {
    external_id: `toronto_shelter_${raw._id}`,
    name: raw.SHELTER_NAME,
    type: mapServiceType(raw.OVERNIGHT_SERVICE_TYPE),
    address_street: raw.SHELTER_ADDRESS,
    address_city: raw.SHELTER_CITY || 'Toronto',
    postal_code: raw.SHELTER_POSTAL_CODE?.trim(),
    // lat/lng: look up from pre-geocoded table
    latitude: SHELTER_GEOCODE_TABLE[raw.SHELTER_ADDRESS]?.lat ?? null,
    longitude: SHELTER_GEOCODE_TABLE[raw.SHELTER_ADDRESS]?.lng ?? null,
    serves_men: raw.SECTOR === 'Men' || raw.SECTOR === 'Co-ed' || raw.SECTOR === 'Mixed Adult',
    serves_women: raw.SECTOR === 'Women' || raw.SECTOR === 'Co-ed' || raw.SECTOR === 'Family',
    serves_youth: raw.SECTOR === 'Youth',
    serves_families: raw.SECTOR === 'Family',
    data_source: 'toronto_open_data',
  };
}

function normalizeAvailability(raw: RawShelterRecord, serviceId: string): AvailabilityReport {
  const total = raw.CAPACITY_ACTUAL_BED || raw.CAPACITY_ACTUAL_ROOM || 0;
  const occupied = raw.OCCUPIED_BEDS || raw.OCCUPIED_ROOMS || 0;
  const available = raw.UNOCCUPIED_BEDS || raw.UNOCCUPIED_ROOMS || 0;
  const pct = (raw.OCCUPANCY_RATE_BEDS || raw.OCCUPANCY_RATE_ROOMS || 0) / 100;

  return {
    service_id: serviceId,
    total_capacity: total,
    current_occupancy: occupied,
    available_count: available,
    occupancy_pct: pct,
    source: 'toronto_open_data',
    confidence: 0.95,
    reported_at: new Date(raw.OCCUPANCY_DATE).toISOString(),
    raw_data: raw,
  };
}
```

### Reliability Notes

- The API is generally reliable during business hours (8 AM – 8 PM).
- Overnight (midnight – 6 AM), the data often does not update — this is expected. Show "data from [time]" rather than implying it's stale.
- On occasion, the total Toronto Open Data portal goes down for maintenance. Typically < 1 hour.
- Some shelters submit their occupancy manually and are consistently behind. Don't assume all records are up-to-the-minute even when the API is available.
- Some records have `OCCUPANCY_RATE_BEDS = 0` with `OCCUPIED_BEDS > 0` — this is a data quality issue. Recompute the rate if needed: `pct = occupied / total`.

---

## 2. Warming Centres

Warming centres are additional locations the city opens during extreme cold (typically below -15°C with wind chill, or during overnight cold alerts).

### Endpoint

```
GET https://ckan0.cf.opendata.inter.prod-toronto.ca/api/3/action/datastore_search
  ?resource_id=21c83b32-d5a8-4106-a54f-010dbe82f3c6
  &filters={"OVERNIGHT_SERVICE_TYPE": "Warming Centre"}
  &limit=100
```

**Alternative approach:** The warming centres often appear in the same daily shelter dataset, just filtered by type. Check if the existing shelter endpoint includes warming centres before adding a separate dataset.

**Dedicated dataset (may also exist):**
https://open.toronto.ca/dataset/warming-centres/

**Dataset page:** Check this URL at hackathon time — the dataset ID changes between years.

### Seasonal Notes

- Warming centres typically activate in November and deactivate in April.
- Their hours change dynamically based on weather alerts. Do not assume fixed hours.
- When a warming alert is issued by the city, new centres may open with < 24 hours notice. The daily sync cadence (every 30 minutes) should catch these.

### Fields

Similar to the shelter dataset. Key additions:
- `HOURS_OF_OPERATION`: Free-text hours string — requires parsing
- `ACCESSIBLE`: Boolean string ("Yes"/"No")
- `PHONE`: Contact phone number (often a city info line)

### How to Store

Insert as `type = 'warming_centre'` in the `services` table. Set `is_seasonal = true`, `season_start_month = 11`, `season_end_month = 4`.

When the city issues a cold weather alert:
- Warming centres with `is_active = false` get updated to `is_active = true` in the next ingestion run
- The availability_score for warming centres during alerts defaults to 0.6 (limited) since they can fill quickly

---

## 3. Cooling Centres

Active June–September, specifically during heat alerts (above 31°C humidex or 35°C environment).

### Endpoint

```
GET https://ckan0.cf.opendata.inter.prod-toronto.ca/api/3/action/datastore_search
  ?resource_id={cooling_centres_resource_id}
  &limit=200
```

**Dataset page:** https://open.toronto.ca/dataset/cooling-centres/

The resource ID for cooling centres changes each season. At hackathon time, navigate to the dataset page and look for the current year's resource ID in the URL.

### Sample Fields

```json
{
  "Location Name": "Agincourt Recreation Centre",
  "Address": "31 Glen Watford Dr",
  "City": "Toronto",
  "Postal Code": "M1S 2B3",
  "Phone": "416-396-4284",
  "Hours of Operation": "Mon-Fri: 9am-10pm, Sat-Sun: 9am-5pm",
  "Accessible": "Yes",
  "Notes": "Air-conditioned areas include gymnasium and common areas"
}
```

**Note:** This dataset uses title-case field names (unlike the shelter dataset which uses ALL_CAPS). The normalization code must handle this.

### How to Store

- `type = 'cooling_centre'`
- `is_seasonal = true`, `season_start_month = 6`, `season_end_month = 9`
- `wheelchair_accessible = (Accessible === "Yes")`
- Parse hours string into `hours_json`

---

## 4. Drop-In Directory

The Drop-In Network of Greater Toronto maintains a directory of drop-in centres. Toronto Open Data may have a version of this.

### Endpoint (check at hackathon time)

```
GET https://ckan0.cf.opendata.inter.prod-toronto.ca/api/3/action/datastore_search
  ?resource_id={drop_in_resource_id}
  &limit=200
```

**Alternative:** The Drop-In Network publishes a PDF directory. For hackathon purposes, manually enter the 20–30 most prominent drop-ins as seed data rather than trying to parse the PDF.

**Key fields to capture:**
- Name, address, phone
- Hours and days of operation
- Services offered (meal, shower, laundry, phone access, etc.)
- Population served (all adults, women, youth, etc.)

### How to Store

- `type = 'drop_in'`
- Services offered → tags field in FTS table
- For hackathon: seed 15–20 records manually

---

## 5. Toronto Public Library Branches (Wi-Fi)

All Toronto Public Library branches provide free WiFi and computer access. This is a valuable resource for people who need internet access.

### Endpoint

```
GET https://ckan0.cf.opendata.inter.prod-toronto.ca/api/3/action/datastore_search
  ?resource_id={tpl_branches_resource_id}
  &limit=200
```

**Dataset page:** https://open.toronto.ca/dataset/library-branch-general-information/

### Sample Fields

```json
{
  "BranchCode": "AG",
  "Name": "Agincourt",
  "Address": "155 Bonis Avenue",
  "Postal Code": "M1T 3W6",
  "Phone": "416-396-8943",
  "Monday": "9:30 - 8:30",
  "Tuesday": "9:30 - 8:30",
  "Wednesday": "9:30 - 8:30",
  "Thursday": "9:30 - 8:30",
  "Friday": "9:30 - 5:30",
  "Saturday": "9:30 - 5:00",
  "Sunday": "12:00 - 5:00",
  "Latitude": "43.784...",
  "Longitude": "-79.293...",
  "Accessible": "Yes"
}
```

**This is one of the better-formatted datasets** — it includes lat/lng directly, structured hours per day, and an accessibility flag.

### How to Store

- `type = 'library'` (also serves as `wifi`)
- Hours: map Monday→Thursday→Friday etc. to `hours_json` format
- `latitude` and `longitude` directly available
- Add tags: "wifi internet computer free" for search

### How to Handle Hours

```typescript
function parseTPLHours(record: TPLRecord): HoursJson {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const dayKeys = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  const hours: Record<string, string> = {};

  days.forEach((day, i) => {
    const val = record[day];
    if (val && val !== 'Closed') {
      // Convert "9:30 - 8:30" to "09:30-20:30"
      hours[dayKeys[i]] = normalizeHoursString(val);
    }
  });

  return hours;
}
```

---

## 6. Weather Data (Open-Meteo)

We use weather data to enhance availability predictions (cold/hot weather → higher shelter demand).

### Endpoint

```
GET https://api.open-meteo.com/v1/forecast
  ?latitude=43.65
  &longitude=-79.38
  &hourly=temperature_2m,apparent_temperature,precipitation
  &current=temperature_2m,apparent_temperature
  &timezone=America%2FToronto
  &forecast_days=1
```

**No API key required.** Open-Meteo is a free, open-source weather API with no authentication requirement.

### Sample Response (relevant fields)

```json
{
  "current": {
    "time": "2026-03-28T14:00",
    "temperature_2m": -3.2,
    "apparent_temperature": -9.8
  },
  "hourly": {
    "time": ["2026-03-28T00:00", "2026-03-28T01:00", ...],
    "temperature_2m": [-5.1, -5.3, ...],
    "apparent_temperature": [-11.2, -11.5, ...]
  }
}
```

### Key Fields

| Field | Use |
|-------|-----|
| `current.apparent_temperature` | Felt temperature (includes wind chill) — the key signal |
| `current.temperature_2m` | Actual temperature |
| `hourly.apparent_temperature` | Tonight's forecast for evening demand prediction |

### How to Store

Cache the current weather in Supabase (a simple `weather_cache` table or just the `services` table's scoring function reading it). Refresh hourly alongside shelter ingestion.

```sql
CREATE TABLE public.weather_cache (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fetched_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  temperature_c DOUBLE PRECISION,
  apparent_temp_c DOUBLE PRECISION,
  precipitation_mm DOUBLE PRECISION,
  raw_response  JSONB
);
```

### Usage in Availability Scoring

```typescript
// supabase/functions/score-availability/index.ts
async function getWeatherModifier(): Promise<number> {
  const weather = await getLatestWeather(); // From weather_cache table
  const felt = weather?.apparent_temp_c ?? 0;

  if (felt < -15) return 0.30;  // Extreme cold — very high demand
  if (felt < -5)  return 0.20;  // Cold — elevated demand
  if (felt < 0)   return 0.10;  // Cool — slightly elevated demand
  if (felt > 35)  return 0.25;  // Extreme heat
  if (felt > 30)  return 0.15;  // Hot — cooling centres fill
  return 0;                      // Normal weather
}
```

---

## 7. Postal Code Geocoding

The shelter dataset does not include coordinates. We need to geocode shelter addresses to lat/lng.

### Approach 1: Pre-geocoded lookup table (Recommended for Hackathon)

Run a one-time geocoding script before the hackathon to convert all known shelter addresses to coordinates. Store the result as a JSON lookup table in `src/constants/shelterGeocode.ts`.

```typescript
// src/constants/shelterGeocode.ts
export const SHELTER_GEOCODE: Record<string, { lat: number; lng: number }> = {
  '339 George Street': { lat: 43.6565, lng: -79.3720 },
  '145 Queen Street East': { lat: 43.6520, lng: -79.3665 },
  // ... ~50 records
};
```

**Why this approach for hackathon:** Zero runtime cost, no API key for geocoding, works offline.

### Approach 2: Postal Code Centroid Table

Map Toronto postal codes (FSA level, e.g. "M5A") to approximate centroids. ~96 FSA codes in Toronto. Accuracy: ~500m–1km, which is sufficient for displaying a marker in the right neighborhood.

```typescript
// src/constants/toronto.ts
export const TORONTO_FSA_CENTROIDS: Record<string, { lat: number; lng: number }> = {
  'M5A': { lat: 43.6600, lng: -79.3600 },
  'M5B': { lat: 43.6578, lng: -79.3773 },
  'M5C': { lat: 43.6511, lng: -79.3770 },
  // ... all Toronto FSA codes
};

export function postalCodeToLatLng(postalCode: string): { lat: number; lng: number } | null {
  const fsa = postalCode?.replace(/\s/g, '').toUpperCase().substring(0, 3);
  return TORONTO_FSA_CENTROIDS[fsa] ?? null;
}
```

### Approach 3: Geocoding API (Production)

For production, use a geocoding API (Google Maps Geocoding API, Nominatim/OpenStreetMap, or Mapbox Geocoding). Run this server-side in the ingestion Edge Function. Cache results in the `services` table — geocode once per address, reuse forever.

---

## Handling Downtime and Stale Data

### Detection

```typescript
async function fetchWithFallback(url: string, maxAgeMinutes: number = 90) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) }); // 10s timeout
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return { data: await response.json(), fromCache: false };
  } catch (error) {
    // Log the error for monitoring
    await logIngestionError(url, error.message);
    // Return last cached data from Supabase
    const cached = await getLastSuccessfulIngestion(url);
    if (cached && cached.age_minutes < maxAgeMinutes) {
      return { data: cached.data, fromCache: true, ageMinutes: cached.age_minutes };
    }
    throw new Error(`API down and cache too stale (${cached?.age_minutes}m old)`);
  }
}
```

### User-Facing Communication

When data is stale (> 2 hours since last successful ingestion):
1. The `last_availability_at` field on each service shows when data was last refreshed
2. The UI shows: "Updated [X] hours ago" next to the availability indicator
3. Availability color yellows: if normally green but data is > 3 hours old, show yellow instead (lower confidence)
4. Never show "Unknown" as a failure state — show "Last known: [X] available" with an age indicator

### Graceful Degradation Hierarchy

```
Level 1 (normal):    Real-time Toronto Open Data → high confidence score
Level 2 (degraded):  Data from last 2–6 hours → medium confidence, show age
Level 3 (offline):   Data from last 24 hours → low confidence, show age prominently
Level 4 (very stale): Data > 24 hours old → show service listing only, hide availability
Level 5 (no data):   No ingestion ever succeeded → show service with "Call to confirm"
```

---

## Data Normalization Reference

### Service Type Mapping

All source datasets use different type labels. Normalize everything to this enum:

```typescript
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
```

### Phone Number Normalization

All phone numbers stored in E.164 format: `+14163925000`

```typescript
function normalizePhone(raw: string | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits[0] === '1') return `+${digits}`;
  return null; // Invalid, discard
}
```

### Hours String Normalization

Multiple formats appear across Toronto datasets:
- "Mon-Fri: 9am-10pm, Sat-Sun: 9am-5pm"
- "9:30 - 8:30" (per-day columns in TPL dataset)
- "24 hours" / "24/7"
- "7 days a week, 9 am to 9 pm"

Target format (`hours_json` TEXT in SQLite, JSONB in Supabase):

```json
{
  "mon": "09:00-21:00",
  "tue": "09:00-21:00",
  "wed": "09:00-21:00",
  "thu": "09:00-21:00",
  "fri": "09:00-21:00",
  "sat": "10:00-17:00",
  "sun": "12:00-17:00"
}
```

Or for 24/7:
```json
{ "type": "24/7" }
```

The `src/utils/hours.ts` utility handles parsing this format and the `isOpenNow()` function.

### Confidence Score by Source

| Source | Base confidence | Notes |
|--------|----------------|-------|
| Toronto Open Data (live) | 0.95 | Most authoritative |
| Toronto Open Data (< 2h old) | 0.85 | Slightly stale |
| Toronto Open Data (2–6h old) | 0.65 | Getting stale |
| Toronto Open Data (> 6h old) | 0.40 | Treat as estimate only |
| User review (< 2h old) | 0.70 | Recent, firsthand |
| User review (2–6h old) | 0.55 | |
| User review (> 6h old) | 0.35 | Stale crowdsource |
| Predicted only (heuristics) | 0.40 | Better than nothing |
| No data | null | Show "Call to confirm" |
