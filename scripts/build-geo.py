#!/usr/bin/env python3
"""Builds Ghost Ticker's world map SVG and gazetteer from Natural Earth (public domain).
Source data: /workspace/games/ghostline-src/ne (same Natural Earth files used by Neon Dragnet)."""
import json, os, collections
NE = '/workspace/games/ghostline-src/ne'
OUT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W, H = 1000, 500
def X(lon): return (lon + 180) / 360 * W
def Y(lat): return (90 - lat) / 180 * H

# ---------- map ----------
countries = json.load(open(f'{NE}/ne_110m_admin_0_countries.geojson'))['features']
paths = []
for f in countries:
    g = f['geometry']; polys = g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]
    d = []
    for poly in polys:
        for ring in poly:
            pts, last = [], None
            for lon, lat in ring:
                p = (round(X(lon), 1), round(Y(lat), 1))
                if p != last: pts.append(p); last = p
            if len(pts) < 3: continue
            d.append('M' + 'L'.join(f'{a:g},{b:g}' for a, b in pts) + 'Z')
    if d: paths.append(''.join(d))
svg = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 500" preserveAspectRatio="xMidYMid meet">'
       '<path fill="#06231a" stroke="#34d399" stroke-opacity=".55" stroke-width=".5" stroke-linejoin="round" d="' + ''.join(paths) + '"/></svg>')
open(f'{OUT}/public/world.svg', 'w').write(svg)
print('world.svg', len(svg))

# ---------- gazetteer ----------
# level: 1 country, 2 state/region, 3 city
G = []
def add(name, lat, lon, level, aliases=(), country=None, amb=False, ctx=()):
    G.append({'n': name, 'a': list(aliases), 'x': round(X(lon), 1), 'y': round(Y(lat), 1), 'l': level, 'c': country, 'amb': amb, 'ctx': list(ctx)})

