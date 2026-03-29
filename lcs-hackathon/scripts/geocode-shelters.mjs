/**
 * Geocode shelter addresses and update Supabase with lat/lng.
 *
 * Uses Nominatim (OpenStreetMap) — free, no API key, 1 req/sec rate limit.
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY (not the anon key — anon can't write).
 * Add it to .env.local:
 *   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
 *
 * Run:
 *   node scripts/geocode-shelters.mjs
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ── Load .env.local ──────────────────────────────────────────────────────────
function loadEnvFile(filePath) {
  try {
    const contents = readFileSync(filePath, 'utf8');
    for (const line of contents.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const k = trimmed.slice(0, eq).trim();
      const v = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (k && !(k in process.env)) process.env[k] = v;
    }
  } catch {
    // file not found — rely on env vars already in environment
  }
}

loadEnvFile(join(ROOT, '.env.local'));
loadEnvFile(join(ROOT, '.env'));

// ── Supabase client (service role — needed to write) ─────────────────────────
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    '\n❌  Missing env vars.\n' +
    '    Add to .env.local:\n' +
    '      EXPO_PUBLIC_SUPABASE_URL=...\n' +
    '      SUPABASE_SERVICE_ROLE_KEY=...\n' +
    '    (Find the service role key in Supabase → Project Settings → API)\n',
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

// ── Nominatim geocoder ───────────────────────────────────────────────────────
const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'lcs-homeless-services-directory/1.0 (geocode-script)';

async function geocode(address) {
  const query = `${address}, Toronto, Ontario, Canada`;
  const url = `${NOMINATIM}?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=ca`;

  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
  });

  if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`);

  const results = await res.json();
  if (!results.length) return null;

  return {
    latitude: parseFloat(results[0].lat),
    longitude: parseFloat(results[0].lon),
    display_name: results[0].display_name,
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('Fetching shelters without coordinates from Supabase…\n');

  const { data: shelters, error } = await supabase
    .from('shelters')
    .select('id, name, address_street')
    .is('latitude', null)
    .not('address_street', 'is', null)
    .order('name');

  if (error) {
    console.error('❌  Supabase error:', error.message);
    process.exit(1);
  }

  if (!shelters.length) {
    console.log('✅  All shelters already have coordinates.');
    return;
  }

  console.log(`Found ${shelters.length} shelters to geocode.\n`);

  let success = 0;
  let failed = 0;

  for (const shelter of shelters) {
    process.stdout.write(`  ${shelter.name} (${shelter.address_street}) … `);

    try {
      const coords = await geocode(shelter.address_street);

      if (!coords) {
        console.log('⚠️  no result');
        failed++;
      } else {
        const { error: updateError } = await supabase
          .from('shelters')
          .update({ latitude: coords.latitude, longitude: coords.longitude })
          .eq('id', shelter.id);

        if (updateError) {
          console.log(`❌  update failed: ${updateError.message}`);
          failed++;
        } else {
          console.log(`✅  ${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`);
          success++;
        }
      }
    } catch (err) {
      console.log(`❌  ${err.message}`);
      failed++;
    }

    // Nominatim requires max 1 req/sec
    await sleep(1100);
  }

  console.log(`\nDone. ${success} updated, ${failed} failed.`);

  if (failed > 0) {
    console.log(
      '\nFor shelters that failed to geocode, add coordinates manually:\n' +
      '  UPDATE shelters SET latitude=..., longitude=... WHERE name=\'...\';',
    );
  }
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
