"""Make a georef manifest with N synthetic points from geo-hongo-buildings.json (for measuring speed).

Image positions are random over the image; map positions come from an affine fit of the 27 real points,
so the overlay on the map still lines up. Usage: python3 make-georef-manifest.py N > out.json
"""
import json, random, sys
import numpy as np

n = int(sys.argv[1])
m = json.load(open('public/manifests/geo-hongo-buildings.json'))
canvas = m['items'][0]
body = canvas['annotations'][0]['items'][0]['body']
real = body['features']
A = np.array([[f['properties']['resourceCoords'][0], f['properties']['resourceCoords'][1], 1] for f in real], float)
L = np.array([f['geometry']['coordinates'] for f in real], float)
coef, *_ = np.linalg.lstsq(A, L, rcond=None)
rnd = random.Random(1)
w, h = canvas['width'], canvas['height']
feats = []
for i in range(n):
    x, y = rnd.uniform(0, w), rnd.uniform(0, h)
    lng, lat = np.array([x, y, 1]) @ coef
    feats.append({'type': 'Feature', 'id': f'p{i+1}', 'properties': {'resourceCoords': [round(x), round(y)], 'title': f'地点 {i+1}'},
                  'geometry': {'type': 'Point', 'coordinates': [round(lng, 7), round(lat, 7)]}})
body['features'] = feats
m['id'] = m['id'].replace('.json', f'-bench-{n}.json')
m['label'] = {'ja': [f'計測用 {n} 点'], 'en': [f'Benchmark {n} points']}
json.dump(m, sys.stdout, ensure_ascii=False)
