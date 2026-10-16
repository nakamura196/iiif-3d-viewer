"""位置合わせの独立評価: 公開中の相似 / 相似+局所補正 と vdiff.js (実物で取った射影行列) を比べる。
補正には DIS フローを使っているので、評価は Farneback・RAFT・輪郭のチャンファー距離で行う。
usage: python eval_align.py SCRATCH ALIGN_JSON VDIFF_JSON BOXES_JSON OUTDIR
"""
import json, os, sys
import cv2
import numpy as np

S, ALIGN, VD, BOXES, OUT = sys.argv[1:6]
os.makedirs(OUT, exist_ok=True)
PAIRS = [1, 9, 16, 19, 28, 40, 64, 83, 85, 99, 55]
A_cur = json.load(open(f"{S}/data/A.json"))["selections"][0]["members"]
pairs_json = json.load(open(ALIGN))["pairs"]
vd = json.load(open(VD))
boxes = {int(k): v for k, v in json.load(open(BOXES)).items()}

try:
    import torch
    from torchvision.models.optical_flow import raft_small, Raft_Small_Weights
    dev = "mps" if torch.backends.mps.is_available() else "cpu"
    RAFT = raft_small(weights=Raft_Small_Weights.DEFAULT).eval().to(dev)
except Exception as e:  # noqa
    print("RAFT unavailable:", e, file=sys.stderr)
    RAFT = None


def norm(g):
    lo, hi = np.percentile(g, [1, 99])
    return np.clip((g.astype(np.float32) - lo) / max(hi - lo, 1) * 255, 0, 255).astype(np.uint8)


def xywh(m):
    return [int(v) for v in m["@id"].split("#xywh=")[1].split(",")]


def dense_warp(warp, kx, ky, w, h):
    xs = np.array(warp["x"]) / kx
    ys = np.array(warp["y"]) / ky
    d = np.array(warp["d"]).reshape(len(ys), len(xs), 2)
    d = d / np.array([kx, ky])
    X = np.arange(w, dtype=np.float64)
    Y = np.arange(h, dtype=np.float64)
    rows = np.stack([np.stack([np.interp(X, xs, d[j, :, c]) for c in (0, 1)], -1) for j in range(len(ys))])  # (ny,w,2)
    out = np.empty((h, w, 2))
    for c in (0, 1):
        for i in range(w):
            out[:, i, c] = np.interp(Y, ys, rows[:, i, c])
    return out.astype(np.float32)


def apply(b, M3, w, h, dense=None, persp=False):
    if persp:
        wb = cv2.warpPerspective(b, M3, (w, h), flags=cv2.INTER_LINEAR, borderValue=255)
        ins = cv2.warpPerspective(np.ones_like(b), M3, (w, h), flags=cv2.INTER_NEAREST, borderValue=0)
    else:
        wb = cv2.warpAffine(b, M3[:2], (w, h), flags=cv2.INTER_LINEAR, borderValue=255)
        ins = cv2.warpAffine(np.ones_like(b), M3[:2], (w, h), flags=cv2.INTER_NEAREST, borderValue=0)
    if dense is not None:
        Xg, Yg = np.meshgrid(np.arange(w, dtype=np.float32), np.arange(h, dtype=np.float32))
        wb = cv2.remap(wb, Xg + dense[..., 0], Yg + dense[..., 1], cv2.INTER_LINEAR, borderValue=255)
        ins = cv2.remap(ins, Xg + dense[..., 0], Yg + dense[..., 1], cv2.INTER_NEAREST, borderValue=0)
    ins = cv2.erode(ins, cv2.getStructuringElement(cv2.MORPH_RECT, (21, 21)))
    return wb, ins.astype(bool)


def farneback(a, wb):
    f = cv2.calcOpticalFlowFarneback(cv2.GaussianBlur(a, (0, 0), 1), cv2.GaussianBlur(wb, (0, 0), 1), None,
                                     0.5, 5, 21, 5, 7, 1.5, 0)
    return np.hypot(f[..., 0], f[..., 1])


def raft(a, wb):
    if RAFT is None:
        return None
    h, w = a.shape
    H8, W8 = (h + 7) // 8 * 8, (w + 7) // 8 * 8
    def t(x):
        x = cv2.copyMakeBorder(x, 0, H8 - h, 0, W8 - w, cv2.BORDER_CONSTANT, value=255)
        x = torch.from_numpy(np.repeat(x[None].astype(np.float32), 3, 0) / 127.5 - 1)[None]
        return x.to(dev)
    with torch.no_grad():
        f = RAFT(t(a), t(wb), num_flow_updates=12)[-1][0].cpu().numpy()
    f = f[:, :h, :w]
    return np.hypot(f[0], f[1])


def chamfer(a, wb, region):
    ea = cv2.Canny(cv2.GaussianBlur(a, (0, 0), 1.5), 50, 150) > 0
    eb = cv2.Canny(cv2.GaussianBlur(wb, (0, 0), 1.5), 50, 150) > 0
    da = cv2.distanceTransform((~ea).astype(np.uint8), cv2.DIST_L2, 5)
    db = cv2.distanceTransform((~eb).astype(np.uint8), cv2.DIST_L2, 5)
    return np.concatenate([db[ea & region], da[eb & region]])


