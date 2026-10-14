'use client';

import { useEffect, useState } from 'react';

// 表紙（placeholderCanvas・thumbnail）の無い動画のために、動画から 1 枚絵を取り出す。
// 冒頭は黒い画面や字幕だけのことが多いので（Cookbook 0026・0229 のオペラ）、
// 途中の何か所かを見て、いちばん明るい絵を使う。
// 動画の配信元が CORS を許していないと絵を読み出せないので、そのときは undefined のまま。

const SAMPLES = [0.05, 0.1, 0.2];
const WIDTH = 640;

const brightness = (g: CanvasRenderingContext2D, w: number, h: number): number => {
  const d = g.getImageData(0, 0, w, h).data;
  let s = 0;
  for (let i = 0; i < d.length; i += 4) s += d[i] + d[i + 1] + d[i + 2];
  return s / (d.length / 4);
};

const once = (el: HTMLMediaElement, ok: string) =>
  new Promise<void>((resolve, reject) => {
    const done = () => {
      el.removeEventListener(ok, done);
      el.removeEventListener('error', fail);
      resolve();
    };
    const fail = () => {
      el.removeEventListener(ok, done);
      el.removeEventListener('error', fail);
      reject(new Error('video'));
    };
    el.addEventListener(ok, done);
    el.addEventListener('error', fail);
  });

async function grab(src: string, cancelled: () => boolean): Promise<string | undefined> {
  const v = document.createElement('video');
  v.crossOrigin = 'anonymous';
  v.muted = true;
  v.preload = 'auto';
  v.src = src;
  try {
    await once(v, 'loadedmetadata');
    const duration = Number.isFinite(v.duration) ? v.duration : 0;
    const w = Math.min(WIDTH, v.videoWidth || WIDTH);
    const h = Math.round((w * (v.videoHeight || 9)) / (v.videoWidth || 16));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const g = canvas.getContext('2d', { willReadFrequently: true });
    if (!g) return undefined;
    let best: { score: number; url: string } | undefined;
    for (const f of duration > 0 ? SAMPLES : [0]) {
      if (cancelled()) return undefined;
      v.currentTime = Math.max(duration * f, 0.001);
      await once(v, 'seeked');
      g.drawImage(v, 0, 0, w, h);
      const score = brightness(g, w, h);
      if (!best || score > best.score) best = { score, url: canvas.toDataURL('image/jpeg', 0.85) };
    }
    return best?.url;
  } catch {
    // 読み込めない、または CORS で絵を読み出せない
    return undefined;
  } finally {
    v.removeAttribute('src');
    v.load();
  }
}

/** A still taken from the video, for a video that has no cover of its own. */
export function useVideoPoster(src: string | undefined): string | undefined {
  const [poster, setPoster] = useState<{ src: string; url?: string }>();
  useEffect(() => {
    if (!src) return;
    let cancelled = false;
    grab(src.split('#')[0], () => cancelled).then((url) => {
      if (!cancelled) setPoster({ src, url });
    });
    return () => {
      cancelled = true;
    };
  }, [src]);
  return poster && poster.src === src ? poster.url : undefined;
}
