# Project Folder Structure

> **Convention:** This project uses Expo Router file-based routing. The `src/app/` directory IS the router — every file inside it becomes a route. Platform variants use `.web.tsx` suffixes (Expo automatically picks the right file).
>
> All new code should follow this structure. When in doubt: screens go in `app/`, reusable components in `components/`, data/logic in `services/` or `hooks/`.

---

## Full Directory Tree

```
lcs-hackathon/
│
├── app.json                        # Expo project config (bundle ID, maps API key, permissions)
├── package.json                    # Dependencies
├── tsconfig.json                   # TypeScript config (strict mode recommended)
├── expo-env.d.ts                   # Expo TypeScript environment types
│
├── assets/
│   ├── fonts/                      # Custom fonts (if any — keep to 1-2 for fast load)
│   └── images/                     # App icon, splash screen, static illustrations
│
├── scripts/
│   └── reset-project.js            # Expo default — resets to starter state
│
├── docs/                           # ← You are here
│   ├── IMPLEMENTATION.md           # Full architecture and feature implementation guide
│   ├── FOLDER_STRUCTURE.md         # This file
│   ├── DATABASE_SCHEMA.md          # SQLite + Supabase schemas with CREATE TABLE statements
│   ├── EXPO_SKILLS.md              # Expo modules, skill gaps, packages to install
│   ├── DATA_SOURCES.md             # Toronto Open Data API reference
│   └── superpowers/
│       └── specs/
│           └── 2026-03-28-homeless-services-app-design.md  # Formal design spec
│
├── supabase/
│   ├── config.toml                 # Supabase CLI config (local dev)
│   ├── seed.sql                    # Seed data (Toronto services, test records)
│   ├── migrations/
│   │   ├── 20260328000001_initial_schema.sql    # Services, availability, reviews tables
│   │   ├── 20260328000002_rls_policies.sql      # Row-level security policies
│   │   ├── 20260328000003_indexes.sql           # Performance indexes + PostGIS
│   │   └── 20260328000004_functions.sql         # score_availability() DB function
│   └── functions/
│       ├── ingest-shelters/
│       │   └── index.ts            # Cron: fetches Toronto shelter occupancy, upserts to DB
│       ├── ingest-cooling-warming/
│       │   └── index.ts            # Cron: fetches cooling/warming centre data
│       ├── score-availability/
│       │   └── index.ts            # Recomputes availability_score for services
│       ├── handle-sms/
│       │   └── index.ts            # Twilio webhook handler — parses SMS, returns TwiML
│       ├── submit-review/
│       │   └── index.ts            # Validates + inserts user review with rate limiting
│       ├── sync-delta/
│       │   └── index.ts            # Returns records updated since a given timestamp
│       └── nearby/
│           └── index.ts            # PostGIS spatial query: services within radius
│
└── src/
    │
    ├── app/                        # Expo Router — every file = a route
    │   ├── _layout.tsx             # Root layout: providers, navigation shell, offline banner
    │   ├── index.tsx               # Landing / home screen (redirects to /map)
    │   ├── (tabs)/                 # Bottom tab navigator group
    │   │   ├── _layout.tsx         # Tab bar configuration (4 tabs)
    │   │   ├── map.tsx             # MAP tab — main map screen (mobile)
    │   │   ├── map.web.tsx         # MAP tab — web variant with Leaflet
    │   │   ├── list.tsx            # LIST tab — searchable service list
    │   │   ├── list.web.tsx        # LIST tab — web variant (same logic, minor layout diffs)
    │   │   ├── saved.tsx           # SAVED tab — bookmarked services (future)
    │   │   └── info.tsx            # INFO tab — about, how to use, emergency numbers
    │   ├── service/
    │   │   └── [id].tsx            # Service detail screen (dynamic route)
    │   └── +not-found.tsx          # 404 screen
    │
    ├── components/
    │   │
    │   ├── map/                    # Map-specific components (platform-split)
    │   │   ├── MapView.tsx         # Mobile map (react-native-maps)
    │   │   ├── MapView.web.tsx     # Web map (Leaflet via react-leaflet)
    │   │   ├── ServiceMarker.tsx   # Individual marker with color + icon (mobile)
    │   │   ├── ServiceMarker.web.tsx  # Same for web (Leaflet Marker)
    │   │   ├── ClusterMarker.tsx   # Cluster bubble (mobile)
    │   │   ├── ClusterMarker.web.tsx  # Cluster bubble (web)
    │   │   ├── MapControls.tsx     # Zoom/locate-me buttons overlay
    │   │   └── types.ts            # Shared MapView/Marker prop types
    │   │
    │   ├── service/                # Service-related UI components
    │   │   ├── ServiceCard.tsx     # Card shown in the list view
    │   │   ├── ServiceBottomSheet.tsx   # Bottom sheet detail (react-native-reanimated)
    │   │   ├── AvailabilityBadge.tsx    # Green/yellow/red availability chip
    │   │   ├── ServiceTypeIcon.tsx      # Icon per service type (shelter, food, etc.)
    │   │   ├── HoursDisplay.tsx         # Human-readable hours + "Open Now" indicator
    │   │   ├── ContactRow.tsx           # Phone/website with tap-to-call/open
    │   │   └── AccessibilityFlags.tsx   # Visual chips for accessibility features
    │   │
    │   ├── search/                 # Search and filter UI
    │   │   ├── SearchBar.tsx       # Main text input with clear button
    │   │   ├── FilterChips.tsx     # Horizontal scrollable filter pill row
    │   │   ├── FilterSheet.tsx     # Expanded filter options (bottom sheet)
    │   │   └── EmptyState.tsx      # "No results" state with suggestions
    │   │
    │   ├── review/                 # Review submission components
    │   │   ├── ReviewPrompt.tsx    # "Was space available?" yes/no buttons
    │   │   ├── ReviewForm.tsx      # Optional comment input + submit
    │   │   └── ReviewSummary.tsx   # Aggregated "X of Y found space" display
    │   │
    │   ├── sync/                   # Sync status UI
    │   │   ├── OfflineBanner.tsx   # Top banner: "Offline — showing cached data"
    │   │   ├── SyncIndicator.tsx   # Small spinner or last-synced timestamp
    │   │   └── StaleDataWarning.tsx  # Inline warning when data is > 6 hours old
    │   │
    │   └── ui/                     # Generic, reusable UI primitives
    │       ├── Button.tsx          # Primary/secondary/ghost button variants
    │       ├── BottomSheet.tsx     # Reusable bottom sheet (wraps reanimated)
    │       ├── Badge.tsx           # Small count/status badge
    │       ├── Skeleton.tsx        # Loading placeholder skeleton
    │       ├── Divider.tsx         # Horizontal rule
    │       └── SafeAreaWrapper.tsx # Consistent safe area padding
    │
    ├── services/                   # Data access and external integrations
    │   │
    │   ├── db/                     # Local database (SQLite on mobile, IndexedDB on web)
    │   │   ├── index.ts            # Exports the correct driver for current platform
    │   │   ├── client.ts           # Mobile: expo-sqlite connection + initialization
    │   │   ├── client.web.ts       # Web: IndexedDB wrapper
    │   │   ├── migrations.ts       # Runs SQLite schema migrations on app start
    │   │   ├── services.ts         # CRUD operations for the services table
    │   │   ├── availability.ts     # CRUD for availability table
    │   │   ├── reviews.ts          # CRUD for reviews table (includes unsynced queue)
    │   │   ├── sync_log.ts         # Read/write sync_log entries
    │   │   └── map_tiles.ts        # Cache and retrieve map tile blobs
    │   │
    │   ├── api/                    # Remote Supabase API calls
    │   │   ├── client.ts           # Supabase JS client initialization (with anon key)
    │   │   ├── services.ts         # Fetch services from Supabase (delta sync)
    │   │   ├── availability.ts     # Fetch availability_reports
    │   │   ├── reviews.ts          # POST reviews to Supabase
    │   │   └── nearby.ts           # Call the nearby Edge Function
    │   │
    │   ├── sync/                   # Sync orchestration
    │   │   ├── index.ts            # Main sync() function called from hooks/useSync.ts
    │   │   ├── strategy.ts         # Sync decision logic (should we sync now?)
    │   │   ├── conflicts.ts        # Conflict resolution functions
    │   │   └── background.ts       # expo-background-fetch registration
    │   │
    │   ├── location/               # Device location services
    │   │   ├── index.ts            # Request permissions, get current position
    │   │   └── geocoding.ts        # Postal code → lat/lng lookup table
    │   │
    │   └── sms/                    # SMS interaction (client-side awareness)
    │       └── index.ts            # Helper to generate pre-filled SMS links (sms:// URLs)
    │
    ├── hooks/                      # React hooks — bridge between services/ and UI
    │   ├── useServices.ts          # Returns services array from local DB, with filter support
    │   ├── useService.ts           # Returns a single service by ID (local DB first)
    │   ├── useNearbyServices.ts    # Returns services sorted by distance from user location
    │   ├── useLocation.ts          # User's current coordinates (expo-location)
    │   ├── useSync.ts              # Triggers sync, exposes sync state (syncing, lastSynced)
    │   ├── useOffline.ts           # Returns { isOnline: boolean } — network state monitor
    │   ├── useReviews.ts           # Returns reviews for a service, handles submit
    │   ├── useSearch.ts            # Manages search query + filter state + results
    │   ├── useMapRegion.ts         # Manages map viewport (center, zoom level, bounds)
    │   └── useAvailability.ts      # Returns latest availability for a service + confidence
    │
    ├── store/                      # Global state management (Zustand)
    │   ├── index.ts                # Exports all stores
    │   ├── servicesStore.ts        # Cached services array, last-fetched timestamp
    │   ├── filterStore.ts          # Active search query, filter chips state
    │   ├── syncStore.ts            # Sync status: idle/syncing/error, lastSyncedAt
    │   ├── locationStore.ts        # User's current location
    │   └── preferencesStore.ts     # User settings: radius, text size, recent searches
    │
    ├── utils/                      # Pure functions — no React, no side effects
    │   ├── scoring.ts              # availability_score → color, score → label
    │   ├── clustering.ts           # Grid-based marker clustering algorithm
    │   ├── hours.ts                # Parse hours JSON, isOpenNow(), formatHours()
    │   ├── distance.ts             # Haversine formula for lat/lng distance
    │   ├── formatting.ts           # formatPhone(), formatAddress(), formatDistance()
    │   ├── search.ts               # Keyword synonym expansion, search result ranking
    │   ├── heuristics.ts           # Availability heuristics: time-of-day, weather, seasonal
    │   └── validation.ts           # Review text validation, input sanitization
    │
    ├── types/                      # TypeScript type definitions
    │   ├── index.ts                # Re-exports all types
    │   ├── service.ts              # Service, ServiceType, AccessibilityFlags, PopulationFlags
    │   ├── availability.ts         # AvailabilityRecord, ConfidenceLevel, MarkerColor
    │   ├── review.ts               # Review, ReviewSubmission, ReviewSummary
    │   ├── sync.ts                 # SyncState, SyncResult, SyncLog
    │   ├── map.ts                  # Region, Cluster, MapViewProps
    │   └── api.ts                  # API response shapes, error types
    │
    ├── constants/
    │   ├── index.ts                # Re-exports all constants
    │   ├── keywords.ts             # Search keyword → service type synonym map
    │   ├── toronto.ts              # Toronto bounding box, postal code → lat/lng table
    │   ├── colors.ts               # Design system colors (availability, type, UI)
    │   ├── serviceTypes.ts         # Service type enum values + display names
    │   └── config.ts               # App config: default radius, sync interval, tile zoom range
    │
    ├── hooks.ts                    # (Expo default — can delete or repurpose)
    ├── global.css                  # Global CSS for web (already exists)
    └── theme.ts                    # (Already exists) — extend with app design tokens
```

