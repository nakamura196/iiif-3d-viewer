import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { withBasePath } from './basePath';

describe('withBasePath', () => {
  const original = process.env.NEXT_PUBLIC_BASE_PATH;
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_BASE_PATH;
  });
  afterEach(() => {
    if (original === undefined) delete process.env.NEXT_PUBLIC_BASE_PATH;
    else process.env.NEXT_PUBLIC_BASE_PATH = original;
  });

  it('Vercel ルート配信 (basePath なし) では path をそのまま返す', () => {
    expect(withBasePath('/manifests/sample-manifest.json')).toBe(
      '/manifests/sample-manifest.json'
    );
  });

  it('GH Pages (basePath あり) では path に basePath を前置する', () => {
    process.env.NEXT_PUBLIC_BASE_PATH = '/iiif-3d-viewer';
    expect(withBasePath('/manifests/sample-manifest.json')).toBe(
      '/iiif-3d-viewer/manifests/sample-manifest.json'
    );
  });

  it('既に basePath で始まっていれば二重付与しない', () => {
    process.env.NEXT_PUBLIC_BASE_PATH = '/iiif-3d-viewer';
    expect(withBasePath('/iiif-3d-viewer/manifests/x.json')).toBe(
      '/iiif-3d-viewer/manifests/x.json'
    );
  });

  it('絶対 URL (http/https) はそのまま返す', () => {
    process.env.NEXT_PUBLIC_BASE_PATH = '/iiif-3d-viewer';
    expect(withBasePath('https://example.com/m.json')).toBe(
      'https://example.com/m.json'
    );
  });

  it('先頭スラッシュなしの相対パスでも正しく結合する', () => {
    process.env.NEXT_PUBLIC_BASE_PATH = '/iiif-3d-viewer';
    expect(withBasePath('manifests/x.json')).toBe(
      '/iiif-3d-viewer/manifests/x.json'
    );
  });
});
