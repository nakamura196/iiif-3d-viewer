#!/usr/bin/env python3
"""IIIF Curation の対応メンバー同士 (A[i] と B[i]) を位置合わせする。

前提: python3 + opencv(cv2 4.x) + numpy
  uv run --with opencv-python-headless --with numpy python scripts/align/align_curations.py A B OUT [--width 1000]
  A, B は Curation JSON の URL またはローカルパス (ローカル時は --a-url/--b-url で出力用 URL を指定)。OUT は出力 JSON。

処理: 各ペアの切り抜きを Image API で幅 W に縮小して取得 -> グレー化 ->
  AKAZE + ratio test + RANSAC で相似変換 (B -> A) を推定 -> ECC で微調整 ->
  素朴な「A の枠に B を中央フィット」基準より差分が小さければ採用、そうでなければ matrix: null。
  行列は切り抜きの原寸ピクセル座標 (左上原点) に変換して出力 (CSS matrix 順)。
"""
import argparse, hashlib, json, os, re, sys, time, urllib.request
import cv2
import numpy as np

CACHE = os.environ.get("ALIGN_CACHE", os.path.join(os.path.dirname(os.path.abspath(__file__)), ".cache"))
MIN_INLIERS = 12


def load_json(src):
    if re.match(r"https?://", src):
        with urllib.request.urlopen(src, timeout=60) as r:
            return json.load(r)
    return json.load(open(src))


def members(cur):
    return cur["selections"][0]["members"]


def parse(m):
    # サービス base と xywh を取り出す
    base = "/".join(m["thumbnail"].split("/")[:-4])
    xywh = [int(v) for v in m["@id"].split("#xywh=")[1].split(",")]
    return base, xywh


def fetch(base, xywh, width):
    # ディスクキャッシュ付きで取得 (逐次・丁寧に)
    url = f"{base}/{','.join(map(str, xywh))}/{width},/0/default.jpg"
    path = os.path.join(CACHE, hashlib.md5(url.encode()).hexdigest() + ".jpg")
    if not os.path.exists(path):
        os.makedirs(CACHE, exist_ok=True)
        for k in range(3):
            try:
                req = urllib.request.Request(url, headers={"User-Agent": "align-curations/1.0"})
                with urllib.request.urlopen(req, timeout=90) as r:
                    data = r.read()
                open(path, "wb").write(data)
                time.sleep(0.2)
                break
            except Exception as e:
                if k == 2:
                    raise
                time.sleep(2)
    return cv2.imread(path, cv2.IMREAD_GRAYSCALE)


def norm(g):
    # 1-99 パーセンタイルでコントラスト正規化
    lo, hi = np.percentile(g, [1, 99])
    return np.clip((g.astype(np.float32) - lo) / max(hi - lo, 1) * 255, 0, 255).astype(np.uint8)


def to3(m2):
    return np.vstack([m2, [0, 0, 1]])


def diff_score(a, b, m3):
    # b を a 空間へ移して平均絶対差 (0..1, 小さいほど良い)。枠外は白
    h, w = a.shape
    wb = cv2.warpAffine(b, m3[:2], (w, h), flags=cv2.INTER_AREA, borderValue=255)
    ga = cv2.GaussianBlur(a, (0, 0), 2)
    gb = cv2.GaussianBlur(wb, (0, 0), 2)
    return float(np.mean(np.abs(ga.astype(np.float32) - gb.astype(np.float32))) / 255)


def baseline(a, b):
    # A の枠に B をアスペクト維持で中央フィット
    ha, wa = a.shape
    hb, wb = b.shape
    s = min(wa / wb, ha / hb)
    return np.array([[s, 0, (wa - wb * s) / 2], [0, s, (ha - hb * s) / 2], [0, 0, 1]])


def features(a, b):
    det = cv2.AKAZE_create()
    ka, da = det.detectAndCompute(a, None)
    kb, db = det.detectAndCompute(b, None)
    if da is None or db is None or len(ka) < 8 or len(kb) < 8:
        return None, 0
    mt = cv2.BFMatcher(cv2.NORM_HAMMING).knnMatch(db, da, k=2)
    good = [p[0] for p in mt if len(p) == 2 and p[0].distance < 0.8 * p[1].distance]
    if len(good) < 6:
        return None, 0
    pb = np.float32([kb[g.queryIdx].pt for g in good])
    pa = np.float32([ka[g.trainIdx].pt for g in good])
    m, inl = cv2.estimateAffinePartial2D(pb, pa, method=cv2.RANSAC, ransacReprojThreshold=6, maxIters=5000, confidence=0.995)
    if m is None:
        return None, 0
    return to3(m), int(inl.sum())