topo = json.load(open('/workspace/games/neon-dragnet/data/countries-lo.json'))['objects']['countries']['geometries']
ALIAS = {
 'USA': ['United States', 'United States of America'], 'GBR': ['United Kingdom', 'Britain', 'Great Britain', 'U.K.', 'England', 'Scotland', 'Wales', 'Northern Ireland', 'British'],
 'RUS': ['Russia', 'Russian', 'Kremlin', 'Moscow'], 'UKR': ['Ukraine', 'Ukrainian'], 'CHN': ['China', 'Chinese', 'Beijing'], 'PRK': ['North Korea', 'North Korean', 'Pyongyang'],
 'KOR': ['South Korea', 'South Korean', 'Seoul'], 'IRN': ['Iran', 'Iranian', 'Tehran'], 'ISR': ['Israel', 'Israeli'], 'SYR': ['Syria', 'Syrian'], 'IRQ': ['Iraq', 'Iraqi'],
 'AFG': ['Afghanistan', 'Afghan', 'Taliban'], 'PAK': ['Pakistan', 'Pakistani'], 'IND': ['India', 'Indian'], 'JPN': ['Japan', 'Japanese'], 'TWN': ['Taiwan', 'Taiwanese'],
 'MEX': ['Mexico', 'Mexican'], 'CAN': ['Canada', 'Canadian'], 'BRA': ['Brazil', 'Brazilian'], 'ARG': ['Argentina', 'Argentine', 'Argentinian'], 'VEN': ['Venezuela', 'Venezuelan'],
 'COL': ['Colombia', 'Colombian'], 'CUB': ['Cuba', 'Cuban'], 'FRA': ['France', 'French'], 'DEU': ['Germany', 'German'], 'ITA': ['Italy', 'Italian'], 'ESP': ['Spain', 'Spanish'],
 'POL': ['Poland'], 'TUR': ['Türkiye', 'Turkish'], 'SAU': ['Saudi Arabia', 'Saudi'], 'ARE': ['United Arab Emirates', 'UAE', 'Emirati'], 'EGY': ['Egypt', 'Egyptian'],
 'LBN': ['Lebanon', 'Lebanese', 'Hezbollah'], 'YEM': ['Yemen', 'Yemeni', 'Houthi', 'Houthis'], 'QAT': ['Qatar', 'Qatari'], 'NGA': ['Nigeria', 'Nigerian'], 'ZAF': ['South Africa', 'South African'],
 'AUS': ['Australia', 'Australian'], 'NZL': ['New Zealand'], 'IRL': ['Ireland', 'Irish'], 'NLD': ['Netherlands', 'Dutch'], 'BEL': ['Belgium', 'Belgian'], 'CHE': ['Switzerland', 'Swiss'],
 'SWE': ['Sweden', 'Swedish'], 'NOR': ['Norway', 'Norwegian'], 'FIN': ['Finland', 'Finnish'], 'DNK': ['Denmark', 'Danish'], 'GRC': ['Greece', 'Greek'], 'PRT': ['Portugal', 'Portuguese'],
 'HUN': ['Hungary', 'Hungarian'], 'ROU': ['Romania', 'Romanian'], 'SRB': ['Serbia', 'Serbian'], 'CZE': ['Czech Republic', 'Czechia', 'Czech'], 'AUT': ['Austria', 'Austrian'],
 'PHL': ['Philippines', 'Filipino'], 'VNM': ['Vietnam', 'Vietnamese'], 'THA': ['Thailand', 'Thai'], 'IDN': ['Indonesia', 'Indonesian'], 'MYS': ['Malaysia', 'Malaysian'],
 'ETH': ['Ethiopia', 'Ethiopian'], 'SDN': ['Sudan', 'Sudanese'], 'SSD': ['South Sudan'], 'SOM': ['Somalia', 'Somali'], 'KEN': ['Kenya', 'Kenyan'], 'COD': ['Democratic Republic of the Congo', 'DR Congo', 'DRC'],
 'COG': ['Republic of the Congo'], 'CIV': ["Ivory Coast", "Côte d'Ivoire"], 'PSX': ['Palestine', 'Palestinian', 'Palestinians'], 'GRL': ['Greenland'], 'HTI': ['Haiti', 'Haitian'],
 'PER': ['Peru', 'Peruvian'], 'CHL': ['Chile', 'Chilean'], 'ECU': ['Ecuador'], 'BOL': ['Bolivia'], 'MMR': ['Myanmar', 'Burma'], 'BGD': ['Bangladesh'], 'LKA': ['Sri Lanka'], 'NPL': ['Nepal'],
 'ARM': ['Armenia', 'Armenian'], 'AZE': ['Azerbaijan'], 'BLR': ['Belarus', 'Belarusian'], 'MDA': ['Moldova'], 'GEO': ['Georgian Dream'], 'JOR': ['Jordanian'], 'LBY': ['Libya', 'Libyan'],
 'MAR': ['Morocco', 'Moroccan'], 'DZA': ['Algeria'], 'TUN': ['Tunisia'], 'KAZ': ['Kazakhstan'], 'UZB': ['Uzbekistan'], 'MNG': ['Mongolia'], 'SGP': ['Singapore'], 'ISL': ['Iceland', 'Icelandic'],
 'UGA': ['Uganda'], 'RWA': ['Rwanda'], 'MLI': ['Mali'], 'NER': ['Niger'], 'BFA': ['Burkina Faso'], 'SEN': ['Senegal'], 'GHA': ['Ghana'], 'CMR': ['Cameroon'], 'ZWE': ['Zimbabwe'],
 'PAN': ['Panama'], 'NIC': ['Nicaragua'], 'GTM': ['Guatemala'], 'HND': ['Honduras'], 'SLV': ['El Salvador'], 'DOM': ['Dominican Republic'], 'JAM': ['Jamaica', 'Jamaican'], 'PRI': ['Puerto Rico'],
}
# Country names that collide with people, food, or US states: matched only with place context.
AMBIG = {'GEO': ['Tbilisi', 'Georgian Dream', 'Caucasus', 'Kobakhidze', 'South Ossetia', 'Abkhazia'],
         'JOR': ['Amman', 'Jordanian', 'King Abdullah', 'West Bank'], 'TCD': ["N'Djamena", 'Chadian'], 'TUR': ['Ankara', 'Istanbul', 'Erdogan', 'Turkish', 'Türkiye'],
         'NER': ['Niamey', 'Sahel'], 'GIN': ['Conakry'], 'CHL': ['Santiago', 'Chilean', 'Boric'], 'PAN': ['Panama Canal', 'Panamanian'], 'MLI': ['Bamako', 'Malian']}
seen = set()
for g in topo:
    p = g.get('properties') or {}
    a3, n = p.get('id'), p.get('n')
    if not n or p.get('lx') is None or a3 in seen: continue
    seen.add(a3)
    names = [n] + [x for x in ALIAS.get(a3, []) if x != n]
    add(n, p['ly'], p['lx'], 1, names[1:], a3, amb=a3 in AMBIG or n in ('Georgia', 'Jordan', 'Chad', 'Turkey', 'Guinea', 'Niger'), ctx=AMBIG.get(a3, []))
