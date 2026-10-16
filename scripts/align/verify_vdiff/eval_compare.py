"""位置合わせの独立評価: 公開中の相似 / 相似+局所補正 と vdiff.js (実物で取った射影行列) を比べる。
補正には DIS フローを使っているので、評価は Farneback・RAFT・輪郭のチャンファー距離で行う。
usage: python eval_align.py SCRATCH ALIGN_JSON VDIFF_JSON BOXES_JSON OUTDIR
"""
import json, os, sys
import cv2
import numpy as np
from measures import RAFT, apply, farneback, raft, chamfer, stats, rule_row, build_methods

S, ALIGN, VD, BOXES, OUT = sys.argv[1:6]
os.makedirs(OUT, exist_ok=True)
PAIRS = [1, 9, 16, 19, 28, 40, 64, 83, 85, 99, 55]
A_cur = json.load(open(f"{S}/data/A.json"))["selections"][0]["members"]
pairs_json = json.load(open(ALIGN))["pairs"]
vd = json.load(open(VD))
boxes = {int(k): v for k, v in json.load(open(BOXES)).items()}

def overlay(a, wb):
    # A を赤チャンネル、B を緑・青: A にだけある墨 = シアン、B にだけある墨 = 赤、両方 = 黒
    return np.dstack([wb, wb, a])


rows_out, face_out, tiles = [], [], []
for n in PAIRS:
    p = pairs_json[n - 1]
    a, b, methods, _ = build_methods(S, n, p, A_cur[n - 1], vd)
    h, w = a.shape
    dense = methods["sim+warp"][1]
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
