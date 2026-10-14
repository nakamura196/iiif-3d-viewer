import { SAM2_FILES, SAM2_HOMEPAGE } from './sam2';
import type { InferenceModel } from './types';

// 画像の上をクリックすると、そこにある物の輪郭を SAM 2.1 tiny で取り、多角形の注釈にする。
// ボタンで 1 回走らせるのではなく、クリックのたびに走る（input: 'points'）。画像は画面に見えている部分だけを読むので、
// 拡大してからクリックすると細かい形まで取れる。同じ部分へのクリックは、2 回目から軽い処理だけで済む。
export const sam2Click: InferenceModel = {
  id: 'sam2-click',
  name: { ja: 'クリックで切り出す', en: 'Click to outline' },
  description: {
    ja: '画像の上の物をクリックすると、その形をなぞって輪郭の注釈にします。人物・建物・道具など、何にでも使えます。',
    en: 'Click on something in the image to trace its shape and mark it with an outline. Works on people, buildings, objects and more.',
  },
  license: 'Apache-2.0',
  credit: { ja: 'Meta（SAM 2.1）', en: 'Meta (SAM 2.1)' },
  homepage: SAM2_HOMEPAGE,
  files: SAM2_FILES,
  // 拡大して見ている部分を切り出すので、元の画像は大きめに取る
  imageLongSide: 3072,
  input: 'points',
  load: () => import('./sam2Click.run'),
};
