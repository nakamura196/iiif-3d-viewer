import { contentParam } from '@nakamura196/iiif-viewer/core';
import { withBasePath } from '@/lib/basePath';
import type { ViewerTab } from '@/lib/viewerTabs';

export interface Sample {
  id: string;
  media: 'image' | 'audio' | 'video' | '3d';
  title: { ja: string; en: string };
  note: { ja: string; en: string };
  manifest: string;
  // 開いたあとに選ぶタブ
  tab?: ViewerTab;
}

// このサイトの検査用マニフェスト（/samples/kasane）。
// IIIF Cookbook のレシピは cookbookRecipes.ts にあり、/samples に一覧で出す。
export const SAMPLES: Sample[] = [
  // 3D モデルへのアノテーションが Kasane の中心の機能なので、一覧の先頭に置く
  {
    id: 'globe-annotations', media: '3d',
    title: { ja: '地球儀とアノテーション', en: 'Globe with annotations' },
    note: {
      ja: '『石淵家地球儀』（菊池市立図書館所蔵）の 3D モデルの地名に、アノテーションを付けた例。一覧の地名を押すと、その場所へ視点が移ります',
      en: 'Annotations on place names of a 3D model of the Ishibuchi family globe (Kikuchi City Library). Click a place in the list to move the view there',
    },
    manifest: withBasePath('/manifests/sample-manifest-with-annotations.json'), tab: 'annotations',
  },
  {
    id: 'globe-viewpoints', media: '3d',
    title: { ja: '地球儀と視点', en: 'Globe with viewpoints' },
    note: {
      ja: '同じ地球儀の Scene に、3 つの視点（PerspectiveCamera）を書いた例。最初の視点「日本」で開き、右上のボタンで「ヨーロッパ」「真上」に切り替えられます',
      en: 'The same globe with three viewpoints (PerspectiveCamera) in its Scene. It opens at the first one, Japan; the buttons at the top right switch to Europe and From above',
    },
    manifest: withBasePath('/manifests/sample-manifest-viewpoints.json'),
  },
  {
    id: 'video-transcript', media: 'video',
    title: { ja: '動画と時刻つき文字起こし', en: 'Video with timed transcript' },
    note: {
      ja: '字幕と同じ VTT を文字起こしにも指定。行を押すと再生位置が移り、再生に合わせて強調されます',
      en: 'The same VTT as captions and as transcript. Click a line to seek; the current line is highlighted',
    },
    manifest: withBasePath('/manifests/sample-manifest-video-transcript.json'), tab: 'transcript',
  },
  {
    id: 'video-objects', media: 'video',
    title: { ja: '動画の中の物体の枠', en: 'Boxes on objects in a video' },
    note: {
      ja: '動画の時間と範囲を指す注釈（#t=…&xywh=…）の例。ArchiveBase の Video Search が AI で見つけた人物などの枠が、その時間だけ動画の上に出ます。一覧を押すと、その時刻へ移ります',
      en: 'Annotations on a time and a region of a video (#t=…&xywh=…). Boxes on people and things that ArchiveBase Video Search found with AI appear over the video at their time. Click one in the list to go there',
    },
    manifest: withBasePath('/manifests/sample-manifest-video-objects.json'), tab: 'canvasAnnotations',
  },
];

// 「開く」の行き先（/viewer）。一覧の画面と、サムネイルを撮るスクリプトの両方で使う
export const sampleHref = (s: Sample): string =>
  `/viewer?${contentParam(s.manifest)}${s.tab ? `&tab=${s.tab}` : ''}`;

// サムネイル（scripts/capture-thumbnails.mjs で撮った画面）。public/ からのパス
// sampleThumbnailPath は basePath なし（og:image など metadataBase からの URL 用）、sampleThumbnail は画面の <img> 用
export const sampleThumbnailPath = (s: Sample): string => `/thumbnails/samples/${s.id}.webp`;
export const sampleThumbnail = (s: Sample): string => withBasePath(sampleThumbnailPath(s));

export const sampleById = (id: string): Sample | undefined => SAMPLES.find((s) => s.id === id);
