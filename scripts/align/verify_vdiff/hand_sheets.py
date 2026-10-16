"""手で打つ対応点の下ごしらえ: 組ごとに 8 か所（本文 4・絵 4）の A と B の切り抜きを、目盛り付きで拡大した一覧画像にする。
usage: python hand_sheets.py SCRATCH ALIGN_JSON OUTDIR

- 場所の候補は A の角（Shi-Tomasi）から、本文・絵をそれぞれ 2×2 に分けた各区画で一番強いものを機械的に選ぶ
- B の切り抜きの中心は、公開データの相似変換で A の候補点を B に写し、さらに切り抜きどうしの相関（テンプレート照合、整数 px）で
  ずらした所。窓を置くためだけに使う。点は人が打つ
- 切り抜きは 21×21 作業 px を 12 倍に拡大。目盛りは 1 px ごと（5 px ごとに濃く）。点は「切り抜きの左上からの座標」で読む
  （画素 k は目盛りの k から k+1 の間。画素の中心は k+0.5）
- 位置合わせの方式の結果は、どこにも描かない（打つ人がどの方式にも引っぱられないように）
"""
import json, os, sys
import cv2
import numpy as np
from measures import norm, xywh, rule_row

S, ALIGN, OUT = sys.argv[1:4]
os.makedirs(OUT, exist_ok=True)
PAIRS = [1, 9, 16, 19, 28, 40, 64, 83, 85, 99]
A_cur = json.load(open(f"{S}/data/A.json"))["selections"][0]["members"]
pairs_json = json.load(open(ALIGN))["pairs"]
WIN, Z = 21, 12
R = WIN // 2


def tile(img, cx, cy, label):
    h, w = img.shape
    x0, y0 = cx - R, cy - R
    crop = np.full((WIN, WIN), 255, np.uint8)
    sx0, sy0, sx1, sy1 = max(x0, 0), max(y0, 0), min(x0 + WIN, w), min(y0 + WIN, h)
    crop[sy0 - y0:sy1 - y0, sx0 - x0:sx1 - x0] = img[sy0:sy1, sx0:sx1]
    big = cv2.cvtColor(cv2.resize(crop, (WIN * Z, WIN * Z), interpolation=cv2.INTER_NEAREST), cv2.COLOR_GRAY2BGR)
    for k in range(0, WIN + 1):
        c = (40, 120, 255) if k % 5 == 0 else (200, 225, 255)
        cv2.line(big, (k * Z, 0), (k * Z, WIN * Z), c, 1)
        cv2.line(big, (0, k * Z), (WIN * Z, k * Z), c, 1)
    pad = cv2.copyMakeBorder(big, 22, 4, 22, 4, cv2.BORDER_CONSTANT, value=(255, 255, 255))
    for k in range(0, WIN + 1, 5):
        cv2.putText(pad, str(k), (22 + k * Z - 6, 15), cv2.FONT_HERSHEY_SIMPLEX, 0.38, (0, 0, 200), 1)
        cv2.putText(pad, str(k), (1, 22 + k * Z + 4), cv2.FONT_HERSHEY_SIMPLEX, 0.38, (0, 0, 200), 1)
    cv2.putText(pad, label, (24, 22 + WIN * Z - 6), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 140, 0), 2)
    return pad, (x0, y0)


meta = {}
for n in PAIRS:
    p = pairs_json[n - 1]
    a = norm(cv2.imread(f"{S}/imgs/p{n:03d}_A_1000.jpg", cv2.IMREAD_GRAYSCALE))
    b = norm(cv2.imread(f"{S}/imgs/p{n:03d}_B_1000.jpg", cv2.IMREAD_GRAYSCALE))
    h, w = a.shape
    xa = xywh(A_cur[n - 1]); xb = [int(v) for v in p["b"].split("#xywh=")[1].split(",")]
    sa = np.diag([w / xa[2], h / xa[3], 1]); sb = np.diag([b.shape[1] / xb[2], b.shape[0] / xb[3], 1])
    m = p["matrix"]
    Msim = sa @ np.array([[m[0], m[2], m[4]], [m[1], m[3], m[5]], [0, 0, 1]]) @ np.linalg.inv(sb)
    r = rule_row(a)
    pts = []
    for reg, (ya, yb) in (("text", (60, r - 25)), ("pic", (r + 25, h - 60))):
        for j in range(2):
            for i in range(2):
                cx0, cx1 = 60 + i * (w - 120) // 2, 60 + (i + 1) * (w - 120) // 2
                cy0, cy1 = ya + j * (yb - ya) // 2, ya + (j + 1) * (yb - ya) // 2
                mask = np.zeros((h, w), np.uint8); mask[cy0:cy1, cx0:cx1] = 255
                c = cv2.goodFeaturesToTrack(a, 1, 0.01, 10, mask=mask, blockSize=7)
                if c is not None:
                    pts.append((reg, int(round(c[0, 0, 0])), int(round(c[0, 0, 1]))))
    tiles, rec = [], []
    Minv = np.linalg.inv(Msim)
    for k, (reg, x, y) in enumerate(pts):
        bx, by, _ = Minv @ [x, y, 1]
        bx, by = int(round(bx)), int(round(by))
        t = a[y - 12:y + 13, x - 12:x + 13]
        sy0, sx0 = max(by - 24, 0), max(bx - 24, 0)
        _, _, _, ml = cv2.minMaxLoc(cv2.matchTemplate(b[sy0:by + 25, sx0:bx + 25], t, cv2.TM_CCOEFF_NORMED))
        bx, by = sx0 + ml[0] + 12, sy0 + ml[1] + 12
        ta, oa = tile(a, x, y, f"{k} A {reg}")
        tb, ob = tile(b, bx, by, f"{k} B")
        tiles.append(np.hstack([ta, tb]))
        rec.append({"k": k, "region": reg, "a_origin": oa, "b_origin": ob})
    rows = [np.hstack(tiles[i:i + 2]) for i in range(0, len(tiles), 2)]
    cv2.imwrite(f"{OUT}/sheet_{n:03d}.png", np.vstack(rows))
    meta[n] = rec
    print(n, len(pts), file=sys.stderr)
json.dump(meta, open(f"{OUT}/sheets_meta.json", "w"), indent=1)
