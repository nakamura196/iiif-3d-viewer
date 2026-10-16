# 公式 PaddleOCR（OCR パイプライン）で読み、行の四隅と文字を JSON にする。前処理（向き・ゆがみ・行の向き）は切る。
# 使い方: python -I ppocr-official.py <画像のフォルダ> <出力のフォルダ> <v5|v6> <名前>...（<名前>.jpg を読む）
# 同じ画素を写し側でも使えるよう、<名前>.<W>x<H>.rgba も書き出す。環境変数 BS で読み取りのまとめ数（既定 6）。
import json, sys
import cv2
from paddleocr import PaddleOCR
img_dir, out_dir, ver = sys.argv[1], sys.argv[2], sys.argv[3]
names = {'v6': ('PP-OCRv6_small_det', 'PP-OCRv6_small_rec'), 'v5': ('PP-OCRv5_mobile_det', 'PP-OCRv5_mobile_rec')}[ver]
kw = dict(engine='onnxruntime') if ver == 'v6' else {}
ocr = PaddleOCR(text_detection_model_name=names[0], text_recognition_model_name=names[1],
                use_doc_orientation_classify=False, use_doc_unwarping=False, use_textline_orientation=False, text_recognition_batch_size=int(__import__('os').environ.get('BS', '6')), **kw)
for name in sys.argv[4:]:
    img = cv2.imread(f'{img_dir}/{name}.jpg')
    rgba = cv2.cvtColor(img, cv2.COLOR_BGR2RGBA)
    h, w = img.shape[:2]
    rgba.tofile(f'{img_dir}/{name}.{w}x{h}.rgba')
    r = ocr.predict(img)[0]
    lines = [{'quad': [[int(x), int(y)] for x, y in p], 'text': t, 'score': float(s)}
             for p, t, s in zip(r['rec_polys'], r['rec_texts'], r['rec_scores'])]
    json.dump(lines, open(f'{out_dir}/{name}.official-{ver}-bs{__import__('os').environ.get('BS', '6')}.json', 'w'), ensure_ascii=False)
    print(name, ver, len(lines))
