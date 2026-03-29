/**
 * Twilio SMS webhook — Vercel Serverless Function
 *
 * Setup:
 *   1. Add TWILIO_AUTH_TOKEN to Vercel env vars (enables signature validation)
 *   2. In Twilio console, set "A message comes in" webhook to:
 *      https://<your-app>.vercel.app/api/sms  (HTTP POST)
 *
 * Supported commands (case-insensitive):
 *   SHELTER            → top 3 shelters (all)
 *   SHELTER WOMEN      → top 3 women's shelters
 *   SHELTER MEN        → top 3 men's shelters
 *   SHELTER YOUTH      → top 3 youth shelters
 *   SHELTER FAMILIES   → top 3 family shelters
 *   HELP               → usage instructions
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { createHmac, timingSafeEqual } from 'node:crypto';

// ---------------------------------------------------------------------------
// Shelter data (from shelter_registry.csv)
// ---------------------------------------------------------------------------

type Shelter = {
  name: string;
  addr: string | null;
  men: boolean;
  women: boolean;
  youth: boolean;
  families: boolean;
};

const SHELTERS: Shelter[] = [
  { name: 'Mitchell Field Warming',    addr: '12 Holmes Ave',        men: true,  women: true,  youth: false, families: false },
  { name: 'Kennedy House Youth',       addr: '1076 Pape Ave',        men: false, women: false, youth: true,  families: false },
  { name: "Margaret's East Drop-In",   addr: '21 Park Rd',           men: true,  women: true,  youth: false, families: false },
  { name: 'Na-Me-Res',                 addr: '26 Vaughan Rd',        men: true,  women: false, youth: false, families: false },
  { name: 'Sistering',                 addr: '962 Bloor St W',       men: false, women: true,  youth: false, families: false },
  { name: 'SVDP Amelie House',         addr: '126 Pape Ave',         men: false, women: true,  youth: false, families: false },
  { name: 'SVDP Elisa House',          addr: '60 Newcastle St',      men: false, women: true,  youth: false, families: false },
  { name: "SVDP Mary's Home",          addr: '70 Gerrard St E',      men: false, women: true,  youth: false, families: false },
  { name: 'Horizons for Youth',        addr: '422 Gilbert Ave',      men: false, women: false, youth: true,  families: false },
  { name: 'Eagles Nest',               addr: '111 Spadina Rd',       men: false, women: false, youth: true,  families: false },
  { name: "SVDP St. Clare's",          addr: '3410 Bayview Ave',     men: false, women: true,  youth: false, families: false },
  { name: 'HFS Kennedy Shelter',       addr: '702 Kennedy Rd',       men: false, women: true,  youth: false, families: false },
  { name: 'HFS Scarborough',           addr: '5800 Yonge St',        men: true,  women: false, youth: false, families: false },
  { name: 'St. Felix Centre',          addr: '69 Fraser Ave',        men: true,  women: true,  youth: false, families: false },
  { name: 'Romero House',              addr: '2387 Dundas St W',     men: true,  women: true,  youth: false, families: true  },
  { name: 'Turning Point Youth',       addr: '95 Wellesley St E',    men: false, women: false, youth: true,  families: false },
  { name: 'Scarborough Cold Weather',  addr: '705 Progress Ave',     men: true,  women: true,  youth: false, families: false },
  { name: "Nellie's",                  addr: null,                   men: false, women: true,  youth: false, families: false },
  { name: 'Red Door Family',           addr: '189B Booth Ave',       men: true,  women: true,  youth: false, families: true  },
  { name: 'Toronto Community Hostel',  addr: '191 Spadina Rd',       men: true,  women: true,  youth: false, families: true  },
  { name: 'YMCA House',                addr: '7 Vanauley St',        men: false, women: false, youth: true,  families: false },
  { name: 'YWCA First Stop',           addr: '80 Woodlawn Ave E',    men: false, women: false, youth: true,  families: false },
  { name: 'YWCA 348 Davenport',        addr: '348 Davenport Rd',     men: false, women: false, youth: true,  families: false },
  { name: 'Youth Without Shelter',     addr: '6 Warrendale Ct',      men: false, women: false, youth: true,  families: false },
  { name: 'YMCA Sprott House',         addr: '21 Walmer Rd',         men: false, women: false, youth: true,  families: false },
  { name: "St. Simon's Shelter",       addr: '556 Sherbourne St',    men: true,  women: false, youth: false, families: false },
  { name: 'Street Haven',              addr: '26 Gerrard St E',      men: false, women: true,  youth: false, families: false },
  { name: 'Canadian Red Cross',        addr: '5515 Eglinton Ave W',  men: true,  women: true,  youth: false, families: false },
  { name: 'Sojourn House',             addr: '101 Ontario St',       men: true,  women: true,  youth: false, families: true  },
  { name: "Scott Mission Men's",       addr: '346 Spadina Ave',      men: true,  women: false, youth: false, families: false },
  { name: 'SA Evangeline Res',         addr: '2808 Dundas St W',     men: false, women: true,  youth: false, families: false },
  { name: 'SA Gateway',                addr: '107 Jarvis St',        men: true,  women: false, youth: false, families: false },
  { name: 'SA Maxwell Meighen',        addr: '135 Sherbourne St',    men: true,  women: false, youth: false, families: false },
  { name: 'SA New Hope Leslie',        addr: '29A Leslie St',        men: true,  women: false, youth: false, families: false },
  { name: 'SA Islington Seniors',      addr: '2671 Islington Ave',   men: true,  women: false, youth: false, families: false },
  { name: 'SA Florence Booth',         addr: '66 Norfinch Dr',       men: false, women: true,  youth: false, families: false },
  { name: 'Fort York Residence',       addr: '38 Bathurst St',       men: true,  women: false, youth: false, families: false },
  { name: 'Progress Shelter',          addr: '705 Progress Ave',     men: true,  women: false, youth: false, families: false },
  { name: 'Robertson House',           addr: '291 Sherbourne St',    men: true,  women: true,  youth: false, families: true  },
  { name: 'Seaton House',              addr: '339 George St',        men: true,  women: false, youth: false, families: false },
  { name: 'Scarborough Village Res',   addr: '3306 Kingston Rd',     men: true,  women: true,  youth: false, families: false },
  { name: 'Streets To Homes',          addr: '129 Peter St',         men: true,  women: true,  youth: false, families: false },
  { name: 'Family Residence',          addr: '4222 Kingston Rd',     men: true,  women: true,  youth: false, families: true  },
  { name: 'Downsview Dells',           addr: '1651 Sheppard Ave W',  men: true,  women: false, youth: false, families: false },
  { name: 'COSTI Reception Centre',    addr: '55 Hallcrown Pl',      men: true,  women: true,  youth: false, families: true  },
  { name: 'Christie Refugee Welcome',  addr: '43 Christie St',       men: true,  women: true,  youth: false, families: true  },
  { name: 'Birkdale Residence',        addr: '885 Scarborough Golf', men: true,  women: true,  youth: false, families: false },
  { name: 'Good Shepherd Centre',      addr: '412 Queen St E',       men: true,  women: false, youth: false, families: false },
  { name: 'Fife House Transitional',   addr: '490 Sherbourne St',    men: true,  women: true,  youth: false, families: false },
  { name: 'FV Women Transition',       addr: '512 Jarvis St',        men: false, women: true,  youth: false, families: false },
  { name: "Eva's Place",               addr: '360 Lesmill Rd',       men: false, women: false, youth: true,  families: false },
  { name: 'Fred Victor Women Hostel',  addr: '1059 College St',      men: false, women: true,  youth: false, families: false },
  { name: 'Fred Victor Better Living', addr: "195 Princes' Blvd",    men: true,  women: true,  youth: false, families: false },
  { name: 'Friends of Ruby',           addr: null,                   men: false, women: false, youth: true,  families: false },
  { name: 'Fred Victor BUS',           addr: '1161 Caledonia Rd',    men: true,  women: true,  youth: false, families: false },
  { name: "Eva's Phoenix",             addr: '60 Brant St',          men: false, women: false, youth: true,  families: false },
  { name: 'Toronto Plaza',             addr: '1677 Wilson Ave',      men: true,  women: true,  youth: false, families: false },
  { name: "Women's Residence",         addr: '674 Dundas St W',      men: false, women: true,  youth: false, families: false },
  { name: 'Cornerstone Place',         addr: '616 Vaughan Rd',       men: true,  women: false, youth: false, families: false },
  { name: 'Dixon Hall Schoolhouse',    addr: '349 George St',        men: true,  women: false, youth: false, families: false },
  { name: '351 Lakeshore Respite',     addr: "195 Princes' Blvd",    men: true,  women: true,  youth: false, families: false },
  { name: 'Dixon Hall Heyworth',       addr: '354 George St',        men: true,  women: true,  youth: false, families: false },
  { name: 'Covenant House',            addr: '20 Gerrard St E',      men: false, women: false, youth: true,  families: false },
  { name: 'YouthLink Shelter',         addr: '747 Warden Ave',       men: false, women: false, youth: true,  families: false },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

/**
 * Validates the X-Twilio-Signature header.
 * https://www.twilio.com/docs/usage/webhooks/webhooks-security
 */
