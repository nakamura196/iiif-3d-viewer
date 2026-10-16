"""物差しの検査: ずれの量が分かっている人工の画像で、RAFT・Farneback・チャンファー距離・XOR が正しく測れるかを確かめる。
usage: python check_rulers.py SCRATCH ALIGN_JSON VDIFF_JSON OUT_JSON

(1) 同じ画像どうし: A の切り抜きを、分かっている変位 u(x) でずらしたものと比べる。
    wb(x) = a(x + u(x)) なので、正しい物差しは各画素で |u| を返す
    - 平行移動（斜め 45°）0〜5 px
    - 縦横の倍率差 1.015（ページの中心を固定。B の紙の縦横の縮みの差に相当）
    - なめらかなランダムの変位（σ60 px でぼかし、大きさの中央値を 1 px にそろえる。局所補正と同じ種類の動き）
(2) 違う版どうし: 射影の上限（ECC）で重ねた B に、さらに既知の平行移動を足す。版の違いがあっても、足したずれが測れるか
(3) 変換の向き: 既知の射影変換で A から作った B に、eval_compare.py と同じ ECC の手順をかけ、元の変換が戻るか
"""
import json, sys
import cv2
import numpy as np
from measures import norm, xywh, apply, farneback_vec, raft_vec, chamfer, stats

S, ALIGN, VD, OUT = sys.argv[1:5]
PAIRS = [1, 28, 64]
A_cur = json.load(open(f"{S}/data/A.json"))["selections"][0]["members"]
pairs_json = json.load(open(ALIGN))["pairs"]
vd = json.load(open(VD))


def shift(img, ux, uy, border=255):
    h, w = img.shape
    X, Y = np.meshgrid(np.arange(w, dtype=np.float32), np.arange(h, dtype=np.float32))
    return cv2.remap(img, X + ux, Y + uy, cv2.INTER_CUBIC, borderValue=border)


def measure(a, wb, ux, uy, ins):
    """物差しの値と、同じ画素での正解（|u|）を返す。"""
    ink = (a < 128) & (wb < 200) & ins
    truth = np.hypot(ux, uy) * np.ones_like(a, np.float32)
    r = {"truth_med": stats(truth[ink])[0], "truth_p90": stats(truth[ink])[1]}
    for name, fn in (("raft", raft_vec), ("far", farneback_vec)):
        f = fn(a, wb)
        mag = np.hypot(f[..., 0], f[..., 1])
        r[f"{name}_med"], r[f"{name}_p90"] = stats(mag[ink])
        # 向きつきの誤差: 物差しのベクトルと正解の変位 (-u: a の点は wb で x - u に見える) の差
        err = np.hypot(f[..., 0] + ux, f[..., 1] + uy)
        r[f"{name}_vecerr_med"] = stats(err[ink])[0]
    r["cham_med"], r["cham_p90"] = stats(chamfer(a, wb, ins))
    r["xor"] = float((((a < 128) ^ (wb < 128)) & ins).mean())
    return {k: round(v, 3) for k, v in r.items()}


def load(n):
    a = norm(cv2.imread(f"{S}/imgs/p{n:03d}_A_1000.jpg", cv2.IMREAD_GRAYSCALE))
    b = norm(cv2.imread(f"{S}/imgs/p{n:03d}_B_1000.jpg", cv2.IMREAD_GRAYSCALE))
    return a, b


