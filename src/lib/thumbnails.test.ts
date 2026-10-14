import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { SAMPLES, sampleThumbnail } from '@/lib/samples';
import { USE_CASES, thumbnailOf } from '@/lib/usecases';

// サンプルやユースケースを足したら、サムネイルも撮る: node scripts/capture-thumbnails.mjs --missing
const inPublic = (src: string) => existsSync(path.join(__dirname, '../../public', src));

describe('サムネイル', () => {
  it.each(SAMPLES.map((s) => [s.id, sampleThumbnail(s)]))('サンプル %s の画像がある', (_id, src) => {
    expect(inPublic(src)).toBe(true);
  });
  it.each(USE_CASES.map((u) => [u.id, thumbnailOf(u)]))('ユースケース %s の画像がある', (_id, src) => {
    expect(inPublic(src)).toBe(true);
  });
});