def ecc(a, b, init):
    # ECC (ユークリッド+スケールは相似として扱えないので AFFINE) で微調整。失敗時は None
    try:
        w = init[:2].astype(np.float32).copy()
        crit = (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 100, 1e-5)
        ga = cv2.GaussianBlur(a, (0, 0), 2)
        gb = cv2.GaussianBlur(b, (0, 0), 2)
        _, w = cv2.findTransformECC(ga, gb, w, cv2.MOTION_AFFINE, crit, None, 5)
        return to3(w)
    except cv2.error:
        return None


def to_similarity(m3):
    # アフィンを最も近い相似変換へ射影 (回転+等方スケール)
    a, c, e = m3[0]
    b, d, f = m3[1]
    s = np.sqrt(abs(a * d - b * c))
    th = np.arctan2(b - c, a + d)
    return np.array([[s * np.cos(th), -s * np.sin(th), e], [s * np.sin(th), s * np.cos(th), f], [0, 0, 1]])


def align_pair(ga, gb):
    """作業解像度での 3x3 (B->A), inliers, before, after, 採用可否"""
    a, b = norm(ga), norm(gb)
    base = baseline(a, b)
    before = diff_score(a, b, base)
    cands = []
    m, inl = features(a, b)
    if m is not None:
        cands.append(m)
        r = ecc(a, b, m)
        if r is not None:
            cands.append(to_similarity(r))
    # フォールバック: 基準を初期値に ECC
    r = ecc(a, b, base)
    if r is not None:
        cands.append(to_similarity(r))
    best, bs = None, 9
    for c in cands:
        s = diff_score(a, b, c)
        sc = np.hypot(c[0, 0], c[1, 0])
        if 0.5 < sc / base[0, 0] < 2.0 and s < bs:
            best, bs = c, s
    ok = best is not None and inl >= MIN_INLIERS and bs < before * 0.97
    return best, inl, before, bs, ok


def local_warp(ga, gb, m, sigma, step):
    """相似変換のあとに残る、ゆっくり変わるゆがみ (紙の伸び縮み・版木の狂い)。
    密なオプティカルフローを墨の所の重みでぼかし、step 間隔の格子で返す (作業解像度の px)。
    格子点 p での値 d は「A の p には、相似変換で移した B の p + d を置く」を表す。
    ぼかしが大きいので、目や冠のような局所的な違いは消さない"""
    a, b = norm(ga), norm(gb)
    h, w = a.shape
    wb = cv2.warpAffine(b, m[:2], (w, h), flags=cv2.INTER_LINEAR, borderValue=255)
    dis = cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_MEDIUM)
    f = dis.calc(cv2.GaussianBlur(a, (0, 0), 1), cv2.GaussianBlur(wb, (0, 0), 1), None)
    # 両方に墨がある所だけで測る (片方にしかない線 = 版の違いや B の紙の外に引っぱられないように)
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
    both = cv2.dilate((a < 160).astype(np.uint8), k) & cv2.dilate((wb < 160).astype(np.uint8), k)
    inside = cv2.warpAffine(np.ones_like(b), m[:2], (w, h), flags=cv2.INTER_NEAREST, borderValue=0)
    inside = cv2.erode(inside, cv2.getStructuringElement(cv2.MORPH_RECT, (21, 21)))
    wgt = (both & inside).astype(np.float32)
    blur = lambda x: cv2.GaussianBlur(x, (0, 0), sigma)
    den = blur(wgt) + 1e-3
    fx, fy = blur(f[..., 0] * wgt) / den, blur(f[..., 1] * wgt) / den
    xs = np.minimum(np.arange(0, w + step, step), w - 1)
    ys = np.minimum(np.arange(0, h + step, step), h - 1)
    return xs, ys, fx[np.ix_(ys, xs)], fy[np.ix_(ys, xs)]


