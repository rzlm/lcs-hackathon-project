/**
 * Static snapshot of shelter_registry.csv — used as offline fallback.
 * Coordinates are merged in from the bundled shelters.json snapshot when
 * address matches are available, so markers can still render offline.
 */
import bundledShelters from '../../assets/data/shelters.json';
import type { Service } from '@/types/service';

type BundledShelter = {
  address: string | null;
  lat: number | null;
  lng: number | null;
};

const BUNDLED_SHELTERS = bundledShelters as BundledShelter[];

function normalizeAddress(value: string | null): string {
  return (value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

const COORDS_BY_ADDRESS = new Map(
  BUNDLED_SHELTERS
    .filter((row) => row.address && row.lat != null && row.lng != null)
    .map((row) => [normalizeAddress(row.address), { latitude: row.lat, longitude: row.lng }]),
);

type CsvRow = {
  id: string;
  name: string;
  organization_name: string;
  address_street: string | null;
  serves_men: boolean;
  serves_women: boolean;
  serves_youth: boolean;
  serves_families: boolean;
};

function row(
  id: string,
  name: string,
  org: string,
  address: string | null,
  men: boolean,
  women: boolean,
  youth: boolean,
  families: boolean,
): CsvRow {
  return { id, name, organization_name: org, address_street: address, serves_men: men, serves_women: women, serves_youth: youth, serves_families: families };
}

const CSV_ROWS: CsvRow[] = [
  row('csv-95',  'Mitchell Field Warming Centre',          'Dixon Hall',                                         '12 Holmes Ave',                  true,  true,  false, false),
  row('csv-57',  'Kennedy House Youth Shelter',            'Kennedy House Youth Services',                       '1076 Pape Ave',                  false, false, true,  false),
  row('csv-67',  "Margaret's Toronto East Drop-In",        "Margaret's Housing and Community Support Services",  '21 Park Rd',                     true,  true,  false, false),
  row('csv-1',   'Na-Me-Res',                              "Na-Me-Res (Native Men's Residence)",                 '26 Vaughan Rd',                  true,  false, false, false),
  row('csv-65',  'Sistering',                              "Sistering: A Women's Place",                         '962 Bloor St W',                 false, true,  false, false),
  row('csv-34',  'SVDP - Amelie House',                    'Society of St.Vincent De Paul',                      '126 Pape Ave',                   false, true,  false, false),
  row('csv-38',  'SVDP - Elisa House',                     'Society of St.Vincent De Paul',                      '60 Newcastle St',                false, true,  false, false),
  row('csv-37',  "SVDP - Mary's Home",                     'Society of St.Vincent De Paul',                      '70 Gerrard St E',                false, true,  false, false),
  row('csv-13',  'Horizons for Youth',                     'Horizon for Youth',                                  '422 Gilbert Ave',                false, false, true,  false),
  row('csv-12',  'Eagles Nest Transition House',           'Native Child & Family Services Toronto',             '111 Spadina Rd',                 false, false, true,  false),
  row('csv-31',  "SVDP - St. Clare's Residence",           'Society of St.Vincent De Paul',                      '3410 Bayview Ave',               false, true,  false, false),
  row('csv-68',  'HFS - Kennedy Shelter',                  'Homes First Society',                                '702 Kennedy Rd',                 false, true,  false, false),
  row('csv-24',  'HFS - Scarborough Shelter',              'Homes First Society',                                '5800 Yonge St',                  true,  false, false, false),
  row('csv-66',  'St. Felix Centre',                       'St. Felix Social Ministries Outreach',               '69 Fraser Ave',                  true,  true,  false, false),
  row('csv-99',  'Romero House',                           'Toronto Refugee Community Non-Profit Homes',         '2387 Dundas Street West',        true,  true,  false, true),
  row('csv-33',  'Turning Point Youth Services',           'Turning Point Youth Services',                       '95 Wellesley St E',              false, false, true,  false),
  row('csv-71',  'Scarborough Cold Weather Drop-IN',       'Warden Woods Community Centre',                      '705 Progress Ave',               true,  true,  false, false),
  row('csv-27',  "Nellie's",                               "Women's Hostels Inc.",                               null,                             false, true,  false, false),
  row('csv-7',   'Red Door Family Shelter',                'WoodGreen Red Door Family Shelter',                  '189B Booth Ave',                 true,  true,  false, true),
  row('csv-48',  'Toronto Community Hostel',               'Toronto Community Hostel',                           '191 Spadina Rd',                 true,  true,  false, true),
  row('csv-5',   'YMCA House',                             'YMCA of Greater Toronto',                            '7 Vanauley St',                  false, false, true,  false),
  row('csv-50',  'YWCA - First Stop Woodlawn',             'YWCA Toronto',                                       '80 Woodlawn Ave E',              false, false, true,  false),
  row('csv-78',  'YWCA-348 Davenport',                     'YWCA Toronto',                                       '348 Davenport Road',             false, false, true,  false),
  row('csv-52',  'Youth Without Shelter',                  'Youth Without Shelter',                              '6 Warrendale Ct',                false, false, true,  false),
  row('csv-64',  'YMCA Sprott House',                      'YMCA of Greater Toronto',                            '21 Walmer Rd',                   false, false, true,  false),
  row('csv-30',  "St. Simon's Shelter",                    "St. Simon's Shelter Inc.",                           '556 Sherbourne St',              true,  false, false, false),
  row('csv-36',  'Street Haven',                           'Street Haven At The Crossroads',                     '26 Gerrard St E',                false, true,  false, false),
  row('csv-98',  'Canadian Red Cross',                     'The Canadian Red Cross Society',                     '5515 Eglinton Ave West',         true,  true,  false, false),
  row('csv-47',  'Sojourn House',                          'The MUC Shelter Corporation',                        '101 Ontario St',                 true,  true,  false, true),
  row('csv-8',   "Scott Mission Men's Ministry",           'The Scott Mission Inc.',                             '346 Spadina Ave.',               true,  false, false, false),
  row('csv-28',  'Salvation Army - Evangeline Res',        'The Salvation Army of Canada',                       '2808 Dundas St W',               false, true,  false, false),
  row('csv-29',  'Salvation Army - Gateway',               'The Salvation Army of Canada',                       '107 Jarvis St',                  true,  false, false, false),
  row('csv-45',  'Salvation Army - Maxwell Meighen',       'The Salvation Army of Canada',                       '135 Sherbourne St',              true,  false, false, false),
  row('csv-73',  'Salvation Army - New Hope Leslie',       'The Salvation Army of Canada',                       '29A Leslie St',                  true,  false, false, false),
  row('csv-77',  'Salvation Army Islington Seniors',       'The Salvation Army of Canada',                       '2671 Islington Ave',             true,  false, false, false),
  row('csv-11',  'Salvation Army - Florence Booth',        'The Salvation Army of Canada',                       '66 Norfinch Dr',                 false, true,  false, false),
  row('csv-62',  'Fort York Residence',                    'City of Toronto',                                    '38 Bathurst St',                 true,  false, false, false),
  row('csv-94',  'Progress Shelter',                       'City of Toronto',                                    '705 Progress Ave',               true,  false, false, false),
  row('csv-54',  'Robertson House',                        'City of Toronto',                                    '291 Sherbourne St',              true,  true,  false, true),
  row('csv-82',  'SSHA Etobicoke Hotel Program',           'City of Toronto',                                    null,                             true,  true,  false, false),
  row('csv-3',   'Seaton House',                           'City of Toronto',                                    '339 George St',                  true,  false, false, false),
  row('csv-59',  'Scarborough Village Residence',          'City of Toronto',                                    '3306 Kingston Rd',               true,  true,  false, false),
  row('csv-6',   'Streets To Homes',                       'City of Toronto',                                    '129 Peter St',                   true,  true,  false, false),
  row('csv-2',   'Family Residence',                       'City of Toronto',                                    '4222 Kingston Rd',               true,  true,  false, true),
  row('csv-60',  'Downsview Dells',                        'City of Toronto',                                    '1651 Sheppard Ave W',            true,  false, false, false),
  row('csv-83',  'Expansion Sites',                        'City of Toronto',                                    '20 Milner Business Ct',          false, true,  false, false),
  row('csv-40',  'COSTI Reception Centre',                 'COSTI Immigrant Services',                           '55 Hallcrown Pl',                true,  true,  false, true),
  row('csv-39',  'Christie Refugee Welcome Centre',        'Christie Refugee Welcome Centre, Inc.',              '43 Christie St',                 true,  true,  false, true),
  row('csv-53',  'Birkdale Residence',                     'City of Toronto',                                    '885 Scarborough Golf Club Road', true,  true,  false, false),
  row('csv-22',  "Christie Ossington Men's Hostel",        'Christie Ossington Neighbourhood Centre',            '445 Rexdale Blvd',               true,  true,  false, false),
  row('csv-16',  'Good Shepherd Centre',                   'Good Shepherd Ministries',                           '412 Queen St E',                 true,  false, false, false),
  row('csv-41',  'Fife House Transitional Program',        'Fife House Foundation',                              '490 Sherbourne St',              true,  true,  false, false),
  row('csv-58',  "FV Women's Transition to Housing",       'Fred Victor Centre',                                 '512 Jarvis St',                  false, true,  false, false),
  row('csv-18',  "Eva's Place",                            "Eva's Initiatives",                                  '360 Lesmill Rd',                 false, false, true,  false),
  row('csv-42',  'Fred Victor Women\'s Hostel',            'Fred Victor Centre',                                 '1059 College Street',            false, true,  false, false),
  row('csv-72',  'Fred Victor-Better Living Centre',       'Fred Victor Centre',                                 "195 Princes' Blvd",              true,  true,  false, false),
  row('csv-85',  'Friends of Ruby',                        'Friends of Ruby',                                    null,                             false, false, true,  false),
  row('csv-44',  'Fred Victor, BUS',                       'Fred Victor Centre',                                 '1161 Caledonia Rd',              true,  true,  false, false),
  row('csv-19',  "Eva's Phoenix",                          "Eva's Initiatives",                                  '60 Brant St',                    false, false, true,  false),
  row('csv-100', 'Toronto Plaza',                          'City of Toronto',                                    '1677 Wilson Ave',                true,  true,  false, false),
  row('csv-4',   "Women's Residence",                      'City of Toronto',                                    '674 Dundas St W',                false, true,  false, false),
  row('csv-21',  'Cornerstone Place',                      'Cornerstone Place',                                  '616 Vaughan Rd',                 true,  false, false, false),
  row('csv-14',  'Dixon Hall - Schoolhouse',               'Dixon Hall',                                         '349 George St',                  true,  false, false, false),
  row('csv-80',  '351 Lakeshore Respite Services',         'Dixon Hall',                                         "195 Princes' Blvd",              true,  true,  false, false),
  row('csv-9',   'Dixon Hall - Heyworth House',            'Dixon Hall',                                         '354 George St',                  true,  true,  false, false),
  row('csv-20',  'Covenant House',                         'Covenant House Toronto',                             '20 Gerrard St E',                false, false, true,  false),
  row('csv-81',  'YouthLink Shelter',                      'YouthLink',                                          '747 Warden Ave',                 false, false, true,  false),
];

export const CSV_SHELTERS: Service[] = CSV_ROWS.map((r) => {
  const coords = COORDS_BY_ADDRESS.get(normalizeAddress(r.address_street));

  return {
    id: r.id,
    external_id: parseInt(r.id.replace('csv-', ''), 10),
    name: r.name,
    type: 'shelter',
    description: r.organization_name !== r.name ? `Operated by ${r.organization_name}` : null,
    latitude: coords?.latitude ?? null,
    longitude: coords?.longitude ?? null,
    address_street: r.address_street,
    phone: null,
    website: null,
    hours_json: null,
    is_24_hours: false,
    wheelchair_accessible: false,
    no_stairs: false,
    serves_men: r.serves_men,
    serves_women: r.serves_women,
    serves_youth: r.serves_youth,
    serves_families: r.serves_families,
    availability_score: null,
    availability_label: null,
    last_availability_at: null,
    is_bookmarked: false,
  };
});
