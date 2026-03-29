-- ============================================================
-- Migration: 20260328000000_init_schema
-- Homeless Services Directory — initial Supabase schema
-- ============================================================

-- ── Extensions ──────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- ── Shared trigger function ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ============================================================
-- TABLE: shelters
-- Master catalog of shelter locations.
-- Seeded from Toronto Open Data / CSV (shelter_registry.csv).
-- ============================================================
CREATE TABLE public.shelters (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Source system identity
  external_id           INTEGER UNIQUE,          -- SHELTER_ID from Toronto Open Data CSV
  organization_name     TEXT NOT NULL,           -- ORGANIZATION_NAME
  name                  TEXT NOT NULL,           -- SHELTER_GROUP (display name)

  -- Sector / population served
  -- Values from CSV: 'Men' | 'Women' | 'Youth' | 'Families' | 'Mixed Adult'
  sector                TEXT NOT NULL CHECK (sector IN (
    'Men', 'Women', 'Youth', 'Families', 'Mixed Adult'
  )),

  -- Derived boolean flags (populated from sector + manual data entry)
  serves_men            BOOLEAN DEFAULT true,
  serves_women          BOOLEAN DEFAULT true,
  serves_youth          BOOLEAN DEFAULT false,
  serves_families       BOOLEAN DEFAULT false,
  serves_seniors        BOOLEAN DEFAULT false,

  -- Location
  address_street        TEXT,                    -- LOCATION_ADDRESS
  address_city          TEXT DEFAULT 'Toronto',
  postal_code           TEXT,
  latitude              DOUBLE PRECISION,
  longitude             DOUBLE PRECISION,
  location              GEOMETRY(Point, 4326),   -- auto-populated by trigger

  -- Contact
  phone                 TEXT,
  website               TEXT,
  email                 TEXT,

  -- Hours
  hours_json            JSONB,                   -- {"mon":"8:00-20:00",...} or {"type":"24/7"}
  is_24_hours           BOOLEAN DEFAULT false,

  -- Accessibility
  wheelchair_accessible BOOLEAN DEFAULT false,
  no_stairs             BOOLEAN DEFAULT false,
  elevator_available    BOOLEAN DEFAULT false,
  hearing_loop          BOOLEAN DEFAULT false,
  visual_aids           BOOLEAN DEFAULT false,

  -- Capacity (updated via availability pipeline)
  total_capacity        INTEGER,
  current_occupancy     INTEGER,
  availability_score    DOUBLE PRECISION CHECK (availability_score BETWEEN 0 AND 1),
  availability_label    TEXT CHECK (availability_label IN (
    'available', 'limited', 'full', 'unknown'
  )) DEFAULT 'unknown',
  last_availability_at  TIMESTAMPTZ,

  -- Seasonal
  is_seasonal           BOOLEAN DEFAULT false,
  season_start_month    INTEGER CHECK (season_start_month BETWEEN 1 AND 12),
  season_end_month      INTEGER CHECK (season_end_month BETWEEN 1 AND 12),

  -- Status
  is_active             BOOLEAN DEFAULT true,
  description           TEXT,

  -- Data provenance
  data_source           TEXT DEFAULT 'toronto_open_data',
  source_url            TEXT,

  -- Timestamps
  created_at            TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at            TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes
CREATE INDEX idx_shelters_location     ON public.shelters USING GIST (location);
CREATE INDEX idx_shelters_sector       ON public.shelters (sector);
CREATE INDEX idx_shelters_active       ON public.shelters (is_active) WHERE is_active = true;
CREATE INDEX idx_shelters_external_id  ON public.shelters (external_id) WHERE external_id IS NOT NULL;
CREATE INDEX idx_shelters_updated_at   ON public.shelters (updated_at DESC);

-- Triggers
CREATE TRIGGER shelters_updated_at
  BEFORE UPDATE ON public.shelters
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.set_shelter_location()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
    NEW.location = ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER shelters_set_location
  BEFORE INSERT OR UPDATE OF latitude, longitude ON public.shelters
  FOR EACH ROW EXECUTE FUNCTION public.set_shelter_location();


-- ============================================================
-- TABLE: amenities
-- Catalog of amenity types available at shelters.
-- ============================================================
CREATE TABLE public.amenities (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL UNIQUE,   -- e.g. "Meals", "Laundry", "Showers"
  category    TEXT NOT NULL CHECK (category IN (
    'basic_needs', 'health', 'services', 'connectivity', 'storage', 'other'
  )),
  icon        TEXT,                   -- icon name/key for the UI
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Seed: common amenities
INSERT INTO public.amenities (name, category, icon) VALUES
  ('Meals',              'basic_needs',  'utensils'),
  ('Breakfast',          'basic_needs',  'coffee'),
  ('Showers',            'basic_needs',  'shower'),
  ('Laundry',            'basic_needs',  'washing-machine'),
  ('Clothing',           'basic_needs',  'shirt'),
  ('Beds/Overnight',     'basic_needs',  'bed'),
  ('Day Use Only',       'basic_needs',  'sun'),
  ('Lockers/Storage',    'storage',      'lock'),
  ('Baggage Storage',    'storage',      'archive'),
  ('Medical Care',       'health',       'stethoscope'),
  ('Mental Health',      'health',       'brain'),
  ('Addiction Support',  'health',       'heart-pulse'),
  ('Case Management',    'services',     'clipboard'),
  ('Legal Aid',          'services',     'scale'),
  ('Employment Help',    'services',     'briefcase'),
  ('ID/Document Help',   'services',     'id-card'),
  ('Wi-Fi',              'connectivity', 'wifi'),
  ('Computers',          'connectivity', 'monitor'),
  ('Phone Use',          'connectivity', 'phone'),
  ('Pet Friendly',       'other',        'paw-print'),
  ('Harm Reduction',     'health',       'shield'),
  ('Interpreter/Translation', 'services', 'languages');


-- ============================================================
-- TABLE: shelter_amenities
-- Junction: which amenities are available at which shelter.
-- ============================================================
CREATE TABLE public.shelter_amenities (
  shelter_id  UUID NOT NULL REFERENCES public.shelters(id) ON DELETE CASCADE,
  amenity_id  UUID NOT NULL REFERENCES public.amenities(id) ON DELETE CASCADE,
  notes       TEXT,    -- e.g. "Dinner only, 5–7pm"
  is_active   BOOLEAN DEFAULT true,
  PRIMARY KEY (shelter_id, amenity_id)
);

CREATE INDEX idx_shelter_amenities_shelter ON public.shelter_amenities (shelter_id);
CREATE INDEX idx_shelter_amenities_amenity ON public.shelter_amenities (amenity_id);


-- ============================================================
-- TABLE: users
-- App user profiles linked to Supabase Auth (auth.users).
-- Created automatically on first sign-in via trigger or Edge Function.
-- ============================================================
CREATE TABLE public.users (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name  TEXT,
  avatar_url    TEXT,
  -- Optional: anonymous device fingerprint if user later claims an account
  device_fingerprint TEXT,
  -- Role for moderation
  role          TEXT DEFAULT 'user' CHECK (role IN ('user', 'moderator', 'admin')),
  created_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create a public.users row when a new auth.users row is inserted
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ============================================================
-- TABLE: reviews
-- Star ratings + availability reports from app users.
-- Supports both authenticated users and anonymous (device fingerprint).
-- ============================================================
CREATE TABLE public.reviews (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shelter_id        UUID NOT NULL REFERENCES public.shelters(id) ON DELETE CASCADE,

  -- Author — one of these will be set
  user_id           UUID REFERENCES public.users(id) ON DELETE SET NULL,
  device_fingerprint TEXT,   -- used when not logged in

  -- Rating
  rating            INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),

  -- Availability signal
  was_available     BOOLEAN,           -- null = reviewer didn't check availability

  -- Comment
  comment_text      TEXT CHECK (length(comment_text) <= 500),

  -- Moderation
  is_flagged        BOOLEAN DEFAULT false,
  flag_count        INTEGER DEFAULT 0,
  is_hidden         BOOLEAN DEFAULT false,
  trust_score       DOUBLE PRECISION DEFAULT 0.5 CHECK (trust_score BETWEEN 0 AND 1),

  -- Spam detection
  ip_address_hash   TEXT,              -- SHA-256 of IP

  -- Timestamps
  created_at        TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at        TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- A user can only leave one review per shelter
  CONSTRAINT unique_user_review UNIQUE (user_id, shelter_id)
);

-- Indexes
CREATE INDEX idx_reviews_shelter_time  ON public.reviews (shelter_id, created_at DESC);
CREATE INDEX idx_reviews_user          ON public.reviews (user_id, created_at DESC);
CREATE INDEX idx_reviews_device        ON public.reviews (device_fingerprint, created_at DESC);
CREATE INDEX idx_reviews_flagged       ON public.reviews (is_flagged, flag_count DESC) WHERE is_flagged = true;
CREATE INDEX idx_reviews_visible       ON public.reviews (shelter_id, created_at DESC) WHERE is_hidden = false;

CREATE TRIGGER reviews_updated_at
  BEFORE UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.shelters         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.amenities        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shelter_amenities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews          ENABLE ROW LEVEL SECURITY;

-- ── Shelters ─────────────────────────────────────────────────
CREATE POLICY "shelters_public_read"
  ON public.shelters FOR SELECT USING (is_active = true);

CREATE POLICY "shelters_service_write"
  ON public.shelters FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── Amenities ────────────────────────────────────────────────
CREATE POLICY "amenities_public_read"
  ON public.amenities FOR SELECT USING (true);

CREATE POLICY "amenities_service_write"
  ON public.amenities FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── Shelter Amenities ─────────────────────────────────────────
CREATE POLICY "shelter_amenities_public_read"
  ON public.shelter_amenities FOR SELECT USING (true);

CREATE POLICY "shelter_amenities_service_write"
  ON public.shelter_amenities FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── Users ────────────────────────────────────────────────────
-- Users can read their own profile; admins/moderators can read all
CREATE POLICY "users_read_own"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "users_update_own"
  ON public.users FOR UPDATE
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE POLICY "users_service_all"
  ON public.users FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── Reviews ──────────────────────────────────────────────────
-- Anyone can read non-hidden reviews
CREATE POLICY "reviews_public_read"
  ON public.reviews FOR SELECT USING (is_hidden = false);

-- Authenticated users can insert their own review
CREATE POLICY "reviews_auth_insert"
  ON public.reviews FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update/delete their own review
CREATE POLICY "reviews_auth_update"
  ON public.reviews FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "reviews_auth_delete"
  ON public.reviews FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Service role (Edge Functions) can do anything (anon review submission, moderation)
CREATE POLICY "reviews_service_all"
  ON public.reviews FOR ALL TO service_role USING (true) WITH CHECK (true);


-- ============================================================
-- SEED: shelters from shelter_registry.csv
-- ============================================================
INSERT INTO public.shelters (external_id, organization_name, name, sector, address_street, serves_men, serves_women, serves_youth, serves_families) VALUES
  (95,  'Dixon Hall',                                        'Mitchell Field Warming Centre',          'Mixed Adult', '12 Holmes Ave',              true,  true,  false, false),
  (57,  'Kennedy House Youth Services',                      'Kennedy House Youth Shelter',            'Youth',       '1076 Pape Ave',              false, false, true,  false),
  (67,  'Margaret''s Housing and Community Support Services','Margaret''s Toronto East Drop-In',       'Mixed Adult', '21 Park Rd',                 true,  true,  false, false),
  (1,   'Na-Me-Res (Native Men''s Residence)',               'Na-Me-Res',                              'Men',         '26 Vaughan Rd',              true,  false, false, false),
  (65,  'Sistering: A Women''s Place',                       'Sistering',                              'Women',       '962 Bloor St W',             false, true,  false, false),
  (34,  'Society of St.Vincent De Paul',                     'SVDP - Amelie House',                    'Women',       '126 Pape Ave',               false, true,  false, false),
  (38,  'Society of St.Vincent De Paul',                     'SVDP - Elisa House',                     'Women',       '60 Newcastle St',            false, true,  false, false),
  (37,  'Society of St.Vincent De Paul',                     'SVDP - Mary''s Home',                    'Women',       '70 Gerrard St E',            false, true,  false, false),
  (13,  'Horizon for Youth',                                 'Horizons for Youth',                     'Youth',       '422 Gilbert Ave',            false, false, true,  false),
  (12,  'Native Child & Family Services Toronto',            'Eagles Nest Transition House',           'Youth',       '111 Spadina Rd',             false, false, true,  false),
  (31,  'Society of St.Vincent De Paul',                     'SVDP - St. Clare''s Residence',          'Women',       '3410 Bayview Ave',           false, true,  false, false),
  (68,  'Homes First Society',                               'HFS - Kennedy Shelter',                  'Women',       '702 Kennedy Rd',             false, true,  false, false),
  (24,  'Homes First Society',                               'HFS - Scarborough Shelter',              'Men',         '5800 Yonge St',              true,  false, false, false),
  (66,  'St. Felix Social Ministries Outreach',              'St. Felix Centre',                       'Mixed Adult', '69 Fraser Ave',              true,  true,  false, false),
  (99,  'Toronto Refugee Community Non-Profit Homes',        'Romero House',                           'Families',    '2387 Dundas Street West',    true,  true,  false, true),
  (33,  'Turning Point Youth Services',                      'Turning Point Youth Services',           'Youth',       '95 Wellesley St E',          false, false, true,  false),
  (71,  'Warden Woods Community Centre',                     'Scarborough Cold Weather Drop-IN',       'Mixed Adult', '705 Progress Ave',           true,  true,  false, false),
  (27,  'Women''s Hostels Inc.',                             'Nellie''s',                              'Women',       NULL,                         false, true,  false, false),
  (7,   'WoodGreen Red Door Family Shelter',                 'Red Door Family Shelter',                'Families',    '189B Booth Ave',             true,  true,  false, true),
  (48,  'Toronto Community Hostel',                          'Toronto Community Hostel',               'Families',    '191 Spadina Rd',             true,  true,  false, true),
  (5,   'YMCA of Greater Toronto',                           'YMCA House',                             'Youth',       '7 Vanauley St',              false, false, true,  false),
  (50,  'YWCA Toronto',                                      'YWCA - First Stop Woodlawn',             'Youth',       '80 Woodlawn Ave E',          false, false, true,  false),
  (78,  'YWCA Toronto',                                      'YWCA-348 Davenport',                     'Youth',       '348 Davenport Road',         false, false, true,  false),
  (52,  'Youth Without Shelter',                             'Youth Without Shelter',                  'Youth',       '6 Warrendale Ct',            false, false, true,  false),
  (64,  'YMCA of Greater Toronto',                           'YMCA Sprott House',                      'Youth',       '21 Walmer Rd',               false, false, true,  false),
  (30,  'St. Simon''s Shelter Inc.',                         'St. Simon''s Shelter',                   'Men',         '556 Sherbourne St',          true,  false, false, false),
  (36,  'Street Haven At The Crossroads',                    'Street Haven',                           'Women',       '26 Gerrard St E',            false, true,  false, false),
  (98,  'The Canadian Red Cross Society',                    'Canadian Red Cross',                     'Mixed Adult', '5515 Eglinton Ave West',     true,  true,  false, false),
  (47,  'The MUC Shelter Corporation',                       'Sojourn House',                          'Families',    '101 Ontario St',             true,  true,  false, true),
  (8,   'The Scott Mission Inc.',                            'Scott Mission Men''s Ministry',          'Men',         '346 Spadina Ave.',           true,  false, false, false),
  (28,  'The Salvation Army of Canada',                      'Salvation Army - Evangeline Res',        'Women',       '2808 Dundas St W',           false, true,  false, false),
  (29,  'The Salvation Army of Canada',                      'Salvation Army - Gateway',               'Men',         '107 Jarvis St',              true,  false, false, false),
  (45,  'The Salvation Army of Canada',                      'Salvation Army - Maxwell Meighen',       'Men',         '135 Sherbourne St',          true,  false, false, false),
  (73,  'The Salvation Army of Canada',                      'Salvation Army - New Hope Leslie',       'Men',         '29A Leslie St',              true,  false, false, false),
  (77,  'The Salvation Army of Canada',                      'Salvation Army Islington Seniors',       'Men',         '2671 Islington Ave',         true,  false, false, false),
  (11,  'The Salvation Army of Canada',                      'Salvation Army - Florence Booth',        'Women',       '66 Norfinch Dr',             false, true,  false, false),
  (62,  'City of Toronto',                                   'Fort York Residence',                    'Men',         '38 Bathurst St',             true,  false, false, false),
  (94,  'City of Toronto',                                   'Progress Shelter',                       'Men',         '705 Progress Ave',           true,  false, false, false),
  (54,  'City of Toronto',                                   'Robertson House',                        'Families',    '291 Sherbourne St',          true,  true,  false, true),
  (82,  'City of Toronto',                                   'SSHA Etobicoke Hotel Program',           'Mixed Adult', NULL,                         true,  true,  false, false),
  (3,   'City of Toronto',                                   'Seaton House',                           'Men',         '339 George St',              true,  false, false, false),
  (59,  'City of Toronto',                                   'Scarborough Village Residence',          'Mixed Adult', '3306 Kingston Rd',           true,  true,  false, false),
  (6,   'City of Toronto',                                   'Streets To Homes',                       'Mixed Adult', '129 Peter St',               true,  true,  false, false),
  (2,   'City of Toronto',                                   'Family Residence',                       'Families',    '4222 Kingston Rd',           true,  true,  false, true),
  (60,  'City of Toronto',                                   'Downsview Dells',                        'Men',         '1651 Sheppard Ave W',        true,  false, false, false),
  (83,  'City of Toronto',                                   'Expansion Sites',                        'Women',       '20 Milner Business Ct',      false, true,  false, false),
  (40,  'COSTI Immigrant Services',                          'COSTI Reception Centre',                 'Families',    '55 Hallcrown Pl',            true,  true,  false, true),
  (39,  'Christie Refugee Welcome Centre, Inc.',             'Christie Refugee Welcome Centre',        'Families',    '43 Christie St',             true,  true,  false, true),
  (53,  'City of Toronto',                                   'Birkdale Residence',                     'Mixed Adult', '885 Scarborough Golf Club Road', true, true, false, false),
  (22,  'Christie Ossington Neighbourhood Centre',           'Christie Ossington Men''s Hostel',       'Mixed Adult', '445 Rexdale Blvd',           true,  true,  false, false),
  (16,  'Good Shepherd Ministries',                          'Good Shepherd Centre',                   'Men',         '412 Queen St E',             true,  false, false, false),
  (41,  'Fife House Foundation',                             'Fife House Transitional Program',        'Mixed Adult', '490 Sherbourne St',          true,  true,  false, false),
  (58,  'Fred Victor Centre',                                'FV Women''s Transition to Housing',      'Women',       '512 Jarvis St',              false, true,  false, false),
  (18,  'Eva''s Initiatives',                                'Eva''s Place',                           'Youth',       '360 Lesmill Rd',             false, false, true,  false),
  (42,  'Fred Victor Centre',                                'Fred Victor Women''s Hostel',            'Women',       '1059 College Street',        false, true,  false, false),
  (72,  'Fred Victor Centre',                                'Fred Victor-Better Living Centre',       'Mixed Adult', '195 Princes'' Blvd',         true,  true,  false, false),
  (85,  'Friends of Ruby',                                   'Friends of Ruby',                        'Youth',       NULL,                         false, false, true,  false),
  (44,  'Fred Victor Centre',                                'Fred Victor, BUS',                       'Mixed Adult', '1161 Caledonia Rd',          true,  true,  false, false),
  (19,  'Eva''s Initiatives',                                'Eva''s Phoenix',                         'Youth',       '60 Brant St',                false, false, true,  false),
  (100, 'City of Toronto',                                   'Toronto Plaza',                          'Mixed Adult', '1677 Wilson Ave',            true,  true,  false, false),
  (4,   'City of Toronto',                                   'Women''s Residence',                     'Women',       '674 Dundas St W',            false, true,  false, false),
  (21,  'Cornerstone Place',                                 'Cornerstone Place',                      'Men',         '616 Vaughan Rd',             true,  false, false, false),
  (14,  'Dixon Hall',                                        'Dixon Hall - Schoolhouse',               'Men',         '349 George St',              true,  false, false, false),
  (80,  'Dixon Hall',                                        '351 Lakeshore Respite Services',         'Mixed Adult', '195 Princes'' Blvd',         true,  true,  false, false),
  (9,   'Dixon Hall',                                        'Dixon Hall - Heyworth House',            'Mixed Adult', '354 George St',              true,  true,  false, false),
  (20,  'Covenant House Toronto',                            'Covenant House',                         'Youth',       '20 Gerrard St E',            false, false, true,  false),
  (81,  'YouthLink',                                         'YouthLink Shelter',                      'Youth',       '747 Warden Ave',             false, false, true,  false);
