# Database Schema

> Two databases: **SQLite** (local device, via expo-sqlite) and **PostgreSQL on Supabase** (remote).
> They are kept in sync by the sync service. The local SQLite schema is a simplified, denormalized subset of the Supabase schema — optimized for fast reads on constrained devices.

---

## Table of Contents

1. [SQLite Schema (Local Device)](#sqlite-schema-local-device)
2. [Supabase Schema (Remote PostgreSQL)](#supabase-schema-remote-postgresql)
3. [Schema Decision Notes](#schema-decision-notes)
4. [Sync Mapping](#sync-mapping)

---

## SQLite Schema (Local Device)

### Overview

Expo SQLite gives us a full SQLite 3.x database on-device. It supports FTS5 (Full Text Search), JSON functions, and standard indexes. We use it as the single source of truth for the UI — screens never wait for a network call.

The schema is initialized by `src/services/db/migrations.ts` on first app launch.

---

### Table: `services`

The master catalog of all service locations. Populated from Supabase on sync. Never written locally (read-only from the device's perspective, except `is_bookmarked`).

```sql
CREATE TABLE IF NOT EXISTS services (
  -- Identity
  id                    TEXT PRIMARY KEY,    -- UUID from Supabase, stable across syncs
  external_id           TEXT,                -- Source system ID (e.g. Toronto Open Data record ID)

  -- Core info
  name                  TEXT NOT NULL,        -- Display name (e.g. "Seaton House")
  type                  TEXT NOT NULL,        -- Enum: 'shelter'|'food'|'clinic'|'library'|'wifi'
                                              --   |'hygiene'|'warming_centre'|'cooling_centre'
                                              --   |'restroom'|'drop_in'
  description           TEXT,                -- Short description (1-2 sentences max)

  -- Location
  latitude              REAL NOT NULL,        -- WGS84 decimal degrees
  longitude             REAL NOT NULL,        -- WGS84 decimal degrees
  address_street        TEXT,                -- "339 George Street"
  address_city          TEXT DEFAULT 'Toronto',
  postal_code           TEXT,                -- "M5A 2N3"

  -- Contact
  phone                 TEXT,                -- E.164 format: "+14163925000"
  website               TEXT,                -- Full URL
  email                 TEXT,

  -- Hours (structured JSON stored as TEXT)
  -- Format: {"mon":"8:00-20:00","tue":"8:00-20:00",...} or "24/7" or null
  hours_json            TEXT,
  is_24_hours           INTEGER DEFAULT 0,   -- 1 if open 24/7 (shortcut for isOpenNow)

  -- Accessibility flags (stored as integers for fast filtering)
  wheelchair_accessible INTEGER DEFAULT 0,   -- 1 = confirmed accessible
  no_stairs             INTEGER DEFAULT 0,   -- 1 = step-free entry
  elevator_available    INTEGER DEFAULT 0,
  hearing_loop          INTEGER DEFAULT 0,
  visual_aids           INTEGER DEFAULT 0,

  -- Population served (bitmask-like approach using separate columns for clarity)
  serves_men            INTEGER DEFAULT 1,
  serves_women          INTEGER DEFAULT 1,
  serves_youth          INTEGER DEFAULT 0,   -- 1 = accepts people under 25
  serves_families       INTEGER DEFAULT 0,   -- 1 = accepts families with children
  serves_seniors        INTEGER DEFAULT 0,
  serves_lgbtq          INTEGER DEFAULT 0,   -- 1 = specifically inclusive/affirming

  -- Seasonal availability
  is_seasonal           INTEGER DEFAULT 0,   -- 1 = only open certain months
  season_start_month    INTEGER,             -- 1-12 (null if not seasonal)
  season_end_month      INTEGER,             -- 1-12 (null if not seasonal)

  -- Status
  is_active             INTEGER DEFAULT 1,   -- 0 = closed/removed, kept for navigation
  is_bookmarked         INTEGER DEFAULT 0,   -- 1 = user saved this (local only, not synced)

  -- Availability (denormalized snapshot for fast map rendering)
  availability_score    REAL,               -- 0.0–1.0 (null = unknown). Updated on sync.
  availability_label    TEXT,               -- 'available'|'limited'|'full'|'unknown'
  last_availability_at  INTEGER,            -- Unix timestamp of when score was computed

  -- Metadata
  data_source           TEXT,              -- 'toronto_open_data'|'manual'|'crowdsourced'
  last_updated          INTEGER NOT NULL,   -- Unix timestamp, from server
  created_at            INTEGER NOT NULL    -- Unix timestamp
);

-- Index: fast lookup by type (used heavily in filter queries)
CREATE INDEX IF NOT EXISTS idx_services_type ON services(type);

-- Index: fast lookup by active status
CREATE INDEX IF NOT EXISTS idx_services_active ON services(is_active);

-- Index: compound index for the most common query pattern
--        "give me active shelters ordered by availability"
CREATE INDEX IF NOT EXISTS idx_services_type_active_score
  ON services(type, is_active, availability_score);

-- Index: bookmarked services (for the saved tab)
CREATE INDEX IF NOT EXISTS idx_services_bookmarked ON services(is_bookmarked)
  WHERE is_bookmarked = 1;

-- FTS5 virtual table for keyword search
-- Covers name, description, and a tags column we populate on insert
CREATE VIRTUAL TABLE IF NOT EXISTS services_fts USING fts5(
  id UNINDEXED,        -- Store but don't index the ID
  name,
  description,
  tags,               -- Concatenated searchable terms: "shelter bed overnight men"
  content='services', -- Keep in sync with the main services table
  content_rowid='rowid'
);

-- Triggers to keep FTS index in sync with services table
CREATE TRIGGER IF NOT EXISTS services_fts_insert
  AFTER INSERT ON services BEGIN
    INSERT INTO services_fts(rowid, id, name, description, tags)
    VALUES (new.rowid, new.id, new.name, new.description,
            new.type || ' ' || COALESCE(new.description, ''));
  END;

CREATE TRIGGER IF NOT EXISTS services_fts_update
  AFTER UPDATE ON services BEGIN
    UPDATE services_fts SET name = new.name, description = new.description,
      tags = new.type || ' ' || COALESCE(new.description, '')
    WHERE id = new.id;
  END;

CREATE TRIGGER IF NOT EXISTS services_fts_delete
  AFTER DELETE ON services BEGIN
    DELETE FROM services_fts WHERE id = old.id;
  END;
```

---

### Table: `availability`

Time-series records of occupancy/availability. We keep the last 7 days per service. This table answers: "what do we know about this shelter's availability over time?"

```sql
CREATE TABLE IF NOT EXISTS availability (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  service_id    TEXT NOT NULL REFERENCES services(id) ON DELETE CASCADE,

  -- Capacity data (null when not applicable, e.g. for a meal program)
  total_capacity    INTEGER,             -- Total beds/seats
  current_occupancy INTEGER,             -- Current number occupied
  available_count   INTEGER,             -- Computed: total - current (or reported directly)
  occupancy_pct     REAL,               -- 0.0–1.0 fraction occupied

  -- Availability score at time of recording
  availability_score REAL,              -- 0.0–1.0, computed by scoring function

  -- Attribution
  source          TEXT NOT NULL,        -- 'toronto_open_data'|'user_review'|'predicted'
  confidence      REAL DEFAULT 0.5,     -- 0.0–1.0 confidence in this reading

  -- Timestamps
  reported_at     INTEGER NOT NULL,     -- Unix timestamp: when this data was valid (from source)
  synced_at       INTEGER NOT NULL      -- Unix timestamp: when we received/stored this locally
);

-- Index: fast lookup of recent records for a specific service
CREATE INDEX IF NOT EXISTS idx_availability_service_time
  ON availability(service_id, reported_at DESC);

-- Index: find stale records for eviction
CREATE INDEX IF NOT EXISTS idx_availability_synced_at
  ON availability(synced_at);
```

---

### Table: `reviews`

User-submitted reviews. Written locally first, synced to Supabase when online. The `is_synced` flag tracks what needs to be uploaded.

```sql
CREATE TABLE IF NOT EXISTS reviews (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,

  -- Will be replaced by the server-assigned UUID on sync
  remote_id     TEXT UNIQUE,            -- NULL until synced; UUID from Supabase

  service_id    TEXT NOT NULL REFERENCES services(id) ON DELETE CASCADE,

  -- Core review data
  was_available INTEGER NOT NULL,       -- 1 = yes there was space, 0 = no
  comment_text  TEXT,                   -- Optional, max 140 chars

  -- Anonymous user fingerprint (stable UUID generated on first install)
  device_fingerprint TEXT NOT NULL,

  -- Timestamps
  created_at    INTEGER NOT NULL,       -- Unix timestamp (local time, always recorded)

  -- Sync state
  is_synced     INTEGER DEFAULT 0,      -- 0 = pending upload, 1 = confirmed by server
  sync_error    TEXT                    -- Last sync error message (for debugging)
);

-- Index: fetch all reviews for a service (for display)
CREATE INDEX IF NOT EXISTS idx_reviews_service ON reviews(service_id, created_at DESC);

-- Index: find unsynced reviews to upload
CREATE INDEX IF NOT EXISTS idx_reviews_unsynced ON reviews(is_synced)
  WHERE is_synced = 0;

-- Index: recent reviews for a device (for rate limiting on client side)
CREATE INDEX IF NOT EXISTS idx_reviews_device ON reviews(device_fingerprint, created_at DESC);
```

---

### Table: `sync_log`

Audit trail for sync operations. Helps with debugging and determining whether a sync is needed.

```sql
CREATE TABLE IF NOT EXISTS sync_log (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,

  -- Timing
  started_at        INTEGER NOT NULL,   -- Unix timestamp
  completed_at      INTEGER,            -- NULL if still in progress or failed

  -- Results
  success           INTEGER NOT NULL DEFAULT 0,  -- 1 = completed successfully
  services_updated  INTEGER DEFAULT 0,
  availability_inserted INTEGER DEFAULT 0,
  reviews_uploaded  INTEGER DEFAULT 0,

  -- Error info
  error_message     TEXT,               -- NULL on success
  error_code        TEXT,               -- e.g. 'NETWORK_TIMEOUT', 'AUTH_FAILED'

  -- Sync scope
  sync_type         TEXT DEFAULT 'full' -- 'full'|'delta'|'reviews_only'
);

-- Index: find the last successful sync (most common query)
CREATE INDEX IF NOT EXISTS idx_sync_log_success
  ON sync_log(success, completed_at DESC);
```

---

### Table: `map_tiles`

Binary cache for raster map tiles. Prevents repeated tile downloads and enables offline map viewing.

```sql
CREATE TABLE IF NOT EXISTS map_tiles (
  -- The tile key is the URL of the tile, normalized (stripped of API key params)
  tile_key      TEXT PRIMARY KEY,       -- e.g. "https://tile.osm.org/13/2267/2914.png"

  -- Tile data
  data_blob     BLOB NOT NULL,          -- Raw PNG/WebP bytes
  content_type  TEXT DEFAULT 'image/png',
  size_bytes    INTEGER,               -- For tracking total cache size

  -- Cache metadata
  cached_at     INTEGER NOT NULL,       -- Unix timestamp when this was cached
  last_used_at  INTEGER NOT NULL,       -- Unix timestamp of last access (for LRU eviction)

  -- Tile coordinates (for range eviction by zoom level)
  zoom          INTEGER,
  tile_x        INTEGER,
  tile_y        INTEGER
);

-- Index: LRU eviction — find least recently used tiles
CREATE INDEX IF NOT EXISTS idx_map_tiles_lru ON map_tiles(last_used_at ASC);

-- Index: eviction by zoom level (e.g. delete all zoom > 15 tiles first)
CREATE INDEX IF NOT EXISTS idx_map_tiles_zoom ON map_tiles(zoom);

-- Index: expiry — find tiles older than 30 days
CREATE INDEX IF NOT EXISTS idx_map_tiles_cached_at ON map_tiles(cached_at ASC);
```

---

### SQLite Initialization (Migration Script)

```typescript
// src/services/db/migrations.ts
import * as SQLite from 'expo-sqlite';

export async function runMigrations(db: SQLite.SQLiteDatabase): Promise<void> {
  // Schema version tracking
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY
    );
  `);

  const result = await db.getFirstAsync<{ version: number }>(
    'SELECT version FROM schema_version ORDER BY version DESC LIMIT 1'
  );
  const currentVersion = result?.version ?? 0;

  if (currentVersion < 1) {
    await applyMigration1(db);
    await db.runAsync('INSERT INTO schema_version (version) VALUES (1)');
  }

  // Future migrations:
  // if (currentVersion < 2) { await applyMigration2(db); ... }
}
```

---

## Supabase Schema (Remote PostgreSQL)

### Overview

The Supabase (PostgreSQL) schema is the authoritative remote store. It uses:
- **UUIDs** as primary keys (not integers) — globally unique, avoids conflicts across multiple ingestion sources
- **PostGIS extension** for spatial queries (find services within X meters)
- **Row Level Security (RLS)** — anonymous users can read everything; only the backend can write service data; users can write their own reviews
- **`timestamptz`** for all timestamps — timezone-aware, avoids ambiguity
- **Triggers** for automatic `updated_at` maintenance

---

### Enable Required Extensions

```sql
-- Run once on project creation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";
```

---

### Table: `services`

```sql
CREATE TABLE public.services (
  -- Identity
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  external_id           TEXT UNIQUE,           -- Toronto Open Data record ID or other source

  -- Core info
  name                  TEXT NOT NULL,
  type                  TEXT NOT NULL CHECK (type IN (
    'shelter', 'food', 'clinic', 'library', 'wifi',
    'hygiene', 'warming_centre', 'cooling_centre',
    'restroom', 'drop_in'
  )),
  description           TEXT,

  -- Location (PostGIS geometry for spatial queries)
  location              GEOMETRY(Point, 4326),  -- SRID 4326 = WGS84 lat/lng
  latitude              DOUBLE PRECISION NOT NULL,
  longitude             DOUBLE PRECISION NOT NULL,
  address_street        TEXT,
  address_city          TEXT DEFAULT 'Toronto',
  postal_code           TEXT,

  -- Contact
  phone                 TEXT,
  website               TEXT,
  email                 TEXT,

  -- Hours
  hours_json            JSONB,                  -- {"mon":"8:00-20:00",...} or {"type":"24/7"}
  is_24_hours           BOOLEAN DEFAULT false,

  -- Accessibility
  wheelchair_accessible BOOLEAN DEFAULT false,
  no_stairs             BOOLEAN DEFAULT false,
  elevator_available    BOOLEAN DEFAULT false,
  hearing_loop          BOOLEAN DEFAULT false,
  visual_aids           BOOLEAN DEFAULT false,

  -- Population
  serves_men            BOOLEAN DEFAULT true,
  serves_women          BOOLEAN DEFAULT true,
  serves_youth          BOOLEAN DEFAULT false,
  serves_families       BOOLEAN DEFAULT false,
  serves_seniors        BOOLEAN DEFAULT false,
  serves_lgbtq          BOOLEAN DEFAULT false,

  -- Seasonal
  is_seasonal           BOOLEAN DEFAULT false,
  season_start_month    INTEGER CHECK (season_start_month BETWEEN 1 AND 12),
  season_end_month      INTEGER CHECK (season_end_month BETWEEN 1 AND 12),

  -- Status
  is_active             BOOLEAN DEFAULT true,

  -- Availability (materialized/cached for fast map loads)
  availability_score    DOUBLE PRECISION,       -- 0.0–1.0
  availability_label    TEXT CHECK (availability_label IN (
    'available', 'limited', 'full', 'unknown'
  )),
  last_availability_at  TIMESTAMPTZ,

  -- Data source tracking
  data_source           TEXT DEFAULT 'manual',
  source_url            TEXT,                   -- URL of the source data record

  -- Timestamps
  created_at            TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at            TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Spatial index for the PostGIS geometry column (fast "nearby" queries)
CREATE INDEX idx_services_location ON public.services USING GIST (location);

-- Standard B-tree indexes
CREATE INDEX idx_services_type ON public.services(type);
CREATE INDEX idx_services_active ON public.services(is_active) WHERE is_active = true;
CREATE INDEX idx_services_updated_at ON public.services(updated_at DESC);
CREATE INDEX idx_services_external_id ON public.services(external_id) WHERE external_id IS NOT NULL;

-- Trigger: auto-update updated_at on every row change
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER services_updated_at
  BEFORE UPDATE ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger: auto-populate PostGIS location from lat/lng columns
CREATE OR REPLACE FUNCTION public.set_service_location()
RETURNS TRIGGER AS $$
BEGIN
  NEW.location = ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER services_set_location
  BEFORE INSERT OR UPDATE OF latitude, longitude ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.set_service_location();
```

---

### Table: `availability_reports`

```sql
CREATE TABLE public.availability_reports (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_id        UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,

  -- Capacity data
  total_capacity    INTEGER,
  current_occupancy INTEGER,
  available_count   INTEGER,
  occupancy_pct     DOUBLE PRECISION CHECK (occupancy_pct BETWEEN 0 AND 1),

  -- Derived score
  availability_score DOUBLE PRECISION CHECK (availability_score BETWEEN 0 AND 1),

  -- Attribution
  source            TEXT NOT NULL DEFAULT 'toronto_open_data' CHECK (source IN (
    'toronto_open_data', 'user_review', 'predicted', 'manual'
  )),
  confidence        DOUBLE PRECISION DEFAULT 0.5 CHECK (confidence BETWEEN 0 AND 1),
  raw_data          JSONB,             -- Original source record (for debugging/auditing)

  -- Timestamps
  reported_at       TIMESTAMPTZ NOT NULL,  -- When the source data was valid
  created_at        TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Partitioning note: for production V2, partition this by month
-- For MVP: add a partial index to keep queries fast

-- Index: most common query — latest records for a service
CREATE INDEX idx_availability_service_time
  ON public.availability_reports(service_id, reported_at DESC);

-- Index: sync delta — find records updated since a given time
CREATE INDEX idx_availability_created_at
  ON public.availability_reports(created_at DESC);

-- Index: find records by source (for ingestion deduplication)
CREATE INDEX idx_availability_source_time
  ON public.availability_reports(source, reported_at DESC);
```

---

### Table: `user_reviews`

```sql
CREATE TABLE public.user_reviews (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_id        UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,

  -- Review content
  was_available     BOOLEAN NOT NULL,       -- The core signal
  comment_text      TEXT CHECK (length(comment_text) <= 500),

  -- Anonymous user identification (no PII — just a stable device UUID)
  device_fingerprint TEXT NOT NULL,

  -- Trust and moderation
  trust_score       DOUBLE PRECISION DEFAULT 0.5,  -- Updated by trust scoring pipeline
  is_flagged        BOOLEAN DEFAULT false,          -- Flagged for moderation
  flag_count        INTEGER DEFAULT 0,
  is_hidden         BOOLEAN DEFAULT false,          -- Hidden by moderator or auto-flag

  -- For spam detection
  ip_address_hash   TEXT,               -- SHA256 of IP, not raw IP

  -- Timestamps
  created_at        TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at        TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Index: reviews for a service, most recent first
CREATE INDEX idx_user_reviews_service_time
  ON public.user_reviews(service_id, created_at DESC);

-- Index: reviews from a specific device (for rate limiting)
CREATE INDEX idx_user_reviews_device
  ON public.user_reviews(device_fingerprint, created_at DESC);

-- Index: flagged reviews for moderation queue
CREATE INDEX idx_user_reviews_flagged
  ON public.user_reviews(is_flagged, flag_count DESC)
  WHERE is_flagged = true;

-- Index: reviews for availability scoring (recent, non-hidden)
CREATE INDEX idx_user_reviews_scoring
  ON public.user_reviews(service_id, created_at DESC)
  WHERE is_hidden = false;

CREATE TRIGGER user_reviews_updated_at
  BEFORE UPDATE ON public.user_reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
```

---

### Table: `sync_sessions`

```sql
CREATE TABLE public.sync_sessions (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_fingerprint TEXT NOT NULL,

  -- What was synced
  last_sync_at      TIMESTAMPTZ NOT NULL,
  records_received  INTEGER DEFAULT 0,

  -- Client version info (for debugging compatibility issues)
  app_version       TEXT,
  platform          TEXT CHECK (platform IN ('ios', 'android', 'web')),

  created_at        TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Index: find last sync for a device
CREATE INDEX idx_sync_sessions_device
  ON public.sync_sessions(device_fingerprint, last_sync_at DESC);
```

---

### Table: `ingestion_log`

```sql
CREATE TABLE public.ingestion_log (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source          TEXT NOT NULL,          -- 'toronto_shelters', 'cooling_centres', etc.

  -- Results
  success         BOOLEAN NOT NULL,
  records_fetched INTEGER DEFAULT 0,
  records_upserted INTEGER DEFAULT 0,
  records_failed  INTEGER DEFAULT 0,

  -- Error info
  error_message   TEXT,

  -- Timing
  started_at      TIMESTAMPTZ NOT NULL,
  completed_at    TIMESTAMPTZ,
  duration_ms     INTEGER,

  created_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_ingestion_log_source_time
  ON public.ingestion_log(source, started_at DESC);
```

---

### Row Level Security (RLS) Policies

RLS ensures that anonymous users (the app clients) can only read data, never write service records directly. Reviews go through a validated Edge Function.

```sql
-- Enable RLS on all public tables
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.availability_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingestion_log ENABLE ROW LEVEL SECURITY;

-- ─── SERVICES ────────────────────────────────────────────────────────────────

-- Anyone can read active services
CREATE POLICY "services_public_read"
  ON public.services FOR SELECT
  USING (is_active = true);

-- Only the service role (Edge Functions) can insert/update/delete
CREATE POLICY "services_service_write"
  ON public.services FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ─── AVAILABILITY REPORTS ────────────────────────────────────────────────────

-- Anyone can read availability reports
CREATE POLICY "availability_public_read"
  ON public.availability_reports FOR SELECT
  USING (true);

-- Only service role can insert (via Edge Functions / cron)
CREATE POLICY "availability_service_write"
  ON public.availability_reports FOR INSERT
  TO service_role
  WITH CHECK (true);

-- ─── USER REVIEWS ────────────────────────────────────────────────────────────

-- Anyone can read non-hidden reviews
CREATE POLICY "reviews_public_read"
  ON public.user_reviews FOR SELECT
  USING (is_hidden = false);

-- Anyone can insert a review (the submit-review Edge Function validates this)
-- The Edge Function runs as service_role so we only need service_role policy
CREATE POLICY "reviews_service_write"
  ON public.user_reviews FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Service role can update (for trust scoring, flagging)
CREATE POLICY "reviews_service_update"
  ON public.user_reviews FOR UPDATE
  TO service_role
  USING (true);

-- ─── SYNC SESSIONS ───────────────────────────────────────────────────────────

-- Service role only — sync sessions are an internal tracking mechanism
CREATE POLICY "sync_sessions_service_only"
  ON public.sync_sessions FOR ALL
  TO service_role
  USING (true);

-- ─── INGESTION LOG ───────────────────────────────────────────────────────────

-- No public read — internal only
CREATE POLICY "ingestion_log_service_only"
  ON public.ingestion_log FOR ALL
  TO service_role
  USING (true);
```

---

### Stored Function: `score_availability`

This function is called after each ingestion run to recompute the `availability_score` on the `services` table.

```sql
CREATE OR REPLACE FUNCTION public.score_availability(p_service_id UUID)
RETURNS DOUBLE PRECISION
LANGUAGE plpgsql
AS $$
DECLARE
  v_latest_report     public.availability_reports%ROWTYPE;
  v_recent_pos_reviews INTEGER;
  v_recent_neg_reviews INTEGER;
  v_base_score        DOUBLE PRECISION;
  v_review_bonus      DOUBLE PRECISION;
  v_hours_since       DOUBLE PRECISION;
  v_time_decay        DOUBLE PRECISION;
  v_final_score       DOUBLE PRECISION;
BEGIN
  -- Get the most recent availability report from an authoritative source
  SELECT * INTO v_latest_report
  FROM public.availability_reports
  WHERE service_id = p_service_id
    AND source = 'toronto_open_data'
  ORDER BY reported_at DESC
  LIMIT 1;

  -- Base score from official occupancy data
  IF v_latest_report IS NOT NULL THEN
    v_base_score := 1.0 - COALESCE(v_latest_report.occupancy_pct, 0.5);

    -- Time decay: confidence decreases as data gets older
    v_hours_since := EXTRACT(EPOCH FROM (NOW() - v_latest_report.reported_at)) / 3600;
    v_time_decay := EXP(-0.1 * v_hours_since);
    v_base_score := v_base_score * v_time_decay + (0.5 * (1 - v_time_decay));
    -- ^ As data ages, score regresses to 0.5 (unknown)
  ELSE
    v_base_score := 0.5; -- Unknown
  END IF;

  -- Review bonus/penalty from recent user reviews (last 6 hours)
  SELECT
    COUNT(*) FILTER (WHERE was_available = true),
    COUNT(*) FILTER (WHERE was_available = false)
  INTO v_recent_pos_reviews, v_recent_neg_reviews
  FROM public.user_reviews
  WHERE service_id = p_service_id
    AND created_at > NOW() - INTERVAL '6 hours'
    AND is_hidden = false;

  v_review_bonus := 0;
  IF (v_recent_pos_reviews + v_recent_neg_reviews) > 0 THEN
    v_review_bonus := (
      (v_recent_pos_reviews::DOUBLE PRECISION / (v_recent_pos_reviews + v_recent_neg_reviews)) - 0.5
    ) * 0.15; -- Max ±0.075 adjustment from reviews
  END IF;

  v_final_score := GREATEST(0.0, LEAST(1.0, v_base_score + v_review_bonus));

  -- Update the services table with new score
  UPDATE public.services
  SET
    availability_score = v_final_score,
    availability_label = CASE
      WHEN v_final_score >= 0.5  THEN 'available'
      WHEN v_final_score >= 0.2  THEN 'limited'
      WHEN v_final_score > 0     THEN 'full'
      ELSE 'unknown'
    END,
    last_availability_at = NOW()
  WHERE id = p_service_id;

  RETURN v_final_score;
END;
$$;
```

---

## Schema Decision Notes

### Why Integer Timestamps in SQLite?

SQLite does not have a native `TIMESTAMP` type. Storing as `INTEGER` (Unix seconds) is:
- Compact (8 bytes vs 20+ bytes for ISO string)
- Directly comparable with `>`, `<`, `BETWEEN`
- Easy to convert in TypeScript: `new Date(timestamp * 1000)`

### Why Denormalize `availability_score` onto `services`?

The map screen needs to render 50–200 markers at once, each with a color. If we had to JOIN `services` with `availability` on every map render, that's 50+ database reads per render cycle. By maintaining a materialized `availability_score` on `services`, the map query becomes a single table scan: `SELECT id, lat, lng, type, availability_score FROM services WHERE is_active = 1`.

The score is slightly stale (updated on sync), but that's acceptable — we don't need sub-second availability accuracy.

### Why FTS5 (Full Text Search) in SQLite?

The search feature requires keyword matching across service name, description, and tags. `LIKE '%shower%'` is a full table scan and doesn't handle synonyms. FTS5 provides a proper inverted index, tokenization, and relevance ranking. It also supports the `MATCH` operator which is fast even on 1,000+ records.

### Why PostGIS on Supabase?

The "nearby services" query is a fundamental feature: given a lat/lng, find all services within X meters. Without PostGIS, this requires computing Haversine distance for every row — O(N) full table scan. With a PostGIS GiST index, a 5km radius query on 10,000 points takes <5ms.

### Why JSONB for `hours_json`?

Hours are complex (different hours per day, holiday exceptions, temporary closures). JSONB lets us store this flexibly without designing a multi-table hours schema that would complicate queries. The SQLite equivalent is `TEXT` storing a JSON string, parsed in TypeScript.

### Why Separate `reported_at` and `created_at` on `availability_reports`?

- `reported_at`: when the source data was actually valid (e.g. Toronto Open Data timestamp)
- `created_at`: when our system received and stored it

These differ because ingestion may be delayed. A shelter report from 2 PM might not be ingested until 2:30 PM. For confidence scoring, we care about `reported_at` (data age), not `created_at` (our processing delay).

---

## Sync Mapping

How SQLite columns map to Supabase columns:

| SQLite column | Supabase column | Notes |
|--------------|-----------------|-------|
| `services.id` (TEXT) | `services.id` (UUID) | Same UUID value, different type |
| `services.last_updated` (INTEGER) | `services.updated_at` (TIMESTAMPTZ) | Convert: `new Date(ts * 1000)` |
| `availability.reported_at` (INTEGER) | `availability_reports.reported_at` (TIMESTAMPTZ) | Same conversion |
| `reviews.remote_id` (TEXT) | `user_reviews.id` (UUID) | Set after sync confirmation |
| `reviews.created_at` (INTEGER) | `user_reviews.created_at` (TIMESTAMPTZ) | Local time → UTC on sync |
| N/A | `services.location` (GEOMETRY) | Computed server-side from lat/lng |
