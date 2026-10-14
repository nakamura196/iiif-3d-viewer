import type { InferenceModel } from './types';

// 日本の絵画の顔の検出（YOLO11x を顔貌コレクションの顔で学習したもの。中村 覚）。face-web と同じモデルの fp16 版
// （重みだけ fp16 にして 228MB → 114MB。入出力は float32 のまま。fp32 版と枠の位置は 1 画素以内で一致）。
// 手順は core/features/inference/yolo.ts。
const REPO = 'https://huggingface.co/nakamura196/yolov11x-kaokore-face';
const REV = '526e7dbad7dd9310e7cbc7f9e33ea0facefdfc3a';

export const kaokoreFace: InferenceModel = {
  id: 'kaokore-face',
  name: { ja: '顔の検出（日本の絵画）', en: 'Faces in Japanese art' },
  description: {
    ja: '浮世絵・絵巻・近代の美人画などに描かれた顔を探して、枠で示します。',
    en: 'Finds the faces drawn in ukiyo-e, picture scrolls, modern bijin-ga and other Japanese art, and marks them with boxes.',
  },
  license: 'AGPL-3.0',
  credit: {
    ja: '中村 覚（顔貌コレクション〈CODH〉の顔で YOLO11x を学習）',
    en: 'Satoru Nakamura (YOLO11x trained on faces from the KaoKore dataset, CODH)',
  },
  homepage: 'https://huggingface.co/nakamura196/yolov11x-kaokore-face',
  files: [{ name: 'detector', url: `${REPO}/resolve/${REV}/best-fp16.onnx`, bytes: 114168230 }],
  // 全体で 1 回、1,280 角に切って 6 枚前後。人混みの小さな顔（長辺 2,560px で 40px 前後）は切らないと拾えない
  // （NDL 1301975「江戸名所」で 3 件 → 21 件、うち 19 件が顔）
  imageLongSide: 2560,
  load: () => import('./kaokoreFace.run'),
};