def flow_error(ga, gb, m, warp=None):
    """墨の所の残りのずれ (作業解像度の px、中央値)。評価用"""
    a, b = norm(ga), norm(gb)
    h, w = a.shape
    wb = cv2.warpAffine(b, m[:2], (w, h), flags=cv2.INTER_LINEAR, borderValue=255)
    if warp is not None:
        xs, ys, gx, gy = warp
        X, Y = np.meshgrid(np.arange(w, dtype=np.float32), np.arange(h, dtype=np.float32))
        dx = cv2.resize(gx.astype(np.float32), (w, h), interpolation=cv2.INTER_LINEAR)
        dy = cv2.resize(gy.astype(np.float32), (w, h), interpolation=cv2.INTER_LINEAR)
        wb = cv2.remap(wb, X + dx, Y + dy, cv2.INTER_LINEAR, borderValue=255)
    dis = cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_MEDIUM)
    f = dis.calc(cv2.GaussianBlur(a, (0, 0), 1), cv2.GaussianBlur(wb, (0, 0), 1), None)
    ink = (a < 128) & (wb < 200)
    return float(np.median(np.hypot(f[..., 0], f[..., 1])[ink])) if ink.any() else float("nan")


def r6(v):
    return float(f"{v:.6g}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("a")
    ap.add_argument("b")
    ap.add_argument("out")
    ap.add_argument("--width", type=int, default=1000)
    ap.add_argument("--a-url", help="出力に書く A の URL (ローカル読み込み時)")
    ap.add_argument("--b-url", help="出力に書く B の URL (ローカル読み込み時)")
    ap.add_argument("--warp-sigma", type=float, default=60, help="局所補正のぼかし幅 (作業解像度の px)。0 で局所補正なし")
    ap.add_argument("--warp-step", type=int, default=50, help="局所補正の格子の間隔 (作業解像度の px)")
    ap.add_argument("--dump", help="作業解像度の行列などを dump する JSON (デバッグ用)")
    args = ap.parse_args()
    A, B = members(load_json(args.a)), members(load_json(args.b))
    assert len(A) == len(B), "メンバー数が違う"
    pairs, dump = [], []
    for i, (ma, mb) in enumerate(zip(A, B)):
        ba, xa = parse(ma)
        bb, xb = parse(mb)
        ga, gb = fetch(ba, xa, args.width), fetch(bb, xb, args.width)
        m, inl, before, after, ok = align_pair(ga, gb)
        item = {"a": ma["@id"], "b": mb["@id"], "matrix": None, "inliers": inl,
                "score": {"before": round(before, 4), "after": round(after if m is not None else before, 4)}}
        if ok:
            # 原寸化: A_full = SA^-1 * M * SB * B_full
            sa = np.diag([ga.shape[1] / xa[2], ga.shape[0] / xa[3], 1])
            sb = np.diag([gb.shape[1] / xb[2], gb.shape[0] / xb[3], 1])
            F = np.linalg.inv(sa) @ m @ sb
            item["matrix"] = [r6(F[0, 0]), r6(F[1, 0]), r6(F[0, 1]), r6(F[1, 1]),
                              round(float(F[0, 2]), 2), round(float(F[1, 2]), 2)]
            if args.warp_sigma > 0:
                wp = local_warp(ga, gb, m, args.warp_sigma, args.warp_step)
                xs, ys, gx, gy = wp
                # 格子は A の切り出しの原寸 px で書く (作業解像度 -> 原寸)
                kx, ky = xa[2] / ga.shape[1], xa[3] / ga.shape[0]
                d = np.dstack([gx * kx, gy * ky]).reshape(-1)
                item["warp"] = {"x": [round(float(v * kx), 1) for v in xs],
                                "y": [round(float(v * ky), 1) for v in ys],
                                "d": [round(float(v), 1) for v in d]}
                item["residual"] = {"matrix": round(flow_error(ga, gb, m), 2),
                                    "warp": round(flow_error(ga, gb, m, wp), 2)}
        pairs.append(item)
        dump.append(None if m is None else m.tolist())
        print(i + 1, inl, item["score"], item.get("residual"), "OK" if ok else "null", file=sys.stderr, flush=True)
    out = {"a": args.a_url or args.a,
           "b": args.b_url or args.b,
           "model": "similarity" + ("+warp" if args.warp_sigma > 0 else ""),
           "note": ("matrix maps B crop pixels to A crop pixels: x' = m[0]*x + m[2]*y + m[4], y' = m[1]*x + m[3]*y + m[5] (CSS matrix order). "
                    "warp: a grid on A crop pixels (columns at x, rows at y); d holds dx,dy per node, row by row. "
                    "At A point p, show the B point that the matrix maps to p + d(p) (d interpolated bilinearly). "
                    "residual: median ink offset in working pixels (width " + str(args.width) + "), by dense optical flow."),
           "pairs": pairs}
    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    json.dump(out, open(args.out, "w"), ensure_ascii=False, separators=(",", ":"))


if __name__ == "__main__":
    main()
