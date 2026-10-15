import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { SAMPLES, sampleThumbnail } from '@/lib/samples';
import { FEATURED_USE_CASES, USE_CASES, clipOf, thumbnailOf } from '@/lib/usecases';

// サンプルやユースケースを足したら、サムネイルも撮る: node scripts/capture-thumbnails.mjs --missing
const inPublic = (src: string) => existsSync(path.join(__dirname, '../../public', src));

describe('サムネイル', () => {
  it.each(SAMPLES.map((s) => [s.id, sampleThumbnail(s)]))('サンプル %s の画像がある', (_id, src) => {
    expect(inPublic(src)).toBe(true);
  });
  const useCaseThumbs = USE_CASES.flatMap((u) =>
    (['ja', 'en'] as const).map((l) => [`${u.id} (${l})`, thumbnailOf(u, l)]),
  );
  it.each(useCaseThumbs)('ユースケース %s の画像がある', (_id, src) => {
    expect(inPublic(src)).toBe(true);
  });
  // ownPoster の例は、動画の前にこの画像を出す
  const posters = USE_CASES.filter((u) => u.ownPoster).flatMap((u) =>
    (['ja', 'en'] as const).map((l) => [`${u.id} (${l})`, thumbnailOf(u, l)]),
  );
  it('ownPoster の例が 1 件以上あり、動画も付いている', () => {
    expect(posters.length).toBeGreaterThan(0);
    for (const u of USE_CASES.filter((x) => x.ownPoster)) expect(u.video, u.id).toBeTruthy();
  });
  it.each(posters)('動画の前に出す画像 %s がある', (_id, src) => {
    expect(inPublic(src)).toBe(true);
  });
  // トップのカードの動画: node scripts/capture-usecase-clips.mjs --only <id>
  const clips = FEATURED_USE_CASES.flatMap((u) =>
    (['ja', 'en'] as const).map((l) => [`${u.id} (${l})`, clipOf(u, l)]),
  );
  it.each(clips)('トップの例 %s の動画がある', (_id, src) => {
    expect(inPublic(src)).toBe(true);
  });
});
