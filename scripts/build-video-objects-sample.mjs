#!/usr/bin/env node
// 動画の「時間＋矩形」の注釈を試す見本のマニフェストを、ArchiveBase の Video Search から作る。
//
//   node scripts/build-video-objects-sample.mjs
//
// 題材: https://ab.ldas.jp/ja/na-kamura-1263/video の『芦の尻の道祖神祭り』（県立長野図書館）。
// ArchiveBase の注釈 1 件は、動画の 1 コマで見つかった物（Person など）の枠で、
// 時刻（metadata.t）と枠（slug の末尾 x-y-w-h、動画の画素）を持つ。
// IIIF の注釈としては出ていないので、ここで target を `<canvas>#t=開始,終了&xywh=x,y,w,h` に組み立てる。
// 終了時刻は、同じ動画で次に枠が付いたコマの時刻（最長 1 秒）。metadata.time_end は使わない（開始 + 100 秒になっている）。
//
// 出力: public/manifests/sample-manifest-video-objects.json

import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'public/manifests/sample-manifest-video-objects.json');
const ID = 'https://kasane.ldas.jp/manifests/sample-manifest-video-objects.json';

const DB = 'https://ab.ldas.jp/na-kamura-1263/video';
const ITEM = 'sdcommons_video-01DD001H210011';
// ab.ldas.jp/api/assets/... は s3ds.mdx.jp へ転送され、転送先が CORS を返さない。
// 同じファイルを CORS つきで配っている archivebase-s3.ldas.jp を使う（ArchiveBase の素のマニフェストと同じ）。
const VIDEO = 'https://archivebase-s3.ldas.jp/archivebase/na-kamura-1263/8bb1df30-59a6-4097-ad7e-8e22acdecc96/video.mp4';
const MAX_WINDOW = 1;

const getJson = async (url) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return r.json();
};

const round = (n) => Math.round(n * 1000) / 1000;

const main = async () => {
  const item = (await getJson(`${DB}/api/search?q=${ITEM}&type=item&limit=5`)).items.find((i) => i.slug === ITEM);
  if (!item) throw new Error(`${ITEM} not found`);
  const m = item.metadata;
  const width = Number(m.width);
  const height = Number(m.height);
  const duration = Number(m.duration);

  const found = (await getJson(`${DB}/api/search?q=${ITEM}&type=annotation&limit=1000`)).items;
  const boxes = [];
  for (const a of found) {
    if (a.metadata?.parent !== ITEM || a.metadata?.unit !== 'shot') continue;
    const tail = a.slug.slice(ITEM.length + 1).split('-').map(Number);
    if (tail.length !== 5 || tail.some((n) => !Number.isFinite(n))) continue;
    const [t, x, y, w, h] = tail;
    boxes.push({ t, x, y, w, h, tags: a.metadata.tag ?? [], slug: a.slug });
  }
  boxes.sort((a, b) => a.t - b.t || a.x - b.x);
  const times = [...new Set(boxes.map((b) => b.t))];

  const canvas = `${ID}/canvas`;
  const annotations = boxes.map((b, i) => {
    const next = times.find((t) => t > b.t);
    const end = round(Math.min(next ?? duration, b.t + MAX_WINDOW, duration));
    return {
      id: `${canvas}/objects/${i + 1}`,
      type: 'Annotation',
      motivation: ['tagging'],
      body: { type: 'TextualBody', value: b.tags.join(', '), language: 'en', format: 'text/plain' },
      target: `${canvas}#t=${round(b.t)},${end}&xywh=${b.x},${b.y},${b.w},${b.h}`,
      seeAlso: [{ id: `${DB}/resource/${b.slug}`, type: 'Text', format: 'text/html' }],
    };
  });

  const manifest = {
    '@context': 'http://iiif.io/api/presentation/3/context.json',
    id: ID,
    type: 'Manifest',
    label: { ja: ['芦の尻の道祖神祭り（動画の中の物体の枠）'], en: ['Ashinoshiri Dosojin Festival (objects in the video)'] },
    summary: {
      ja: [
        `動画の時間と範囲を指す注釈（target が #t=…&xywh=…）の見本。ArchiveBase の Video Search が AI で検出した ${annotations.length} 件の人物などの枠を、IIIF の注釈に書き直した。タグは生成 AI の出力で、検証していない。`,
      ],
      en: [
        `Sample of annotations on a time and a region of a video (target #t=…&xywh=…): ${annotations.length} boxes of people and things that ArchiveBase Video Search found with AI, rewritten as IIIF annotations. The tags are AI output and have not been checked.`,
      ],
    },
    requiredStatement: {
      label: { ja: ['出典'], en: ['Attribution'] },
      value: { ja: [m.attribution] },
    },
    homepage: [
      { id: `${DB}/resource/${ITEM}`, type: 'Text', format: 'text/html', label: { ja: ['ArchiveBase Video Search'], en: ['ArchiveBase Video Search'] } },
    ],
    items: [
      {
        id: canvas,
        type: 'Canvas',
        width,
        height,
        duration,
        items: [
          {
            id: `${canvas}/page`,
            type: 'AnnotationPage',
            items: [
              {
                id: `${canvas}/page/painting`,
                type: 'Annotation',
                motivation: 'painting',
                body: { id: VIDEO, type: 'Video', format: 'video/mp4', width, height, duration },
                target: canvas,
              },
            ],
          },
        ],
        annotations: [
          {
            id: `${canvas}/objects`,
            type: 'AnnotationPage',
            label: { ja: ['動画の中の物体（AI による検出）'], en: ['Objects in the video (detected by AI)'] },
            items: annotations,
          },
        ],
      },
    ],
  };

  await writeFile(OUT, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`${path.relative(ROOT, OUT)}: ${annotations.length} annotations, ${times.length} frames`);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