def stats(v):
    v = v[np.isfinite(v)]
    return (float(np.median(v)), float(np.percentile(v, 90))) if v.size else (np.nan, np.nan)


def rule_row(a):
    # 上段の注釈と下段 (和歌・人物) を分ける横罫。横に長い線だけを残してから一番濃い行を取る
    h, w = a.shape
    ink = (a < 160).astype(np.uint8)
    lines = cv2.morphologyEx(ink, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (81, 1)))
    prof = lines[200:min(650, h)].sum(1)
    return 200 + int(np.argmax(prof))


def overlay(a, wb):
    # A を赤チャンネル、B を緑・青: A にだけある墨 = シアン、B にだけある墨 = 赤、両方 = 黒
    return np.dstack([wb, wb, a])


rows_out, face_out, tiles = [], [], []
for n in PAIRS:
    p = pairs_json[n - 1]
    ga = cv2.imread(f"{S}/imgs/p{n:03d}_A_1000.jpg", cv2.IMREAD_GRAYSCALE)
    gb = cv2.imread(f"{S}/imgs/p{n:03d}_B_1000.jpg", cv2.IMREAD_GRAYSCALE)
    a, b = norm(ga), norm(gb)
    h, w = a.shape
    xa = xywh(A_cur[n - 1]); xb = [int(v) for v in p["b"].split("#xywh=")[1].split(",")]
    sa = np.diag([w / xa[2], h / xa[3], 1]); sb = np.diag([b.shape[1] / xb[2], b.shape[0] / xb[3], 1])
    m = p["matrix"]
    F = np.array([[m[0], m[2], m[4]], [m[1], m[3], m[5]], [0, 0, 1]])
    Msim = sa @ F @ np.linalg.inv(sb)
    kx, ky = xa[2] / w, xa[3] / h
    dense = dense_warp(p["warp"], kx, ky, w, h) if p.get("warp") else None
    methods = {"sim": (Msim, None, False), "sim+warp": (Msim, dense, False)}
    for vw in (600, 1000):
        recs = vd.get(f"{n}_{vw}") or []
        if not recs or not recs[0]["H"]:
            continue
        Hv = np.array(recs[0]["H"][0]).reshape(3, 3)
        same = all(np.allclose(np.array(r["H"][0]), recs[0]["H"][0]) for r in recs)
        a6 = cv2.imread(f"{S}/imgs/p{n:03d}_A_{vw}.jpg", cv2.IMREAD_GRAYSCALE)
        b6 = cv2.imread(f"{S}/imgs/p{n:03d}_B_{vw}.jpg", cv2.IMREAD_GRAYSCALE)
        SA = np.diag([a6.shape[1] / w, a6.shape[0] / h, 1]); SB = np.diag([b6.shape[1] / b.shape[1], b6.shape[0] / b.shape[0], 1])
        methods[f"vdiff{vw}"] = (np.linalg.inv(SA) @ Hv @ SB, None, True)
        print(n, vw, "vdiff matches", recs[0]["nmatch"], "deterministic", same, file=sys.stderr)
    # 射影変換の上限 (手で対応点を直した場合の目安): ECC で強度を合わせた最良の射影。
    # ECC は input(W x) ~ template(x) となる W (A->B) を返すので、初期値は B->A の逆、結果も逆にして B->A に戻す
    try:
        init = np.linalg.inv(methods.get("vdiff1000", (Msim,))[0])
        init = (init / init[2, 2]).astype(np.float32)
        crit = (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 200, 1e-6)
        _, Wab = cv2.findTransformECC(cv2.GaussianBlur(a, (0, 0), 2), cv2.GaussianBlur(b, (0, 0), 2), init,
                                      cv2.MOTION_HOMOGRAPHY, crit, None, 5)
        methods["homog_ecc"] = (np.linalg.inv(Wab.astype(np.float64)), None, True)
    except cv2.error as e:
        print(n, "ECC homography failed", e, file=sys.stderr)

    # 参考: AKAZE + RANSAC のアフィン (公開版と同じ特徴点・同じ閾値で、自由度だけ増やす)
    det = cv2.AKAZE_create(); ka, da = det.detectAndCompute(a, None); kb, db = det.detectAndCompute(b, None)
    mt = cv2.BFMatcher(cv2.NORM_HAMMING).knnMatch(db, da, k=2)
    good = [q[0] for q in mt if len(q) == 2 and q[0].distance < 0.8 * q[1].distance]
    pb = np.float32([kb[g.queryIdx].pt for g in good]); pa = np.float32([ka[g.trainIdx].pt for g in good])
    Maff, _ = cv2.estimateAffine2D(pb, pa, method=cv2.RANSAC, ransacReprojThreshold=6, maxIters=5000, confidence=0.995)
    methods["affine"] = (np.vstack([Maff, [0, 0, 1]]), None, False)
    sx, sy = np.hypot(Maff[0, 0], Maff[1, 0]), np.hypot(Maff[0, 1], Maff[1, 1])
    print(n, "affine sx/sy", round(sx / sy, 4), file=sys.stderr)
    r = rule_row(a)
    text = np.zeros((h, w), bool); text[:r - 8] = True
    pic = np.zeros((h, w), bool); pic[r + 8:] = True
    face = np.zeros((h, w), bool)
    x0, y0, x1, y1 = boxes[n]; face[y0:y1, x0:x1] = True
    warped = {}
    for name, (M, dn, persp) in methods.items():
        wb, ins = apply(b, M, w, h, dn, persp)
        warped[name] = wb
        ink = (a < 128) & (wb < 200) & ins
        fb = farneback(a, wb)
        rf = raft(a, wb)
        D = np.abs(cv2.GaussianBlur(a, (0, 0), 1).astype(np.float32) - cv2.GaussianBlur(wb, (0, 0), 1).astype(np.float32)) / 255
        xor = ((a < 128) ^ (wb < 128)) & ins
        for rn, reg in (("text", text), ("pic", pic), ("face", face)):
            rr = {"pair": n, "method": name, "region": rn, "rule": r}
            rr["far_med"], rr["far_p90"] = stats(fb[ink & reg])
            if rf is not None:
                rr["raft_med"], rr["raft_p90"] = stats(rf[ink & reg])
            rr["cham_med"], rr["cham_p90"] = stats(chamfer(a, wb, reg & ins))
            rr["absdiff"] = float(D[reg & ins].mean())
            rr["xor"] = float(xor[reg].mean())
            rows_out.append(rr)
    if dense is not None:
        mag = np.hypot(dense[..., 0], dense[..., 1])
        fd = dense[face]
        face_out.append({"pair": n, "warp_mag_face_mean": float(mag[face].mean()), "warp_mag_face_max": float(mag[face].max()),
                         "warp_face_spread": float(np.hypot(*(fd - fd.mean(0)).T).max()),
                         "warp_mag_pic_mean": float(mag[pic].mean()), "warp_mag_pic_p90": float(np.percentile(mag[pic], 90)),
                         "warp_mag_all_max": float(mag.max())})
    # 顔の切り出し: A / B(相似) / 相似 / 相似+局所 / vdiff600 / 射影上限
    mg = 30
    cy0, cy1, cx0, cx1 = max(y0 - mg, 0), min(y1 + mg, h), max(x0 - mg, 0), min(x1 + mg, w)
    cols = [cv2.cvtColor(a[cy0:cy1, cx0:cx1], cv2.COLOR_GRAY2BGR), cv2.cvtColor(warped["sim"][cy0:cy1, cx0:cx1], cv2.COLOR_GRAY2BGR)]
    for name in ("sim", "sim+warp", "vdiff600", "homog_ecc"):
        cols.append(overlay(a, warped[name])[cy0:cy1, cx0:cx1] if name in warped else np.full_like(cols[0], 255))
    row = np.hstack([cv2.copyMakeBorder(cv2.resize(c, (380, int(c.shape[0] * 380 / c.shape[1])), interpolation=cv2.INTER_CUBIC), 4, 4, 4, 4, cv2.BORDER_CONSTANT, value=(255, 255, 255)) for c in cols])
    cv2.putText(row, f"[{n}]", (10, 34), cv2.FONT_HERSHEY_SIMPLEX, 1.1, (0, 120, 0), 3)
    tiles.append(row)
    # 全体の重ね (相似 / 相似+局所 / vdiff600) を縮小で保存
    full = np.hstack([overlay(a, warped[k]) for k in ("sim", "sim+warp", "vdiff600") if k in warped])
    cv2.imwrite(f"{OUT}/full_{n:03d}.jpg", cv2.resize(full, None, fx=0.5, fy=0.5), [cv2.IMWRITE_JPEG_QUALITY, 85])
    print("done", n, file=sys.stderr, flush=True)

W = max(t.shape[1] for t in tiles)
sheet = np.vstack([cv2.copyMakeBorder(t, 0, 0, 0, W - t.shape[1], cv2.BORDER_CONSTANT, value=(255, 255, 255)) for t in tiles])
hdr = np.full((50, W, 3), 255, np.uint8)
for i, lab in enumerate(["A (hikime)", "B (similarity)", "similarity", "sim + local warp", "vdiff.js auto (600px)", "best homography (ECC)"]):
    cv2.putText(hdr, lab, (10 + i * 388, 34), cv2.FONT_HERSHEY_SIMPLEX, 0.75, (0, 0, 0), 2)
cv2.imwrite(f"{OUT}/faces_compare.jpg", np.vstack([hdr, sheet]), [cv2.IMWRITE_JPEG_QUALITY, 88])
json.dump({"rows": rows_out, "face": face_out}, open(f"{OUT}/metrics.json", "w"), indent=1)
