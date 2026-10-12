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
  tab?: 'transcript' | 'annotations';
  // 出典ページ（Cookbook のレシピ）
  source?: string;
}

// recipe はフォルダ名（番号-名前）。番号だけの URL は 404 になる
const cookbook = (recipe: string) => `https://iiif.io/api/cookbook/recipe/${recipe}/v4/manifest.json`;
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
    id: 'video-transcript', kind: 'own', media: 'video',
    title: { ja: '動画と時刻つき文字起こし', en: 'Video with timed transcript' },
    note: {
      ja: '字幕と同じ VTT を文字起こしにも指定。行を押すと再生位置が移り、再生に合わせて強調されます',
      en: 'The same VTT as captions and as transcript. Click a line to seek; the current line is highlighted',
    },
    manifest: withBasePath('/manifests/sample-manifest-video-transcript.json'), tab: 'transcript',
  },
];
