# 公式と写しを、枠の重なり（IoU）で行を対応させて比べる。使い方: compare.py <official.json> <ours.json>
import json, sys, difflib
def box(q):
    xs=[p[0] for p in q]; ys=[p[1] for p in q]; return min(xs),min(ys),max(xs),max(ys)
def iou(a,b):
    ix=max(0,min(a[2],b[2])-max(a[0],b[0])); iy=max(0,min(a[3],b[3])-max(a[1],b[1])); i=ix*iy
    u=(a[2]-a[0])*(a[3]-a[1])+(b[2]-b[0])*(b[3]-b[1])-i; return i/u if u else 0
off=json.load(open(sys.argv[1])); ours=json.load(open(sys.argv[2]))
ob=[box(l['quad']) for l in off]
nb=[(l['x'],l['y'],l['x']+l['w'],l['y']+l['h']) for l in ours]
used=set(); same=0; diff=0; total=0; ious=[]; diffs=[]
for i,l in enumerate(off):
    total+=len(l['text'])
    best=max(((iou(ob[i],nb[j]),j) for j in range(len(nb)) if j not in used), default=(0,None))
    if best[0]<0.5: diff+=len(l['text']); diffs.append(('公式のみ',l['text'])); continue
    used.add(best[1]); ious.append(best[0]); t=ours[best[1]]['text']
    if t==l['text']: same+=1; continue
    sm=difflib.SequenceMatcher(None,l['text'],t)
    d=sum(max(i2-i1,j2-j1) for op,i1,i2,j1,j2 in sm.get_opcodes() if op!='equal'); diff+=d; diffs.append((l['text'],t))
for j,l in enumerate(ours):
    if j not in used: diffs.append(('写しのみ',l['text']))
print(f"行 {len(off)}/{len(ours)} 同じ行 {same} 字の差 {diff}/{total} ({100*diff/max(total,1):.2f}%) IoU 最小 {min(ious):.3f} 平均 {sum(ious)/len(ious):.3f}")
for d in diffs: print('  ', d)
