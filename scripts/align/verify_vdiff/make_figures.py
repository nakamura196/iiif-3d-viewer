"""記事用の図を作る。
usage: python make_figures.py SCRATCH ALIGN_JSON VDIFF_JSON OUTDIR

overview.jpg   相似だけ／射影で重ねた全体と拡大（A だけの墨 = 青緑、B だけの墨 = 赤）
fields.jpg     相似と射影の差の変位、局所補正が足した変位（同じ組、矢印は拡大）
rulers.png     既知のずらしでの物差しの検査（rulers.json）
handsheet.jpg  対応点を打つための拡大図の例（hand_sheets.py の出力の上半分）
handpoints.png 対応点での方式ごとの誤差（hand_points_result.json）
"""
import json, sys
import cv2
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from measures import build_methods, apply

S, ALIGN, VD, OUT = sys.argv[1:5]
here = sys.path[0]
plt.rcParams["font.family"] = "Hiragino Sans"
A_cur = json.load(open(f"{S}/data/A.json"))["selections"][0]["members"]
pairs_json = json.load(open(ALIGN))["pairs"]
vd = json.load(open(VD))
NAMES = {"sim": "相似のみ", "affine": "アフィン", "vdiff600": "vdiff.js 幅600", "vdiff1000": "vdiff.js 幅1000",
         "homog_ecc": "射影の最良値", "sim+warp": "相似＋局所補正"}


def overlay(a, wb, ins):
    """A を R、B を G・B に入れる。A だけの墨は青緑、B だけの墨は赤、両方は黒。"""
    wb = np.where(ins, wb, 255)
    return np.dstack([wb, wb, a])  # OpenCV は BGR


# 1. 全体と拡大（[1]: 相似の残差が大きい組）
n = 1
a, b, methods, _ = build_methods(S, n, pairs_json[n - 1], A_cur[n - 1], vd, log=open("/dev/null", "w"))
h, w = a.shape
tiles = []
for key in ("sim", "homog_ecc"):
    M, dn, persp = methods[key]
    wb, ins = apply(b, M, w, h, None, persp)
    tiles.append(overlay(a, wb, ins))
x0, y0, cw = 40, 40, 260  # 左上の本文
fig, axs = plt.subplots(1, 4, figsize=(14, 5.4), gridspec_kw={"width_ratios": [w / h, w / h, 1, 1]})
for i, (t, lab) in enumerate(zip(tiles, ("相似で重ねる", "射影で重ねる"))):
    axs[i].imshow(t[..., ::-1]); axs[i].set_title(lab, fontsize=12)
    axs[i].add_patch(plt.Rectangle((x0, y0), cw, cw, fill=False, ec="#ff8c00", lw=2))
    axs[i + 2].imshow(t[y0:y0 + cw, x0:x0 + cw, ::-1], interpolation="nearest"); axs[i + 2].set_title(f"{lab}（枠内の拡大）", fontsize=12)
for ax in axs:
    ax.set_xticks([]); ax.set_yticks([])
fig.suptitle(f"[{n}] A だけの墨 = 青緑、B だけの墨 = 赤、両方の墨 = 黒", fontsize=12)
fig.tight_layout(); fig.savefig(f"{OUT}/overview.jpg", dpi=100, pil_kwargs={"quality": 88}); plt.close(fig)

# 2. 変位の場: 相似 → 射影の差と、局所補正が足した変位（A の座標で、B の同じ点がどこへ行くか）
Msim = methods["sim"][0]; Hh = methods["homog_ecc"][0]; dense = methods["sim+warp"][1]
Minv = np.linalg.inv(Msim)
ys, xs = np.mgrid[40:h - 40:60, 40:w - 40:60]
P = np.stack([xs.ravel(), ys.ravel(), np.ones(xs.size)])  # A 座標の格子
pb = Minv @ P  # 相似で対応する B の点
qh = Hh @ pb; qh = qh[:2] / qh[2]
d_proj = qh - P[:2]  # 射影で写すと、相似の位置からどれだけ動くか
d_warp = -np.array([dense[int(y), int(x)] for x, y in zip(P[0], P[1])]).T  # x = q − d(x) の近似
fig, axs = plt.subplots(1, 2, figsize=(10, 7.2))
K = 25
for ax, d, title in ((axs[0], d_proj, "射影 − 相似（B の同じ点の行き先の差）"), (axs[1], d_warp, "局所補正が足した変位")):
    ax.imshow(a, cmap="gray", alpha=0.35)
    ax.quiver(P[0], P[1], d[0] * K, d[1] * K, angles="xy", scale_units="xy", scale=1, color="#d62728", width=0.004)
    ax.set_title(title, fontsize=11); ax.set_xticks([]); ax.set_yticks([])
    mag = np.hypot(*d)
    ax.set_xlabel(f"中央値 {np.median(mag):.1f} px、最大 {mag.max():.1f} px（矢印は {K} 倍）", fontsize=10)