---

## Key Architectural Notes

### Why `services/` vs `hooks/`?

- `services/` contains functions that are **not React-aware** — they can be called from anywhere (Zustand actions, background tasks, tests). No hooks, no JSX.
- `hooks/` contains React hooks that **compose services + store** into a convenient interface for components. They subscribe to Zustand stores and re-render when data changes.

```
Component → useServices() hook → servicesStore (Zustand) → services/db/services.ts (SQLite)
                                                         ← services/api/services.ts (Supabase)
```

This separation makes unit testing the data layer straightforward — you test `services/db/services.ts` without any React machinery.

### Platform Splitting Pattern

This project already uses `.web.tsx` variants. Extend this consistently:

```
MapView.tsx        ← mobile (react-native-maps)
MapView.web.tsx    ← web (Leaflet)

client.ts          ← mobile (expo-sqlite)
client.web.ts      ← web (IndexedDB)
```

**Rule:** Never put a `Platform.OS === 'web'` check inside a component. Use file variants instead. This keeps each file clean and tree-shakeable.

### Supabase Edge Functions Location

Edge functions live in `supabase/functions/` — this is the Supabase CLI convention. Each function is a directory with an `index.ts`. They are deployed with `supabase functions deploy`.

For local development, use `supabase functions serve` which runs all functions locally.

