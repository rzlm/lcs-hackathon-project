# Expo Skills & Package Reference

> This document covers every Expo module and third-party package needed for this project, along with skill gaps the team should be aware of, and exact installation commands.

---

## Table of Contents

1. [Expo-Specific Modules](#expo-specific-modules)
2. [Missing But Critical Skill Areas](#missing-but-critical-skill-areas)
3. [Packages to Install](#packages-to-install)
4. [Existing Packages (Already Installed)](#existing-packages-already-installed)

---

## Expo-Specific Modules

### Already in the project (review these before adding duplicates)

| Module | Version | Status | Notes |
|--------|---------|--------|-------|
| `expo` | 55.0.10-canary | Installed | Canary — expect rough edges; don't upgrade during hackathon |
| `expo-router` | 55.0.9-canary | Installed | File-based routing already configured |
| `expo-constants` | installed | Installed | Use for `Constants.expoConfig.extra` (API keys) |
| `expo-font` | installed | Installed | Preload any icon fonts here |
| `expo-linking` | installed | Installed | Deep links, `tel://` and `sms://` links |
| `expo-splash-screen` | installed | Installed | Prevent splash from hiding before DB is initialized |
| `expo-status-bar` | installed | Installed | Use to set status bar color per screen |

---

### `expo-sqlite` — Local Database

**What it does:** Provides a full SQLite 3.x database on the device. Supports async queries, transactions, FTS5, and prepared statements. As of Expo SDK 50+, the new API (`expo-sqlite/next`) is the default — it's Promise-based and much cleaner.

**Use in this project:**
- Stores all service data for offline access
- Queues unsynced user reviews
- Caches map tiles (as BLOB)
- Maintains sync_log

**Hackathon priority:** CRITICAL — nothing works offline without this.

**Key gotchas:**
- The new API uses `SQLiteDatabase` (async) not the old `openDatabase`. Use `useSQLiteContext()` hook in components or open the DB in a `services/db/client.ts` singleton.
- Web support: `expo-sqlite` does NOT work on Expo Web. You need a separate IndexedDB implementation for web. Use the `.web.ts` file split pattern.
- FTS5 virtual tables require SQLite to be compiled with FTS5 support. Expo SQLite includes FTS5. Verify with `SELECT fts5()` — if it errors, FTS5 is available (paradoxically, the function existing means it's there). Actually: `SELECT sqlite_version()` and check docs.
- Migrations: run all schema migrations inside a single `withTransactionAsync` call so they're atomic.
- Don't run heavy queries on the main thread in the same tick as rendering. Use `getFirstAsync`/`getAllAsync` which are always async.

```typescript
// Example: Open DB and run migration
import * as SQLite from 'expo-sqlite';

const db = await SQLite.openDatabaseAsync('homeless_services.db');
await db.execAsync('PRAGMA journal_mode = WAL;'); // Better write performance
await db.execAsync('PRAGMA foreign_keys = ON;');
```

---

### `expo-location` — Device GPS

**What it does:** Requests the user's current GPS coordinates, watches for location changes, and handles permission flows.

**Use in this project:**
- Center the map on the user's location when the app opens
- Sort service results by distance from user
- Provide location context for SMS queries (if user grants permission)

**Hackathon priority:** CRITICAL — the map is useless without user location.

**Key gotchas:**
- **Always handle the case where permission is denied.** The user might be using a shared phone, or might not trust the app. Fall back to Toronto city center (`43.6532, -79.3832`).
- On iOS, you need to add `NSLocationWhenInUseUsageDescription` to `app.json` info.plist — without it, the permission request crashes.
- `expo-location` is accurate to ~5–50 meters in urban areas (GPS + WiFi assisted). Good enough for our use case.
- The `watchPositionAsync` subscription must be cleaned up in `useEffect` cleanup.
- Background location requires a separate `BackgroundLocation` permission — we do NOT need this.

```json
// app.json additions needed:
{
  "expo": {
    "ios": {
      "infoPlist": {
        "NSLocationWhenInUseUsageDescription": "Used to show services near you"
      }
    },
    "android": {
      "permissions": ["ACCESS_COARSE_LOCATION", "ACCESS_FINE_LOCATION"]
    }
  }
}
```

---

### `expo-background-fetch` — Background Sync

**What it does:** Registers a task to run periodically in the background, even when the app is closed.

**Use in this project:**
- Sync service availability data in the background (every 30 minutes)
- Upload queued reviews when connectivity returns

**Hackathon priority:** NICE-TO-HAVE — background sync improves the experience but is not demo-critical.

**Key gotchas:**
- iOS severely limits background tasks. The minimum interval on iOS is 15 minutes, and the system decides when to actually run it (could be hours). Do not rely on this for anything user-critical.
- Requires `expo-task-manager` as a peer dependency.
- Background tasks cannot access the UI context. All DB operations must use the services layer directly.
- On iOS Simulator, background fetch never fires. Test on a physical device.

---

### `expo-task-manager` — Task Registry

**What it does:** Registers named background tasks (used by `expo-background-fetch` and `expo-location`).

**Use in this project:**
- Register the `BACKGROUND_SYNC_TASK` task
- Must be imported at the top level of the app (in `_layout.tsx` or `index.ts`), not lazily

**Hackathon priority:** NICE-TO-HAVE (needed only if background sync is implemented).

---

### `expo-secure-store` — Secure Storage for Secrets

**What it does:** Stores key-value pairs in the device's secure enclave (Keychain on iOS, Keystore on Android).

**Use in this project:**
- Store the anonymous device fingerprint (UUID generated on first install)
- This never changes, must survive app restarts, and should not be easily readable

**Hackathon priority:** CRITICAL for review system — the fingerprint is the only way to rate-limit review submissions.

**Key gotchas:**
- Not available on Expo Web. For web, use `localStorage` with a fallback (security is lower, acceptable for this use case).
- Keys are scoped to the app — uninstalling the app clears the store. If a user reinstalls, they get a new fingerprint. That's fine for our use case.
- Max value size: ~2KB. Only store small strings.

---

### `expo-network` — Network State Detection

**What it does:** Detects whether the device is online and what kind of connection it has (WiFi, cellular, etc.).

**Use in this project:**
- Show the offline banner when `isConnected = false`
- Gate sync operations on network availability
- Optionally: warn when on metered (cellular) connection before downloading map tiles

**Hackathon priority:** CRITICAL — offline-first behavior depends on knowing when we're offline.

**Key gotchas:**
- `isConnected = true` does not guarantee internet access (captive portal scenario). For robust online detection, also try a lightweight HEAD request to your Supabase URL.
- `useNetworkState()` from `expo-network` provides a hook for reactive updates.

---

### `expo-notifications` — Push Notifications (V2)

**What it does:** Registers for push notifications, handles incoming messages, and manages notification permissions.

**Use in this project (V2 only):**
- Alert users when a nearby shelter has space available
- Alert when extreme weather triggers additional warming/cooling centres
- Opt-in only — this is a sensitive population

**Hackathon priority:** V2 — skip for the hackathon.

**Key gotchas:** Requires push notification server setup, additional Expo project configuration, and Supabase Edge Function for sending. Budget a full day for this feature.

---

### `expo-image` — Optimized Image Loading (Already installed)

**What it does:** Drop-in replacement for `<Image>` with better caching, progressive loading, and blur hash placeholders.

**Use in this project:**
- Service logos (if any)
- Map placeholder before tiles load

**Hackathon priority:** NICE-TO-HAVE — already installed, use instead of `<Image>` where applicable.

---

### `expo-web-browser` — In-App Browser (Already installed)

**What it does:** Opens URLs in an in-app browser (SFSafariViewController on iOS).

**Use in this project:**
- "Get Directions" link → opens Google Maps / Apple Maps
- Service website links

**Hackathon priority:** NICE-TO-HAVE — use `Linking.openURL` as fallback if not needed immediately.

---

## Missing But Critical Skill Areas

The following are skill areas that the team needs beyond standard Expo development. These are gaps between "building a typical app" and "building this specific app well."

---

### 1. Frontend Design & UX for Vulnerable Populations

**Why it matters:** The primary users of this app are in crisis. They may have cognitive load from stress, low literacy, visual impairments, or be using borrowed or damaged phones. Standard tech UI conventions are not sufficient.

**Specific requirements:**
- **Tap targets:** Minimum 44×44 points (Apple HIG) — ideally 56×56px for primary actions. People's hands shake. Screens crack. Make buttons big.
- **Color contrast:** WCAG AA minimum (4.5:1 for text). Our availability colors (green/yellow/red) must also be distinguishable for color-blind users — add icons or patterns, not just color.
- **Text size:** Default to 16sp minimum. Never use text smaller than 14sp for any user-facing content.
- **Language:** Plain English. No jargon. "Space available" not "Occupancy rate below threshold." "Call" not "Contact via phone."
- **Icons:** Supplement all text with icons. Many users may not read English fluently.
- **Loading states:** Skeleton screens, not spinners. Show something immediately — even if it's a placeholder.
- **Error messages:** "We couldn't load new info. Showing saved data." Not "Network error 503."

**Hackathon vs long-term:**
- Hackathon: implement large tap targets, high contrast colors, plain language
- Long-term: user testing with people who have lived experience of homelessness, full WCAG 2.1 AA audit, multilingual support

**Resources:**
- WCAG 2.1 quick reference: https://www.w3.org/WAI/WCAG21/quickref/
- Trauma-informed design principles: Centre for Social Innovation (Toronto)

---

### 2. Product Thinking — User Journey for Someone Without a Data Plan

**Why it matters:** Standard product thinking assumes a connected user with an account. This app's users may have no data, no account, no stable housing (and therefore no stable address for verification), and are seeking help urgently.

**Key user journey realities:**
- User connects to free WiFi at library. Has 10 minutes. Needs to find a bed for tonight.
- User has 3G data but slow (250kbps). App must load in under 5 seconds.
- User doesn't know the app or how to use it. First screen must be immediately useful.
- User may be handing the phone to a social worker who uses it on their behalf.

**Design implications:**
- No mandatory onboarding. Go straight to the map.
- No account creation. No email. No password.
- The most useful information (map with markers) must be visible in the first 2 seconds.
- Emergency numbers (211, crisis line) always accessible — not buried in settings.
- "I need ___" search must be the most prominent UI element.

**Hackathon vs long-term:**
- Hackathon: apply these principles to the MVP design
- Long-term: conduct field research with people with lived experience; partner with a frontline organization for user testing

---

### 3. Offline-First Architecture

**Why it matters:** "Offline-first" sounds simple but has well-documented pitfalls. Getting it wrong means data corruption, confusing UI states, or silently failing syncs.

**Key patterns to understand:**
- **Optimistic updates:** Update the UI immediately when a user submits a review, even before it's synced. If sync fails, don't revert — queue it for later.
- **Last-write-wins vs merge:** For this app, server wins on service data, client wins on their own reviews (append-only).
- **Stale-while-revalidate:** Show cached data immediately, then silently update in the background. Never block the UI on a network call.
- **Sync state machine:** `idle → syncing → success/error → idle`. Each state has a different UI presentation.

**Common pitfalls:**
- Forgetting to handle sync errors gracefully (crashing instead of queuing)
- Not testing on a slow network (Chrome DevTools network throttle is your friend)
- Assuming SQLite is always fast — large queries on the main thread cause jank
- Not cleaning up stale records — the availability table grows forever if not pruned

**Hackathon vs long-term:**
- Hackathon: implement sync with manual trigger, stale data indicator, review queue
- Long-term: background sync, conflict resolution edge cases, incremental delta sync

---

### 4. Geospatial / Mapping

**Why it matters:** Maps are the core UI. Getting the coordinate system, zoom levels, or tile URLs wrong wastes a full day.

**Key concepts:**
- **WGS84 (EPSG:4326):** The coordinate system we use everywhere — `{latitude: 43.65, longitude: -79.38}`. All GPS, Supabase, and display coordinates use this.
- **Web Mercator (EPSG:3857):** What map tiles use internally. You don't need to think about this — the map libraries handle the conversion.
- **Zoom levels:** Level 10 = city level (~city fits on screen), Level 13 = neighborhood, Level 16 = street level. We pre-cache 10–15.
- **Tile URLs:** `https://tile.openstreetmap.org/{z}/{x}/{y}.png` — the `{z}/{x}/{y}` is the tile coordinate. Never hardcode tile coordinates.
- **Clustering:** Grouping nearby markers into a single "N items" badge. Prevents 200 overlapping pins at zoom 10.

**Hackathon gotchas:**
- react-native-maps on Android requires a Google Maps API key in `app.json`. Without it, the map shows a blank grey screen.
- Leaflet requires an explicit CSS import: `import 'leaflet/dist/leaflet.css'` — forgetting this makes the map look broken.
- Leaflet default marker icons break in bundlers — you need to fix the icon path: https://github.com/Leaflet/Leaflet/issues/4968
- react-native-maps may not work in the Expo Go app — it may require a development build. Test early.

**Hackathon vs long-term:**
- Hackathon: get map rendering with markers, basic clustering, tap to see details
- Long-term: vector tiles (smaller, more flexible), custom map style (accessibility-friendly colors), offline tile packing

---

### 5. Backend / System Design — Supabase Edge Functions

**Why it matters:** Edge Functions run in Deno (not Node.js). Many Node packages don't work. The Supabase client in Edge Functions uses the service role key (bypasses RLS). If you accidentally use the wrong key, you expose all data.

**Key patterns:**
- Always validate the `Authorization` header in Edge Functions called by cron jobs (use a secret).
- Use the `supabase` client initialized with `SUPABASE_SERVICE_ROLE_KEY` for writes, `SUPABASE_ANON_KEY` for reads that should respect RLS.
- Edge Functions have a 2-second CPU time limit (burstable). Heavy data processing should be chunked.
- Use `Deno.env.get('VAR_NAME')` for environment variables (not `process.env`).

**Cron setup (Supabase Cron via `pg_cron`):**

```sql
-- Run ingestion every 30 minutes
SELECT cron.schedule(
  'ingest-shelters',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://{project}.supabase.co/functions/v1/ingest-shelters',
    headers := '{"Authorization": "Bearer {CRON_SECRET}"}'::jsonb
  );
  $$
);
```

**Hackathon vs long-term:**
- Hackathon: manually trigger ingestion once to seed data; wire up cron but don't debug it extensively
- Long-term: monitoring, alerting on ingestion failure, retry logic

---

### 6. Human-Centered Design for Vulnerable Populations

**Why it matters:** Design choices have real consequences for this user group. Getting the language, metaphors, or interaction patterns wrong can create distress or confusion for someone who is already in a difficult situation.

**Trauma-informed design principles:**
- **Dignity first:** Never use language that implies judgment or shame. "Space available" not "beds for homeless people."
- **Transparency:** Be clear about what data the app collects and why. The app collects no PII — make this visible.
- **Control:** Never require location permission to use the app. Make it optional with a clear explanation.
- **Predictability:** Don't surprise the user with popups, permission requests, or sudden UI changes. Every interaction should be predictable.
- **Resilience:** If something fails (network, GPS, database), the app should still show something useful. Never show a blank screen or a generic error.

**Language patterns:**
| Avoid | Use instead |
|-------|-------------|
| "No shelters found" | "No shelters nearby right now — try expanding your search" |
| "Error loading data" | "Showing saved information from earlier" |
| "You must allow location access" | "Share your location to find places near you (optional)" |
| "Rate limit exceeded" | "Thanks! Come back in an hour to add another update." |

**Hackathon vs long-term:**
- Hackathon: apply language patterns, implement graceful failure states, make location optional
- Long-term: partner with frontline organization for co-design; user testing with people with lived experience; translate to French and other common languages in Toronto (Somali, Tamil, Spanish, Arabic)

---

### 7. Data Engineering — Working with Toronto Open Data

**Why it matters:** Open civic data is inconsistently documented, contains errors, changes format without notice, and has occasional outages. Writing fragile data ingestion code wastes hours.

**Key patterns:**
- **Schema validation:** Always validate the shape of incoming API data before inserting. If a required field is missing, log the error and skip the record — don't crash the ingestion job.
- **Idempotent upserts:** The ingestion job runs every 30 minutes. Running it twice should produce the same result. Use `ON CONFLICT DO UPDATE` in SQL.
- **Field name normalization:** Toronto Open Data uses inconsistent casing (`SHELTER_NAME`, `Shelter_Name`, `shelterName` — all exist in different datasets). Write a normalizer that handles all variants.
- **Null handling:** Many fields are optional or inconsistently populated. Every field read from the API should have a fallback value.
- **Rate limiting:** Toronto Open Data doesn't require authentication but has undocumented rate limits. Add exponential backoff to ingestion code.

**Hackathon approach:** Spend 2 hours early on making a direct API call, logging the full response, and mapping every field you need. Don't trust the API documentation for field names — trust the actual response.

---

## Packages to Install

### Run these commands to install all required packages:

```bash
# Core data and storage
npx expo install expo-sqlite
npx expo install expo-secure-store
npx expo install expo-network

# Location services
npx expo install expo-location

# Background sync (optional, V2)
npx expo install expo-background-fetch expo-task-manager

# Maps — mobile
npx expo install react-native-maps

# Maps — web (install as regular npm package, not via expo install)
npm install react-leaflet leaflet
npm install react-leaflet-cluster
npm install --save-dev @types/leaflet

# Backend client
npm install @supabase/supabase-js

# State management
npm install zustand

# Utility libraries
npm install date-fns          # Date formatting and manipulation

# SMS / deep links (built into expo-linking, already installed)
# No additional install needed for sms:// and tel:// links
```

### Complete install command (all at once):

```bash
npx expo install expo-sqlite expo-secure-store expo-network expo-location && \
npm install @supabase/supabase-js zustand date-fns && \
npm install react-leaflet leaflet react-leaflet-cluster && \
npm install --save-dev @types/leaflet && \
npx expo install react-native-maps
```

---

### Package Notes

**`react-native-maps`**
- Requires Android Google Maps API key in `app.json` under `android.config.googleMaps.apiKey`
- On iOS, uses Apple MapKit by default (no key needed)
- If you don't have an Android API key, demo on iOS + Web only
- Does not work well in Expo Go — requires a development build (`npx expo run:ios` or `npx expo run:android`)
- Install: `npx expo install react-native-maps`

**`react-leaflet` + `leaflet`**
- Web only. Never import in mobile code paths.
- Leaflet requires its CSS to be imported: `import 'leaflet/dist/leaflet.css'` in your web map component
- Default marker icon is broken in webpack/metro — fix with:
  ```typescript
  import L from 'leaflet';
  import iconUrl from 'leaflet/dist/images/marker-icon.png';
  import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
  import shadowUrl from 'leaflet/dist/images/marker-shadow.png';
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl });
  ```
- `react-leaflet-cluster` provides `<MarkerClusterGroup>` — wraps leaflet.markercluster

**`@supabase/supabase-js`**
- Initialize once, export the client: `export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)`
- The anon key is safe to include in client-side code — RLS policies control what it can access
- Never include the service role key in client-side code
- Store the URL and anon key in `app.json` under `expo.extra` and access via `Constants.expoConfig.extra`

**`zustand`**
- Lightweight (~1.5KB), no boilerplate, works great with React Native and Web
- No `Provider` needed — just import the store and call `useStore()`
- Persist middleware available for storing state to AsyncStorage: `zustand/middleware`

**`date-fns`**
- Tree-shakeable (only bundles functions you import)
- Use for: `formatDistanceToNow()` (e.g. "3 hours ago"), `isWithinInterval()` (for open hours checking)
- Avoid `moment.js` — it's 66KB gzipped, not tree-shakeable

---

## Existing Packages (Already Installed)

These are already in `package.json` — no install needed:

| Package | Version | Use in this project |
|---------|---------|---------------------|
| `expo-router` | 55.0.9-canary | File-based routing (already working) |
| `expo-constants` | 55.0.10-canary | Access `app.json` config values |
| `expo-linking` | 55.0.10-canary | `tel://`, `sms://`, `maps://` deep links |
| `expo-web-browser` | 55.0.11-canary | Open directions, service websites |
| `expo-image` | 55.0.7-canary | Optimized images (use instead of `<Image>`) |
| `expo-splash-screen` | 55.0.14-canary | Hold splash until DB initialized |
| `react-native-reanimated` | 4.2.1 | Bottom sheets, animated markers |
| `react-native-gesture-handler` | 2.30.0 | Swipe gestures, bottom sheet drag |
| `react-native-safe-area-context` | 5.6.2 | Safe area padding for notch/bottom bar |
| `react-native-screens` | 4.23.0 | Native screen containers for router |
