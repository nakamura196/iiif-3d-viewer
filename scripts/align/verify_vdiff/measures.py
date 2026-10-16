"""検証用の物差し（eval_compare.py と check_rulers.py / hand_points.py で共用）。"""
import sys
import cv2
import numpy as np

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


def farneback_vec(a, wb):
    return cv2.calcOpticalFlowFarneback(cv2.GaussianBlur(a, (0, 0), 1), cv2.GaussianBlur(wb, (0, 0), 1), None,
                                        0.5, 5, 21, 5, 7, 1.5, 0)


def farneback(a, wb):
    f = farneback_vec(a, wb)
    return np.hypot(f[..., 0], f[..., 1])


def raft_vec(a, wb):
    """(h, w, 2) のフロー。a の x の点が wb では x + f に見える。"""
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
    return f[:, :h, :w].transpose(1, 2, 0)


def raft(a, wb):
    f = raft_vec(a, wb)
    return None if f is None else np.hypot(f[..., 0], f[..., 1])


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




def build_methods(S, n, p, A_member, vd, log=sys.stderr):
    """組 n の A・B（幅 1000、濃淡を正規化）と、各方式の B→A の変換 {名前: (3×3 行列, 局所補正の変位, 射影か)} を返す。"""
    ga = cv2.imread(f"{S}/imgs/p{n:03d}_A_1000.jpg", cv2.IMREAD_GRAYSCALE)
    gb = cv2.imread(f"{S}/imgs/p{n:03d}_B_1000.jpg", cv2.IMREAD_GRAYSCALE)
    a, b = norm(ga), norm(gb)
    h, w = a.shape
    xa = xywh(A_member); xb = [int(v) for v in p["b"].split("#xywh=")[1].split(",")]
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
        print(n, vw, "vdiff matches", recs[0]["nmatch"], "deterministic", same, file=log)
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
        print(n, "ECC homography failed", e, file=log)

    # 参考: AKAZE + RANSAC のアフィン (公開版と同じ特徴点・同じ閾値で、自由度だけ増やす)
    det = cv2.AKAZE_create(); ka, da = det.detectAndCompute(a, None); kb, db = det.detectAndCompute(b, None)
    mt = cv2.BFMatcher(cv2.NORM_HAMMING).knnMatch(db, da, k=2)
    good = [q[0] for q in mt if len(q) == 2 and q[0].distance < 0.8 * q[1].distance]
    pb = np.float32([kb[g.queryIdx].pt for g in good]); pa = np.float32([ka[g.trainIdx].pt for g in good])
    Maff, _ = cv2.estimateAffine2D(pb, pa, method=cv2.RANSAC, ransacReprojThreshold=6, maxIters=5000, confidence=0.995)
    methods["affine"] = (np.vstack([Maff, [0, 0, 1]]), None, False)
    sx, sy = np.hypot(Maff[0, 0], Maff[1, 0]), np.hypot(Maff[0, 1], Maff[1, 1])
    print(n, "affine sx/sy", round(sx / sy, 4), file=log)
    return a, b, methods, sx / sy