for extra in [('Gaza', 31.42, 34.37, 'PSX', ['Gaza Strip', 'Khan Younis', 'Rafah']), ('West Bank', 31.95, 35.25, 'PSX', ['Ramallah', 'Jenin']), ('Crimea', 45.2, 34.2, 'UKR', []),
              ('Hong Kong', 22.3, 114.17, 'CHN', []), ('Vatican', 41.9, 12.45, 'VAT', ['Vatican City', 'Holy See']), ('Kosovo', 42.6, 20.9, 'XKX', [])]:
    G.append({'n': extra[0], 'a': extra[4], 'x': round(X(extra[2]), 1), 'y': round(Y(extra[1]), 1), 'l': 2, 'c': extra[3], 'amb': False, 'ctx': []})

# US states (approximate geographic centers)
STATES = [('Alabama',32.8,-86.8),('Alaska',64.7,-152.0),('Arizona',34.3,-111.7),('Arkansas',34.9,-92.4),('California',37.2,-119.5),('Colorado',39.0,-105.5),('Connecticut',41.6,-72.7),
 ('Delaware',39.0,-75.5),('Florida',28.6,-82.4),('Georgia',32.7,-83.4),('Hawaii',20.8,-156.3),('Idaho',44.4,-114.6),('Illinois',40.0,-89.2),('Indiana',39.9,-86.3),('Iowa',42.1,-93.5),
 ('Kansas',38.5,-98.4),('Kentucky',37.5,-85.3),('Louisiana',31.1,-92.0),('Maine',45.4,-69.2),('Maryland',39.0,-76.8),('Massachusetts',42.3,-71.8),('Michigan',44.3,-85.4),
 ('Minnesota',46.3,-94.3),('Mississippi',32.7,-89.7),('Missouri',38.4,-92.5),('Montana',47.0,-109.6),('Nebraska',41.5,-99.8),('Nevada',39.3,-116.6),('New Hampshire',43.7,-71.6),
 ('New Jersey',40.2,-74.7),('New Mexico',34.4,-106.1),('New York State',42.9,-75.5),('North Carolina',35.6,-79.4),('North Dakota',47.5,-100.5),('Ohio',40.3,-82.8),('Oklahoma',35.6,-97.5),
 ('Oregon',43.9,-120.6),('Pennsylvania',40.9,-77.8),('Rhode Island',41.7,-71.5),('South Carolina',33.9,-80.9),('South Dakota',44.4,-100.2),('Tennessee',35.9,-86.4),('Texas',31.5,-99.3),
 ('Utah',39.3,-111.7),('Vermont',44.1,-72.7),('Virginia',37.5,-78.8),('Washington State',47.4,-120.5),('West Virginia',38.6,-80.6),('Wisconsin',44.6,-89.9),('Wyoming',43.0,-107.5)]
STATE_AMBIG = {'Georgia': ['Atlanta', 'Savannah', 'Kemp', 'Peach State'], 'Indiana': ['Indianapolis', 'Hoosier'], 'Virginia': ['Richmond', 'Youngkin', 'Spanberger'],
               'Montana': ['Helena', 'Billings', 'Bozeman'], 'Nevada': ['Las Vegas', 'Reno'], 'Carolina': []}
for n, lat, lon in STATES:
    al = []
    if n == 'New York State': al = ['New York state', 'upstate New York']
    if n == 'Washington State': al = ['Washington state']
    add(n, lat, lon, 2, al, 'USA', amb=n in STATE_AMBIG, ctx=STATE_AMBIG.get(n, []))