function validateTwilioSignature(
  authToken: string,
  url: string,
  params: Record<string, string>,
  signature: string,
): boolean {
  const payload = Object.keys(params)
    .sort()
    .reduce((acc, key) => acc + key + params[key], url);

  const expected = createHmac('sha1', authToken).update(payload).digest('base64');

  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function twiml(message: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(message)}</Message></Response>`;
}

/** Truncate a string to `max` chars, appending … if needed. */
function trunc(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 1)}\u2026`;
}

// ---------------------------------------------------------------------------
// Response builder
// ---------------------------------------------------------------------------

const HELP_MSG =
  'HavenNow Shelters\n' +
  'Text: SHELTER, SHELTER WOMEN,\n' +
  'SHELTER MEN, SHELTER YOUTH,\n' +
  'or SHELTER FAMILIES';

const UNKNOWN_MSG =
  'Text SHELTER [WOMEN|MEN|YOUTH|FAMILIES]\n' +
  'to find shelters.\n' +
  'Text HELP for options.';

function buildResponse(rawBody: string): string {
  const body = rawBody.toUpperCase().trim().replace(/\s+/g, ' ');

  if (body === 'HELP') return HELP_MSG;

  if (!body.startsWith('SHELTER')) return UNKNOWN_MSG;

  type Filter = 'all' | 'women' | 'men' | 'youth' | 'families';
  let filter: Filter = 'all';
  let label = 'All';

  if (body.includes('WOMEN'))        { filter = 'women';    label = 'Women';    }
  else if (body.includes('MEN'))     { filter = 'men';      label = 'Men';      }
  else if (body.includes('YOUTH'))   { filter = 'youth';    label = 'Youth';    }
  else if (body.includes('FAMIL'))   { filter = 'families'; label = 'Families'; }

  const matches = SHELTERS.filter((s) => {
    if (filter === 'women')    return s.women;
    if (filter === 'men')      return s.men;
    if (filter === 'youth')    return s.youth;
    if (filter === 'families') return s.families;
    return true;
  }).slice(0, 3);

  if (matches.length === 0) {
    return `No shelters found for ${label}.\nText HELP for options.`;
  }

  const lines = matches.map((s, i) => {
    const name = trunc(s.name, 22);
    const addr = s.addr ? ` - ${trunc(s.addr, 18)}` : '';
    return `${i + 1}. ${name}${addr}`;
  });

  return [`HavenNow (${label}):`, ...lines, 'Text HELP for options'].join('\n');
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'text/plain' });
    res.end('Method Not Allowed');
    return;
  }

  const rawBody = await readBody(req);
  const params = Object.fromEntries(new URLSearchParams(rawBody));

  // Validate Twilio signature when TWILIO_AUTH_TOKEN is set.
  // Skip validation in local dev (env var absent) so you can test with curl.
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (authToken) {
    const signature = String(req.headers['x-twilio-signature'] ?? '');
    const proto = String(req.headers['x-forwarded-proto'] ?? 'https');
    const host = String(req.headers['host'] ?? '');
    const url = `${proto}://${host}/api/sms`;

    if (!validateTwilioSignature(authToken, url, params, signature)) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('Forbidden');
      return;
    }
  }

  const messageBody = String(params['Body'] ?? '');
  const reply = buildResponse(messageBody);

  res.writeHead(200, { 'Content-Type': 'text/xml; charset=utf-8' });
  res.end(twiml(reply));
}
