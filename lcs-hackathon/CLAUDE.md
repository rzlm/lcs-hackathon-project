# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A cross-platform **Homeless Services Directory** app (iOS, Android, web) built with Expo 55 (canary), React 19, and TypeScript. The app helps users find shelters, warming/cooling centres, and other homeless services in Toronto.

## Commands

```bash
npm start          # Start Expo dev server (interactive — choose iOS/Android/web)
npm run ios        # iOS simulator
npm run android    # Android emulator
npm run web        # Web browser
npm run lint       # ESLint via Expo config
```

No test framework is configured yet.

## Architecture

### Stack
- **Expo Router** (file-based routing) with typed routes enabled
- **React Native Reanimated v4** for animations
- **Supabase** backend (PostgreSQL + Edge Functions in Deno) — planned, not yet implemented in `src/`
- **expo-sqlite** for offline-first mobile storage; IndexedDB/localStorage for web
- **react-native-maps** on mobile; **Leaflet.js** on web
- React Compiler (`reactCompiler: true` in app.json experiments)

### Data Flow
Toronto Open Data APIs (shelters, warming/cooling centres) → Supabase ingest Edge Functions (hourly cron) → PostgreSQL → REST API → mobile/web clients with local SQLite cache for offline use.

### Source Layout (`src/`)
- `app/` — Expo Router screens: `index.tsx` (home), `explore.tsx`, `_layout.tsx` (root with tab nav + theme provider)
- `components/` — Reusable UI: `ThemedText`, `ThemedView`, `Collapsible`, `AppTabs` (native + `.web.tsx` variant), `ExternalLink`, `AnimatedIcon` (native + `.web.tsx` variant)
- `hooks/` — `useTheme()`, `useColorScheme()` (native + `.web.ts` variant)
- `constants/theme.ts` — Color palette (light/dark), font families, spacing scale, layout constants

### Platform Variants
Expo resolves `.web.tsx` / `.web.ts` files over `.tsx` / `.ts` on web. Use this pattern for platform-divergent implementations (e.g., maps, native modules).

### Path Aliases
`@/*` resolves to `src/*`, `@/assets/*` resolves to `assets/*` (see `tsconfig.json`).

### Theming
All components use `useTheme()` to get colors. Theme tokens: `text`, `background`, `backgroundElement`, `backgroundSelected`, `textSecondary`. Dark/light mode switches automatically via system preference.

## Key Documentation

Detailed specs live in `docs/`:
- `IMPLEMENTATION.md` — Full system architecture, API design, offline strategy, SMS fallback flow, MVP vs roadmap
- `DATABASE_SCHEMA.md` — SQLite and Supabase schema
- `DATA_SOURCES.md` — Toronto Open Data API reference
- `FOLDER_STRUCTURE.md` — Intended directory layout as the app grows
- `superpowers/specs/2026-03-28-homeless-services-app-design.md` — Original design spec
