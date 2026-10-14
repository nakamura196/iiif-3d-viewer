import { withBasePath } from '@/lib/basePath';

export type SampleKind = 'cookbook' | 'own';

export interface Sample {
  id: string;
  kind: SampleKind;
  media: 'image' | 'audio' | 'video' | '3d';
  title: { ja: string; en: string };
  note: { ja: string; en: string };
  manifest: string;
  // 開いたあとに選ぶタブ
  tab?: 'transcript' | 'annotations' | 'structure';
  // 出典ページ（Cookbook のレシピ）
  source?: string;
}

// recipe はフォルダ名（番号-名前）。番号だけの URL は 404 になる
const cookbook = (recipe: string) => `https://iiif.io/api/cookbook/recipe/${recipe}/v4/manifest.json`;
// v3 の版しか無いレシピ（v4/ は転送されるだけで実体が無い）
const cookbookV3 = (recipe: string) => `https://iiif.io/api/cookbook/recipe/${recipe}/manifest.json`;
const recipePage = (recipe: string) => `https://iiif.io/api/cookbook/recipe/${recipe}/`;

// IIIF Cookbook のレシピ（Presentation API 4.0 の版）と、このサイトの検査用マニフェスト。
export const SAMPLES: Sample[] = [
  {
    id: '0001', kind: 'cookbook', media: 'image',
    title: { ja: '画像 1 枚', en: 'Simplest image' },
    note: { ja: '画像 1 枚だけのマニフェスト', en: 'A manifest with a single image' },
    manifest: cookbook('0001-mvm-image'), source: recipePage('0001-mvm-image'),
  },
  {
    id: '0002', kind: 'cookbook', media: 'audio',
    title: { ja: '音声', en: 'Simplest audio' },
    note: { ja: '音声 1 本だけのマニフェスト', en: 'A manifest with a single audio file' },
    manifest: cookbook('0002-mvm-audio'), source: recipePage('0002-mvm-audio'),
  },
  {
    id: '0003', kind: 'cookbook', media: 'video',
    title: { ja: '動画', en: 'Simplest video' },
    note: { ja: '動画 1 本だけのマニフェスト', en: 'A manifest with a single video' },
    manifest: cookbook('0003-mvm-video'), source: recipePage('0003-mvm-video'),
  },
  {
    id: '0219', kind: 'cookbook', media: 'video',
    title: { ja: '動画と字幕', en: 'Video with captions' },
    note: { ja: '字幕ファイル（WebVTT）つきの動画', en: 'A video with a WebVTT caption file' },
    manifest: cookbook('0219-using-caption-file'), source: recipePage('0219-using-caption-file'),
  },
  {
    id: '0253', kind: 'cookbook', media: 'video',
    title: { ja: '動画と文字起こし', en: 'Video with transcript' },
    note: { ja: '時刻のない文字起こし（テキスト）つきの動画', en: 'A video with an untimed plain-text transcript' },
    manifest: cookbook('0253-using-transcript-file'), tab: 'transcript', source: recipePage('0253-using-transcript-file'),
  },
  {
    id: '0608', kind: 'cookbook', media: '3d',
    title: { ja: '3D モデル', en: '3D model' },
    note: { ja: '宇宙服の 3D モデル（読み込みに 15〜20 秒かかります）', en: 'A 3D model of a spacesuit (takes 15–20 seconds to load)' },
    manifest: cookbook('0608-mvm-3d'), source: recipePage('0608-mvm-3d'),
  },
  {
    id: '0015', kind: 'cookbook', media: 'image',
    title: { ja: '開始位置', en: 'Start canvas' },
    note: { ja: '最初に開く Canvas を指定する（start）', en: 'Opens on a chosen canvas (start)' },
    manifest: cookbookV3('0015-start'), source: recipePage('0015-start'),
  },
  {
    id: '0022', kind: 'cookbook', media: 'image',
    title: { ja: '画像内のリンク', en: 'Linking with a hotspot' },
    note: { ja: '画像の一部を押すと別のページへ移る', en: 'A region of the image links to another page' },
    manifest: cookbookV3('0022-linking-with-a-hotspot'), source: recipePage('0022-linking-with-a-hotspot'),
  },
  {
    id: '0024', kind: 'cookbook', media: 'image',
    title: { ja: '目次つきの本', en: 'Book with table of contents' },
    note: { ja: '目次（structure）から各ページへ移る', en: 'Jump to pages from the table of contents' },
    manifest: cookbookV3('0024-book-4-toc'), source: recipePage('0024-book-4-toc'),
  },
  {
    id: '0010', kind: 'cookbook', media: 'image',
    title: { ja: '右から左に読む本', en: 'Right-to-left book' },
    note: { ja: '見開きを右から左へめくる（viewingDirection）', en: 'Pages turn from right to left (viewingDirection)' },
    manifest: `${recipePage('0010-book-2-viewing-direction')}manifest-rtl.json`, source: recipePage('0010-book-2-viewing-direction'),
  },
  {
    id: '0011', kind: 'cookbook', media: 'image',
    title: { ja: '巻物のように続けて表示', en: 'Continuous scroll' },
    note: { ja: '複数の Canvas を 1 本につなげて表示する（behavior: continuous。読み込みに 20 秒ほどかかります）', en: 'Canvases joined into one strip (behavior: continuous; takes about 20 seconds to load)' },
    manifest: `${recipePage('0011-book-3-behavior')}manifest-continuous.json`, source: recipePage('0011-book-3-behavior'),
  },
  {
    id: '0033', kind: 'cookbook', media: 'image',
    title: { ja: '画像の切り替え', en: 'Choice of images' },
    note: { ja: '同じ Canvas の別の画像（Choice）を切り替えて比べる', en: 'Switch between alternative images of one canvas (Choice)' },
    manifest: cookbookV3('0033-choice'), source: recipePage('0033-choice'),
  },
  {
    id: '0229', kind: 'cookbook', media: 'video',
    title: { ja: 'サムネイルで移動する動画', en: 'Video navigation with thumbnails' },
    note: { ja: '動画の区切り（Range）をサムネイルの一覧から選ぶ', en: 'Pick sections (Ranges) of a video from thumbnails' },
    manifest: cookbookV3('0229-behavior-ranges'), tab: 'structure', source: recipePage('0229-behavior-ranges'),
  },
  {
    id: '0017', kind: 'cookbook', media: 'video',
    title: { ja: '動画と文字起こし（時刻つき）', en: 'Timed transcription of video' },
    note: { ja: '動画に時刻つきの文字起こしがつく', en: 'A video with a timed transcription' },
    manifest: cookbookV3('0017-transcription-av'), tab: 'transcript', source: recipePage('0017-transcription-av'),
  },
  {
    id: '0021', kind: 'cookbook', media: 'image',
    title: { ja: 'タグづけ', en: 'Tagging' },
    note: { ja: '画像の一部にタグをつける', en: 'Tags attached to image regions' },
    manifest: cookbookV3('0021-tagging'), tab: 'annotations', source: recipePage('0021-tagging'),
  },
  {
    id: '0036', kind: 'cookbook', media: 'image',
    title: { ja: '複数の画像の合成', en: 'Composition from multiple images' },
    note: { ja: '複数の画像を 1 枚の Canvas に並べる', en: 'Several images placed on one canvas' },
    manifest: cookbookV3('0036-composition-from-multiple-images'), source: recipePage('0036-composition-from-multiple-images'),
  },
  {
    id: '0065', kind: 'cookbook', media: 'image',
    title: { ja: 'オペラの楽譜（複数 Canvas）', en: 'Opera on multiple canvases' },
    note: { ja: '複数の Canvas に分けた目次つきの資料', en: 'A multi-canvas item with ranges' },
    manifest: cookbookV3('0065-opera-multiple-canvases'), source: recipePage('0065-opera-multiple-canvases'),
  },
  {
    id: '0074', kind: 'cookbook', media: 'video',
    title: { ja: '多言語の字幕', en: 'Multiple-language captions' },
    note: { ja: '言語ごとの字幕を切り替える', en: 'Switch between captions in several languages' },
    manifest: cookbookV3('0074-multiple-language-captions'), source: recipePage('0074-multiple-language-captions'),
  },
  {
    id: '0103', kind: 'cookbook', media: 'audio',
    title: { ja: '音声とアノテーション', en: 'Poetry reading with annotations' },
    note: { ja: '朗読にアノテーションがつく', en: 'A reading with annotations' },
    manifest: cookbookV3('0103-poetry-reading-annotations'), tab: 'annotations', source: recipePage('0103-poetry-reading-annotations'),
  },
  {
    id: 'video-transcript', kind: 'own', media: 'video',
    title: { ja: '動画と時刻つき文字起こし', en: 'Video with timed transcript' },
    note: {
      ja: '字幕と同じ VTT を文字起こしにも指定。行を押すと再生位置が移り、再生に合わせて強調されます',
      en: 'The same VTT as captions and as transcript. Click a line to seek; the current line is highlighted',
    },
    manifest: withBasePath('/manifests/sample-manifest-video-transcript.json'), tab: 'transcript',
  },
];