# Cities
places = json.load(open('/workspace/games/neon-dragnet/data/places.json'))
SKIP = {'Washington, D.C.', 'Kiev', 'Gaza', 'Tel Aviv-Yafo', 'Krakow', 'Hong Kong', 'Vatican City', 'Mexico City', 'New York', 'Guatemala', 'Panama City', 'Kuwait', 'Singapore',
        'Djibouti', 'Monaco', 'Luxembourg', 'San Marino', 'Andorra', 'Bahrain', 'Victoria', 'Kingston', 'Hamilton', 'Valletta', 'Male', 'Nice', 'Split', 'Mobile', 'Reading',
        'Florence', 'Of', 'Bath', 'Orange', 'Mary', 'Nelson', 'Lincoln', 'Concord', 'Independence', 'Surprise', 'Warren', 'Columbia', 'Aurora', 'Mesa', 'Irving', 'Gilbert', 'Garland',
        'Laredo', 'Plano', 'Hialeah', 'Fremont', 'Chandler', 'Henderson', 'Arlington', 'Anaheim', 'Riverside', 'Stockton', 'Toledo', 'Durham', 'Winston-Salem', 'Glendale',
        'Santa Ana', 'Corpus Christi', 'Lexington', 'Buffalo', 'Jersey City', 'St. Paul', 'Fort Wayne', 'Norfolk', 'Madison', 'Boise', 'Spokane', 'Tacoma', 'Lubbock', 'Reno',
        'Bakersfield', 'Fresno', 'Wichita', 'Omaha', 'Tulsa', 'Raleigh', 'Colorado Springs', 'Virginia Beach', 'Long Beach', 'Oakland', 'Mesa', 'Kansas City', 'Charlotte',
        'Austin', 'Jackson', 'Paris', 'Sydney', 'Houston', 'Dallas', 'Denver', 'Phoenix', 'Orlando', 'Washington', 'Richmond', 'Cleveland', 'Hyderabad', 'Brandon', 'Regina',
        'Halifax', 'Eugene', 'Salem', 'Santiago', 'Valencia', 'Cordoba', 'Córdoba', 'Leon', 'León', 'Merida', 'Mérida', 'Puebla', 'Guadalajara', 'Kingstown', 'Roseau', 'Castries',
        'Basseterre', 'Gary', 'Santos', 'Salvador', 'Lowell', 'Irvine', 'Everett', 'Columbus', 'Vitoria', 'Luan', 'Essen', 'Saidu', 'Hechi', 'Kalyan', 'Haora', 'Taian', 'Jinxi', 'Jianmen', 'Covington', 'Stamford', 'George Town', 'Georgetown', 'Santa Cruz', 'Joliet', 'Oceanside', 'Akron', 'Allentown', 'Bridgeport', 'Amaravati', 'Benoni', 'Shuyang', 'Xiantao', 'Wanzhou', 'Luzhou', 'Nanchong', 'Zhongli', 'Ganzhou', 'Linyi', 'Shangqiu', 'Nanyang', 'Xinyang', 'Datong', 'Anshan', 'Qiqihar', 'Daqing', 'Zaozhuang', 'Handan', 'Baotou', 'Xiangtan', 'Zibo', 'Taiyuan', 'Nassau', 'Belmopan', 'Apia', 'Palikir', 'Majuro', 'Funafuti', 'Tarawa', 'Melekeok', 'Ngerulmud', 'Vaduz', 'Bern', 'Victoria', 'Praia', 'Moroni', 'Lome', 'Lomé'}
# Person-name / team-name cities kept but matched only with place context.
CITY_AMBIG = {'Paris': ['France', 'French', 'Louvre', 'Eiffel', 'Macron'], 'Sydney': ['Australia', 'Bondi', 'NSW'], 'Houston': ['Texas', 'Harris County'], 'Dallas': ['Texas'],
              'Austin': ['Texas'], 'Denver': ['Colorado'], 'Phoenix': ['Arizona'], 'Orlando': ['Florida', 'Disney World'], 'Charlotte': ['North Carolina', 'Mecklenburg'],
              'Jackson': ['Mississippi'], 'Santiago': ['Chile', 'Chilean'], 'Washington': []}
cities = {}
for name, a3, lon, lat, pop, rank, cap in places:
    keep = cap == 2 or pop >= 1500000 or (a3 == 'USA' and pop >= 450000)
    if not keep or name in SKIP or len(name) < 4: continue
    if name in cities and cities[name][4] >= pop: continue
    cities[name] = (name, a3, lon, lat, pop)
CITY_ALIAS = {'Kobenhavn': ['Copenhagen'], 'Rangoon': ['Yangon'], 'Ft. Worth': ['Fort Worth'], 'Xian': ["Xi'an"], 'Ndjamena': ["N'Djamena"], 'El Giza': ['Giza'], 'Delhi': [],
              'St. Petersburg': ['Saint Petersburg'], 'Bengaluru': ['Bangalore'], 'Mumbai': ['Bombay'], 'Chattogram': ['Chittagong'], 'Sanaa': ["Sana'a"]}
CITY_CTX = {'Columbus': ['Ohio'], 'Birmingham': ['England', 'UK', 'Britain', 'West Midlands'], 'Alexandria': ['Egypt', 'Egyptian'], 'Portland': [], 'Hollywood': []}
for name, a3, lon, lat, pop in cities.values():
    add(name, lat, lon, 3, CITY_ALIAS.get(name, []), a3, amb=name in ('Birmingham', 'Alexandria'), ctx=CITY_CTX.get(name, []))