### Migration Naming Convention

Supabase migrations are timestamp-prefixed:
```
20260328000001_initial_schema.sql
20260328000002_rls_policies.sql
```

The timestamp is `YYYYMMDDHHMMSS`. Always increment. Never modify an already-applied migration — add a new one instead.

### Constants vs Config

- `constants/` — values that never change at runtime (service type lists, color mappings, keyword synonyms)
- `constants/config.ts` — values that could theoretically be configured but are hardcoded for now (default radius, max cache size)
- Environment variables (`.env`) — secrets and environment-specific values (Supabase URL/key, Twilio credentials). Never commit `.env`.

---

## Files to Create First (Hackathon Priority Order)

```
Priority 1 — App runs with data:
  src/services/db/client.ts          Database connection
  src/services/db/migrations.ts      Schema setup
  src/store/servicesStore.ts         Global service state
  src/hooks/useServices.ts           Data hook for screens
  supabase/migrations/001_schema.sql Remote schema

Priority 2 — Map works:
  src/components/map/MapView.tsx     Mobile map
  src/components/map/MapView.web.tsx Web map
  src/app/(tabs)/map.tsx             Map screen
  src/utils/scoring.ts               Availability colors

Priority 3 — Search works:
  src/hooks/useSearch.ts
  src/components/search/SearchBar.tsx
  src/components/search/FilterChips.tsx
  src/app/(tabs)/list.tsx

Priority 4 — Offline works:
  src/services/sync/index.ts
  src/hooks/useSync.ts
  src/components/sync/OfflineBanner.tsx
  src/hooks/useOffline.ts

Priority 5 — Reviews work:
  src/components/review/ReviewPrompt.tsx
  src/services/api/reviews.ts
  src/services/db/reviews.ts
```
