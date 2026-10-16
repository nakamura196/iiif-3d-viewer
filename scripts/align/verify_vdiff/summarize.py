"""検証用: eval_compare.py の metrics.json を集計して表示する。usage: python summarize.py metrics.json"""
import json, sys, numpy as np
d = json.load(open(sys.argv[1])); R = d["rows"]
M = ["sim", "affine", "sim+warp", "vdiff600", "vdiff1000", "homog_ecc"]
main = [r for r in R if r["pair"] != 55]
for reg in ("text", "pic", "face"):
    print(f"== {reg} (10 pairs: median over pairs of per-pair median / p90)")
    for m in M:
        rs = [r for r in main if r["method"] == m and r["region"] == reg]
        f = lambda k: np.median([r[k] for r in rs])
        print(f"{m:10s} far {f('far_med'):.2f}/{f('far_p90'):.2f}  raft {f('raft_med'):.2f}/{f('raft_p90'):.2f}  cham {f('cham_med'):.2f}/{f('cham_p90'):.2f}  absdiff {f('absdiff'):.4f} xor {f('xor'):.4f}")
print("== per pair raft_med text/pic")
for p in sorted({r["pair"] for r in R}):
    s = f"[{p}] rule={[r['rule'] for r in R if r['pair']==p][0]} "
    for m in M:
        t = [r for r in R if r["pair"] == p and r["method"] == m]
        if t:
            g = {r["region"]: r for r in t}
            s += f"{m}: {g['text']['raft_med']:.2f}/{g['pic']['raft_med']:.2f} "
    print(s)
print("== face")
for f in d["face"]: print({k: (round(v, 2) if isinstance(v, float) else v) for k, v in f.items()})