for name, lat, lon, a3, al, ctx in [
    ('Washington, D.C.', 38.9, -77.03, 'USA', ['Washington DC', 'Washington D.C.', 'D.C.'], []),
    ('Kyiv', 50.45, 30.52, 'UKR', ['Kiev'], []), ('Kraków', 50.06, 19.94, 'POL', ['Krakow', 'Cracow'], []), ('Tel Aviv', 32.08, 34.78, 'ISR', [], []), ('Mexico City', 19.43, -99.13, 'MEX', [], []),
    ('New York City', 40.71, -74.0, 'USA', ['New York', 'NYC', 'Manhattan', 'Brooklyn', 'Queens', 'the Bronx', 'Staten Island', 'Wall Street'], []),
    ('Kharkiv', 49.99, 36.23, 'UKR', [], []), ('Odesa', 46.48, 30.72, 'UKR', ['Odessa'], []), ('Zaporizhzhia', 47.84, 35.14, 'UKR', [], []), ('Kherson', 46.64, 32.61, 'UKR', [], []),
    ('Donbas', 48.0, 37.8, 'UKR', ['Donetsk', 'Luhansk'], []), ('Palm Beach', 26.7, -80.04, 'USA', ['Mar-a-Lago'], []), ('Silicon Valley', 37.39, -122.06, 'USA', [], []),
    ('Hollywood', 34.1, -118.33, 'USA', [], []), ('Las Vegas', 36.17, -115.14, 'USA', [], []), ('New Orleans', 29.95, -90.07, 'USA', [], []), ('Kansas City', 39.1, -94.58, 'USA', [], []),
    ('Paris', 48.86, 2.35, 'FRA', [], CITY_AMBIG['Paris']), ('Sydney', -33.87, 151.21, 'AUS', [], CITY_AMBIG['Sydney']), ('Houston', 29.76, -95.37, 'USA', [], CITY_AMBIG['Houston']),
    ('Dallas', 32.78, -96.8, 'USA', [], CITY_AMBIG['Dallas']), ('Austin', 30.27, -97.74, 'USA', [], CITY_AMBIG['Austin']), ('Denver', 39.74, -104.99, 'USA', [], CITY_AMBIG['Denver']),
    ('Phoenix', 33.45, -112.07, 'USA', [], CITY_AMBIG['Phoenix']), ('Orlando', 28.54, -81.38, 'USA', [], CITY_AMBIG['Orlando']), ('Charlotte', 35.23, -80.84, 'USA', [], CITY_AMBIG['Charlotte']),
    ('Santiago', -33.45, -70.67, 'CHL', [], CITY_AMBIG['Santiago']), ('Raleigh', 35.78, -78.64, 'USA', [], []), ('Omaha', 41.26, -95.93, 'USA', [], []), ('Tulsa', 36.15, -95.99, 'USA', [], []),
    ('Buffalo', 42.89, -78.88, 'USA', [], ['New York', 'Bills']), ('Minneapolis', 44.98, -93.27, 'USA', [], []), ('Uvalde', 29.21, -99.79, 'USA', [], []), ('Gaza City', 31.5, 34.47, 'PSX', [], []),
    ('Strait of Hormuz', 26.57, 56.25, None, ['Hormuz'], []), ('Red Sea', 20.0, 38.5, None, [], []), ('South China Sea', 12.0, 114.0, None, [], []), ('Taiwan Strait', 24.4, 119.5, None, [], []),
    ('Antarctica', -78.0, 20.0, None, [], [])]:
    G.append({'n': name, 'a': al, 'x': round(X(lon), 1), 'y': round(Y(lat), 1), 'l': 3 if name not in ('Donbas', 'Silicon Valley', 'Strait of Hormuz', 'Red Sea', 'South China Sea', 'Taiwan Strait', 'Antarctica') else 2,
              'c': a3, 'amb': bool(ctx), 'ctx': ctx})
# Federal landmarks: plotted at DC but ranked like a country-level hit so a more specific place wins.
G.append({'n': 'Washington, D.C.', 'a': ['White House', 'Capitol Hill', 'Pentagon', 'Oval Office', 'U.S. Capitol', 'U.S. Congress', 'U.S. Senate', 'Supreme Court'], 'x': round(X(-77.03), 1), 'y': round(Y(38.9), 1), 'l': 0.5, 'c': 'USA', 'amb': False, 'ctx': [], 'lm': True})
_seen=set(); G=[g for g in G if not ((g['n'],g['l']) in _seen or _seen.add((g['n'],g['l'])))]
for g in G:
    if g['n']=='Washington State': g['a']=['Washington state','Washington State']
    if g['n']=='Georgia' and g['l']==1: g['ctxOnly']=True
json.dump(G, open(f'{OUT}/lib/gazetteer.json', 'w'), ensure_ascii=False, separators=(',', ':'))
print('gazetteer', len(G), collections.Counter(g['l'] for g in G))
print(sorted(g['n'] for g in G if g['l'] == 3))
