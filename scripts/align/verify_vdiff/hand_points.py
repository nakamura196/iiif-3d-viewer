"""目で打った対応点（hand_points.json）で、各方式のずれを測る。フローを使わない物差し。
usage: python hand_points.py SCRATCH ALIGN_JSON VDIFF_JSON OUT_JSON

B の点を各方式の B→A の変換で写し、A の点との距離（作業 px）を出す。
局所補正つきは、wb(x) = wb_sim(x + d(x)) なので、x + d(x) = M p_B となる x を反復で解く。
参考に「打った点そのものから最小二乗で求めた相似・アフィン・射影」も出す（点に合わせた最良の値。打点の誤差の下限の目安）。
"""
import json, sys
import cv2
import numpy as np
from measures import build_methods

S, ALIGN, VD, OUT = sys.argv[1:5]
here = sys.path[0]
pts = json.load(open(f"{here}/hand_points.json"))
meta = json.load(open(f"{here}/hand_sheets_meta.json"))
A_cur = json.load(open(f"{S}/data/A.json"))["selections"][0]["members"]
pairs_json = json.load(open(ALIGN))["pairs"]
vd = json.load(open(VD))


def bilinear(d, x, y):
    h, w = d.shape[:2]
    x = np.clip(x, 0, w - 1.001); y = np.clip(y, 0, h - 1.001)
    x0, y0 = int(x), int(y); fx, fy = x - x0, y - y0
    return (d[y0, x0] * (1 - fx) * (1 - fy) + d[y0, x0 + 1] * fx * (1 - fy)
            + d[y0 + 1, x0] * (1 - fx) * fy + d[y0 + 1, x0 + 1] * fx * fy)


def map_b(M, dense, persp, pb):
    q = M @ [pb[0], pb[1], 1.0]
    q = q[:2] / q[2] if persp else q[:2]
    if dense is None:
        return q
    x = q.copy()
    for _ in range(20):
        x = q - bilinear(dense, x[0], x[1])
    return x


rows = []
for n_s, lst in pts.items():
    if n_s.startswith("_"):
        continue
    n = int(n_s)
    a, b, methods, _ = build_methods(S, n, pairs_json[n - 1], A_cur[n - 1], vd, log=open("/dev/null", "w"))
    rec = {r["k"]: r for r in meta[n_s]}
    PA, PB, REG = [], [], []
    for k, au, av, bu, bv in lst:
        r = rec[k]
        PA.append((r["a_origin"][0] + au - 0.5, r["a_origin"][1] + av - 0.5))
        PB.append((r["b_origin"][0] + bu - 0.5, r["b_origin"][1] + bv - 0.5))
        REG.append(r["region"])
    PA, PB = np.array(PA), np.array(PB)
    for name, (M, dn, persp) in methods.items():
        for i, (pa, pb, reg) in enumerate(zip(PA, PB, REG)):
            q = map_b(M, dn, persp, pb)
            rows.append({"pair": n, "i": i, "method": name, "region": reg, "err": float(np.hypot(*(q - pa)))})
    # 点に合わせた最良（leave-one-out: 自分を除いた点で求めて、自分を測る）
    for name in ("fit_similarity", "fit_affine", "fit_homography"):
        for i in range(len(PA)):
            m = np.ones(len(PA), bool); m[i] = False
            if name == "fit_similarity":
                T, _ = cv2.estimateAffinePartial2D(PB[m], PA[m], method=cv2.LMEDS)
                q = T @ [*PB[i], 1]
            elif name == "fit_affine":
                T, _ = cv2.estimateAffine2D(PB[m], PA[m], method=cv2.LMEDS)
                q = T @ [*PB[i], 1]
            else:
                T, _ = cv2.findHomography(PB[m], PA[m], 0)
                q = T @ [*PB[i], 1]; q = q[:2] / q[2]
            rows.append({"pair": n, "i": i, "method": name, "region": REG[i], "err": float(np.hypot(*(q - PA[i])))})

json.dump(rows, open(OUT, "w"), indent=0)
order = ["sim", "affine", "vdiff600", "vdiff1000", "homog_ecc", "sim+warp", "fit_similarity", "fit_affine", "fit_homography"]
print(f"{'method':15s} {'n':>3s} {'all med':>8s} {'mean':>6s} {'p90':>6s} | {'text med':>8s} {'pic med':>8s}")
for m in order:
    e = np.array([r["err"] for r in rows if r["method"] == m])
    et = np.array([r["err"] for r in rows if r["method"] == m and r["region"] == "text"])
    ep = np.array([r["err"] for r in rows if r["method"] == m and r["region"] == "pic"])
    print(f"{m:15s} {len(e):3d} {np.median(e):8.2f} {e.mean():6.2f} {np.percentile(e, 90):6.2f} | {np.median(et):8.2f} {np.median(ep):8.2f}")
# 方式どうしの対の比較: 同じ点での差（局所補正 − 他方式）。負なら局所補正のほうが近い
E = {(r["method"], r["pair"], r["i"]): r["err"] for r in rows}
keys = sorted({(p, i) for (m, p, i) in E if m == "sim+warp"})
rng = np.random.default_rng(0)
for other in ("vdiff600", "vdiff1000", "homog_ecc", "affine"):
    d = np.array([E[("sim+warp", p, i)] - E[(other, p, i)] for p, i in keys if (other, p, i) in E])
    boot = [np.mean(rng.choice(d, len(d))) for _ in range(5000)]
    lo, hi = np.percentile(boot, [2.5, 97.5])
    print(f"sim+warp − {other:10s}: 平均 {d.mean():+.2f} px（95% 区間 {lo:+.2f}〜{hi:+.2f}）、局所補正が近い点 {int((d < 0).sum())} / 遠い点 {int((d > 0).sum())} / 同じ {int((d == 0).sum())}")
# 同じ組の点どうしは相関するので、組ごとにまとめて引き直す（こちらを本文に使う）
pairs = sorted({p for p, i in keys})
rng = np.random.default_rng(0)
for other in ("vdiff600", "vdiff1000", "homog_ecc", "affine"):
    d = {p: np.array([E[("sim+warp", p, i)] - E[(other, p, i)] for q, i in keys if q == p]) for p in pairs}
    boot = [np.concatenate([d[p] for p in rng.choice(pairs, len(pairs))]).mean() for _ in range(5000)]
    lo, hi = np.percentile(boot, [2.5, 97.5])
    print(f"sim+warp − {other:10s}（組単位）: 平均 {np.concatenate(list(d.values())).mean():+.2f} px（95% 区間 {lo:+.2f}〜{hi:+.2f}）")