res = {"same": [], "real": [], "direction": []}
rng = np.random.default_rng(0)
for n in PAIRS:
    a, b = load(n)
    h, w = a.shape
    ins = np.zeros((h, w), bool); ins[30:-30, 30:-30] = True
    cases = [(f"translate {t}", np.full((h, w), t / np.sqrt(2), np.float32), np.full((h, w), t / np.sqrt(2), np.float32))
             for t in (0, 0.25, 0.5, 1, 2, 3, 5)]
    X, Y = np.meshgrid(np.arange(w, dtype=np.float32), np.arange(h, dtype=np.float32))
    cases.append(("aniso 1.015", np.zeros((h, w), np.float32), ((Y - h / 2) * 0.015).astype(np.float32)))
    for amp in (1, 3):
        f = [cv2.GaussianBlur(rng.normal(size=(h, w)).astype(np.float32), (0, 0), 60) for _ in range(2)]
        m = np.median(np.hypot(*f))
        cases.append((f"smooth σ60 median {amp}", f[0] / m * amp, f[1] / m * amp))
    for name, ux, uy in cases:
        wb = shift(a, ux, uy)
        res["same"].append({"pair": n, "case": name, **measure(a, wb, ux, uy, ins)})
        print(n, name, res["same"][-1], file=sys.stderr, flush=True)

    # (2) 違う版: ECC の射影で重ねた B に、既知の平行移動を足す
    p = pairs_json[n - 1]
    xa = xywh(A_cur[n - 1]); xb = [int(v) for v in p["b"].split("#xywh=")[1].split(",")]
    Hv = np.array(vd[f"{n}_1000"][0]["H"][0]).reshape(3, 3)
    init = np.linalg.inv(Hv); init = (init / init[2, 2]).astype(np.float32)
    crit = (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 200, 1e-6)
    _, Wab = cv2.findTransformECC(cv2.GaussianBlur(a, (0, 0), 2), cv2.GaussianBlur(b, (0, 0), 2), init,
                                  cv2.MOTION_HOMOGRAPHY, crit, None, 5)
    wb0, insb = apply(b, np.linalg.inv(Wab.astype(np.float64)), w, h, None, True)
    for t in (0, 0.5, 1, 2, 3):
        ux = np.full((h, w), t, np.float32); uy = np.zeros((h, w), np.float32)
        wb = shift(wb0, ux, uy)
        ink = (a < 128) & (wb < 200) & insb
        r = {"pair": n, "added_x": t}
        for name, fn in (("raft", raft_vec), ("far", farneback_vec)):
            f = fn(a, wb)
            r[f"{name}_med"] = round(stats(np.hypot(f[..., 0], f[..., 1])[ink])[0], 3)
            r[f"{name}_mean_dx"] = round(float(f[..., 0][ink].mean()), 3)
        r["xor"] = round(float((((a < 128) ^ (wb < 128)) & insb).mean()), 4)
        res["real"].append(r)
        print(r, file=sys.stderr, flush=True)

    # (3) 向き: 既知の射影 Htrue (B→A) で A から B を作り、ECC の手順で Htrue が戻るか
    Htrue = np.array([[0.99, 0.01, 6.0], [-0.008, 1.004, -4.0], [1.5e-6, -1e-6, 1.0]])
    bsyn = cv2.warpPerspective(a, np.linalg.inv(Htrue), (w, h), flags=cv2.INTER_CUBIC, borderValue=255)
    init = np.eye(3, dtype=np.float32)
    _, Wab = cv2.findTransformECC(cv2.GaussianBlur(a, (0, 0), 2), cv2.GaussianBlur(bsyn, (0, 0), 2), init,
                                  cv2.MOTION_HOMOGRAPHY, crit, None, 5)
    Hest = np.linalg.inv(Wab.astype(np.float64)); Hest /= Hest[2, 2]
    corners = np.float32([[0, 0], [w, 0], [w, h], [0, h]]).reshape(-1, 1, 2)
    d_right = np.abs(cv2.perspectiveTransform(corners, Hest) - cv2.perspectiveTransform(corners, Htrue)).max()
    d_wrong = np.abs(cv2.perspectiveTransform(corners, Wab.astype(np.float64)) - cv2.perspectiveTransform(corners, Htrue)).max()
    wbs, inss = apply(bsyn, Hest, w, h, None, True)
    rr = raft_vec(a, wbs)
    ink = (a < 128) & (wbs < 200) & inss
    res["direction"].append({"pair": n, "corner_err_inv_used": round(float(d_right), 3),
                             "corner_err_if_not_inverted": round(float(d_wrong), 3),
                             "raft_med_after": round(stats(np.hypot(rr[..., 0], rr[..., 1])[ink])[0], 3)})
    print(res["direction"][-1], file=sys.stderr, flush=True)

json.dump(res, open(OUT, "w"), indent=1, ensure_ascii=False)
