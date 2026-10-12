import { describe, expect, it } from 'vitest';
import {
  contentParam,
  decodeContentState,
  encodeContentState,
  manifestFromParams,
} from './contentState';

const M = 'https://example.org/日本語/manifest.json';

describe('decodeContentState', () => {
  it('URL そのものを返す', () => {
    expect(decodeContentState('https://example.org/m.json')).toBe('https://example.org/m.json');
  });
  it('base64url の Annotation から取り出す（日本語を含む）', () => {
    expect(decodeContentState(encodeContentState(M))).toBe(M);
  });
  it('target が SpecificResource（source がマニフェスト）でも取り出す', () => {
    const json = { type: 'Annotation', target: { type: 'SpecificResource', source: { id: M, type: 'Manifest' } } };
    expect(decodeContentState(JSON.stringify(json))).toBe(M);
  });
  it('Canvas の partOf から取り出す', () => {
    const json = { type: 'Annotation', target: { type: 'Canvas', id: 'c1', partOf: [{ id: M, type: 'Manifest' }] } };
    expect(decodeContentState(encodeURIComponent(JSON.stringify(json)))).toBe(M);
  });
  it('Cookbook 形式（URI エンコードした JSON を base64url にしたもの）を取り出す', () => {
    const json = { type: 'Annotation', target: { type: 'Canvas', id: 'c1', partOf: [{ id: M, type: 'Manifest' }] } };
    const b64 = btoa(unescape(encodeURIComponent(encodeURIComponent(JSON.stringify(json)))))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    expect(decodeContentState(b64)).toBe(M);
  });
  it('読めない値は null', () => {
    expect(decodeContentState('!!!')).toBeNull();
    expect(decodeContentState('')).toBeNull();
    expect(decodeContentState(null)).toBeNull();
  });
});

describe('manifestFromParams', () => {
  it('iiif-content を manifest より優先する', () => {
    const p = new URLSearchParams({ 'iiif-content': 'https://a/m.json', manifest: 'https://b/m.json' });
    expect(manifestFromParams(p)).toBe('https://a/m.json');
  });
  it('manifest だけでも読む', () => {
    expect(manifestFromParams(new URLSearchParams({ manifest: 'https://b/m.json' }))).toBe('https://b/m.json');
  });
  it('iiif-content が読めなければ manifest に戻る', () => {
    const p = new URLSearchParams({ 'iiif-content': '!!!', manifest: 'https://b/m.json' });
    expect(manifestFromParams(p)).toBe('https://b/m.json');
  });
  it('どちらも無ければ null', () => {
    expect(manifestFromParams(new URLSearchParams())).toBeNull();
  });
});

describe('contentParam', () => {
  it('URL をエンコードして iiif-content にする', () => {
    expect(contentParam('https://a/m.json?x=1')).toBe('iiif-content=https%3A%2F%2Fa%2Fm.json%3Fx%3D1');
  });
});