fig.suptitle(f"[{n}] 相似変換に足りない分を、射影と局所補正はどう埋めるか", fontsize=12)
fig.tight_layout(); fig.savefig(f"{OUT}/fields.jpg", dpi=110, pil_kwargs={"quality": 85}); plt.close(fig)

# 3. 物差しの検査
R = json.load(open(f"{here}/rulers.json"))["same"]
fig, ax = plt.subplots(figsize=(7, 5))
for key, lab, mk in (("raft_med", "RAFT", "o"), ("far_med", "Farneback", "s"), ("cham_med", "チャンファー", "^")):
    for kind, c in (("translate", "#1f77b4"), ("aniso", "#2ca02c"), ("smooth", "#d62728")):
        rs = [r for r in R if r["case"].startswith(kind)]
        ax.scatter([r["truth_med"] for r in rs], [r[key] for r in rs], marker=mk, color=c, s=36, alpha=0.8,
                   label=f"{lab}" if kind == "translate" else None, facecolors="none" if key == "cham_med" else c)
ax.plot([0, 5.2], [0, 5.2], color="gray", lw=1, ls="--")
ax.set_xlabel("正解の変位（中央値、作業 px）"); ax.set_ylabel("物差しが測った値（中央値）")
ax.set_xlim(-0.1, 5.2); ax.set_ylim(-0.1, 5.2)
h1 = [plt.Line2D([], [], marker=m, ls="", color="k", label=l, markerfacecolor="none" if l == "チャンファー" else "k")
      for m, l in (("o", "RAFT"), ("s", "Farneback"), ("^", "チャンファー"))]
h2 = [plt.Line2D([], [], marker="o", ls="", color=c, label=l)
      for c, l in (("#1f77b4", "平行移動"), ("#2ca02c", "縦横の倍率差 1.015"), ("#d62728", "なめらかな変位 σ60"))]
ax.legend(handles=h1 + h2, fontsize=9, loc="upper left")
ax.set_title("既知のずらしで物差しを調べる（3 組）", fontsize=12)
fig.tight_layout(); fig.savefig(f"{OUT}/rulers.png", dpi=110); plt.close(fig)

# 4. 対応点を打つ拡大図（上半分 = 本文 4 か所ぶんのうち 2 行）
img = cv2.imread(f"{S}/hand/sheet_028.png")
cv2.imwrite(f"{OUT}/handsheet.jpg", img[: img.shape[0] // 2], [cv2.IMWRITE_JPEG_QUALITY, 88])

# 5. 対応点での誤差
rows = json.load(open(f"{here}/hand_points_result.json"))
order = ["sim", "affine", "vdiff600", "vdiff1000", "homog_ecc", "sim+warp"]
fig, ax = plt.subplots(figsize=(8, 4.6))
rng = np.random.default_rng(0)
for i, m in enumerate(order):
    e = np.array([r["err"] for r in rows if r["method"] == m])
    ax.scatter(i + rng.uniform(-0.18, 0.18, e.size), e, s=12, alpha=0.5, color="#1f77b4" if m != "sim+warp" else "#d62728")
    ax.hlines(np.median(e), i - 0.3, i + 0.3, color="k", lw=2)
    ax.text(i + 0.32, np.median(e), f"{np.median(e):.2f}", va="center", fontsize=9)
ax.set_xticks(range(len(order))); ax.set_xticklabels([NAMES[m] for m in order], fontsize=9)
ax.set_yscale("log"); ax.set_ylim(0.05, 15); ax.set_yticks([0.1, 0.2, 0.5, 1, 2, 5, 10]); ax.set_yticklabels(["0.1", "0.2", "0.5", "1", "2", "5", "10"])
ax.set_ylabel("対応点のずれ（作業 px）"); ax.set_title("目で打った 79 点で測ったずれ（横棒は中央値）", fontsize=12)
fig.tight_layout(); fig.savefig(f"{OUT}/handpoints.png", dpi=110); plt.close(fig)
print("done")
