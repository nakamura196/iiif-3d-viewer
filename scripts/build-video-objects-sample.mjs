#!/usr/bin/env node
// 動画の「時間＋矩形」の注釈を試す見本のマニフェストを、ArchiveBase の Video Search から作る。
//
//   node scripts/build-video-objects-sample.mjs
//
// 題材: https://ab.ldas.jp/ja/na-kamura-1263/video の『芦の尻の道祖神祭り』（県立長野図書館）。
// ArchiveBase の注釈 1 件は、動画の 1 コマで見つかった物（Person など）の枠で、
// 時刻（metadata.t）と枠（slug の末尾 x-y-w-h、動画の画素）を持つ。
// IIIF の注釈としては出ていないので、ここで target を `<canvas>#t=開始,終了&xywh=x,y,w,h` に組み立てる。
// 終了時刻は、残した枠のうち次に枠が付いたコマの時刻（最長 1 秒）。metadata.time_end は使わない（開始 + 100 秒になっている）。
//
// 残す枠は、人が目で確かめて決めた（scripts/video-objects-review.tsv）。
// AI は藁の神面や岩にも Person を付けていたので、確かに人が写っている枠（verdict が keep）だけを残す。
// 確かめたのは「人かどうか」だけ（性別・年齢は確かめていない）なので、本文は Person だけにする。元のタグは表に残してある。
// 表に無い枠が ArchiveBase に増えていたら、確かめていないので止まる。
//
// 出力: public/manifests/sample-manifest-video-objects.json

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'public/manifests/sample-manifest-video-objects.json');
const REVIEW = path.join(ROOT, 'scripts/video-objects-review.tsv');
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

// 判定表: slug ごとに keep / drop
const readReview = async () => {
  const [head, ...lines] = (await readFile(REVIEW, 'utf8')).trim().split('\n');
  const cols = head.split('\t');
  const review = new Map();
  for (const line of lines) {
    const row = Object.fromEntries(line.split('\t').map((v, i) => [cols[i], v]));
    if (row.verdict !== 'keep' && row.verdict !== 'drop') throw new Error(`${row.slug}: verdict が keep でも drop でもない`);
    review.set(row.slug, row.verdict);
  }
  return review;
};

const main = async () => {
  const item = (await getJson(`${DB}/api/search?q=${ITEM}&type=item&limit=5`)).items.find((i) => i.slug === ITEM);
  if (!item) throw new Error(`${ITEM} not found`);
  const m = item.metadata;
  const width = Number(m.width);
  const height = Number(m.height);
  const duration = Number(m.duration);

  const review = await readReview();
  const found = (await getJson(`${DB}/api/search?q=${ITEM}&type=annotation&limit=1000`)).items;
  const all = [];
  for (const a of found) {
    if (a.metadata?.parent !== ITEM || a.metadata?.unit !== 'shot') continue;
    const tail = a.slug.slice(ITEM.length + 1).split('-').map(Number);
    if (tail.length !== 5 || tail.some((n) => !Number.isFinite(n))) continue;
    const [t, x, y, w, h] = tail;
    all.push({ t, x, y, w, h, slug: a.slug });
  }
  const unreviewed = all.filter((b) => !review.has(b.slug));
  if (unreviewed.length) throw new Error(`判定表に無い枠が ${unreviewed.length} 件ある（${unreviewed[0].slug} など）`);
  const boxes = all.filter((b) => review.get(b.slug) === 'keep');
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
      body: { type: 'TextualBody', value: 'Person', language: 'en', format: 'text/plain' },
      target: `${canvas}#t=${round(b.t)},${end}&xywh=${b.x},${b.y},${b.w},${b.h}`,
      seeAlso: [{ id: `${DB}/resource/${b.slug}`, type: 'Text', format: 'text/html' }],
    };
  });

  const manifest = {
    '@context': 'http://iiif.io/api/presentation/3/context.json',
    id: ID,
    type: 'Manifest',
    label: { ja: ['芦の尻の道祖神祭り（動画の中の人の枠）'], en: ['Ashinoshiri Dosojin Festival (people in the video)'] },
    summary: {
      ja: [
        `動画の時間と範囲を指す注釈（target が #t=…&xywh=…）の見本。ArchiveBase の Video Search が AI で検出した人の枠 ${all.length} 件のうち、目で確かめて確かに人が写っている ${annotations.length} 件だけを残し、IIIF の注釈に書き直した。枠は AI の出力のまま。`,
      ],
      en: [
        `Sample of annotations on a time and a region of a video (target #t=…&xywh=…). ArchiveBase Video Search found ${all.length} boxes of people with AI; a person checked each one by eye, and only the ${annotations.length} that really show a person are kept here, rewritten as IIIF annotations. The boxes are the AI output as is.`,
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
            label: { ja: ['動画の中の人（AI による検出、目で確かめたもの）'], en: ['People in the video (detected by AI, checked by eye)'] },
            items: annotations,
          },
        ],
      },
    ],
  };

  await writeFile(OUT, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`${path.relative(ROOT, OUT)}: ${annotations.length} of ${all.length} boxes kept, ${times.length} frames`);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
