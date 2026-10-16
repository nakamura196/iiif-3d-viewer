"""検証用: 比べる組の切り抜きを幅 1000 と 600 で取る。usage: python fetch_pairs.py SCRATCH (SCRATCH/data/{A,B}.json を置いておく)"""
import sys, json, os, shutil
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
os.environ.setdefault('ALIGN_CACHE', sys.argv[1] + '/cache')
import align_curations as ac
S = sys.argv[1]
A = ac.members(json.load(open(S + '/data/A.json'))); B = ac.members(json.load(open(S + '/data/B.json')))
PAIRS = [1, 9, 16, 19, 28, 40, 64, 83, 85, 99, 55]
for n in PAIRS:
    for tag, M in (('A', A), ('B', B)):
        base, xywh = ac.parse(M[n - 1])
        for w in (1000, 600):
            url = f"{base}/{','.join(map(str, xywh))}/{w},/0/default.jpg"
            ac.fetch(base, xywh, w)
            import hashlib
            p = os.path.join(ac.CACHE, hashlib.md5(url.encode()).hexdigest() + '.jpg')
            shutil.copy(p, f"{S}/imgs/p{n:03d}_{tag}_{w}.jpg")
    print(n, flush=True)
