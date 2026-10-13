// curation: CODH の Curation API 1.0（cr:Curation）の読み取り。
// https://codh.rois.ac.jp/iiif/curation/
//
// Curation は、いくつものマニフェストから Canvas（またはその一部の領域）を集め、順番を付けたもの。
// Presentation 2.1 の独自拡張で、selections（Range の並び）の各 Range が、
// canvases（Canvas の URL の一覧）か members（{@id, label} の一覧）と、元のマニフェスト（within）を持つ。
//
// ビューアはマニフェストを 1 つ読む作りなので、ここでは Curation を「1 冊の仮のマニフェスト（Presentation 3）」に組み立てる。
//  - items: 使われている Canvas を、元のマニフェストから最初に出てきた順に 1 回ずつ並べる
//    （同じ Canvas が領域違いで何度も出てくることがあるが、1 つのマニフェストの中で Canvas の id は重ねられない）
//  - structures: selections を Range にし、その下に member ごとの Range を置く。領域は Canvas の id の #xywh= で持つ。
//    順番と領域は目次の側に残る
//  - start: 何番目の member から見せるか（既定は 1 番目）
// React に依存しない。この機能の担当だけがこのファイルを書く。

import { upgradeToV3 } from '../services/upgradeV2';
import { splitId, type CanvasTarget } from './structure';

/** 仮のマニフェストに付ける印（キュレーションから組み立てたもの）。値は元のキュレーションの URL。 */
export const CURATION_MARK = 'kasane:curation';

type Json = Record<string, unknown>;

const isObject = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);
const asList = (v: unknown): unknown[] => (Array.isArray(v) ? v : v == null ? [] : [v]);
const str = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined);
const idOf = (v: unknown): string | undefined => (typeof v === 'string' ? str(v) : isObject(v) ? str(v['@id'] ?? v.id) : undefined);
const stripFragment = (id: string): string => {
  const hash = id.indexOf('#');
  return hash < 0 ? id : id.slice(0, hash);
};

type LanguageMap = Record<string, string[]>;

/** Presentation 2 の label（文字列・{@value, @language}・その配列）を、3 の言語つきの値にする。 */
export function languageMapOf(label: unknown): LanguageMap | undefined {
  const out: LanguageMap = {};
  const add = (lang: string, value: string) => {
    (out[lang] ??= []).push(value);
  };
  for (const v of asList(label)) {
    if (typeof v === 'string') add('none', v);
    else if (isObject(v) && typeof v['@value'] === 'string') add(str(v['@language']) ?? 'none', v['@value']);
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/** cr:Curation か。 */
export function isCuration(json: unknown): boolean {
  if (!isObject(json)) return false;
  const type = json['@type'] ?? json.type;
  return asList(type).some((t) => t === 'cr:Curation' || t === 'http://codh.rois.ac.jp/iiif/curation/1#Curation');
}

export interface CurationMember {
  /** Canvas の id（#xywh= などの断片つき。member の書いたまま） */
  id: string;
  /** 断片を除いた Canvas の id */
  canvasId: string;
  label?: LanguageMap;
}

export interface CurationSelection {
  id?: string;
  label?: LanguageMap;
  /** 元のマニフェストの URL */
  manifestUrl: string;
  manifestLabel?: LanguageMap;
  /** within の型が Manifest か（Timeline API の tl:Manifest などは読まない） */
  readable: boolean;
  members: CurationMember[];
}

/** selections を読む。元のマニフェストが書かれていない Range は除く。 */
export function curationSelectionsOf(json: unknown): CurationSelection[] {
  if (!isObject(json)) return [];
  const out: CurationSelection[] = [];
  for (const s of asList(json.selections)) {
    if (!isObject(s)) continue;
    const within = asList(s.within)[0];
    const manifestUrl = idOf(within);
    if (!manifestUrl) continue;
    const withinType = isObject(within) ? (within['@type'] ?? within.type) : undefined;
    const members: CurationMember[] = [];
    // canvases と members のどちらか（両方あれば members を使う。members の方が label を持てる）
    const list = asList(s.members).length > 0 ? asList(s.members) : asList(s.canvases);
    for (const m of list) {
      const id = idOf(m);
      if (!id) continue;
      const member: CurationMember = { id, canvasId: stripFragment(id) };
      const label = isObject(m) ? languageMapOf(m.label) : undefined;
      if (label) member.label = label;
      members.push(member);
    }
    const selection: CurationSelection = {
      manifestUrl,
      readable: withinType === undefined || withinType === 'sc:Manifest' || withinType === 'Manifest',
      members,
    };
    const id = str(s['@id'] ?? s.id);
    if (id) selection.id = id;
    const label = languageMapOf(s.label);
    if (label) selection.label = label;
    const manifestLabel = isObject(within) ? languageMapOf(within.label) : undefined;
    if (manifestLabel) selection.manifestLabel = manifestLabel;
    out.push(selection);
  }
  return out;
}

/** 取りに行く必要のあるマニフェストの URL（重複なし、出てきた順）。 */
export function curationManifestUrls(json: unknown): string[] {
  const urls = curationSelectionsOf(json)
    .filter((s) => s.readable && s.members.length > 0)
    .map((s) => s.manifestUrl);
  return [...new Set(urls)];
}

const canvasesOf = (manifest: unknown): Map<string, Json> => {
  const out = new Map<string, Json>();
  if (!isObject(manifest)) return out;
  for (const c of asList(manifest.items)) {
    if (isObject(c) && typeof c.id === 'string') out.set(c.id, c);
  }
  return out;
};

const requiredStatementOf = (attribution: unknown): Json | undefined => {
  const value = languageMapOf(attribution);
  return value ? { label: { none: ['Attribution'] }, value } : undefined;
};

/**
 * Curation と、取ってきた元のマニフェスト（Presentation 3 に直したもの。URL から引く）から、仮のマニフェストを組み立てる。
 * 読めなかったマニフェストや、そこに無い Canvas の member は飛ばす。1 つも残らなければ null。
 * pos は何番目の member から見せるか（1 から。範囲外なら 1 番目）。
 */
export function curationToManifest(curation: unknown, manifests: Map<string, unknown>, pos = 1): Json | null {
  if (!isObject(curation)) return null;
  const curationId = str(curation['@id'] ?? curation.id) ?? 'urn:kasane:curation';

  const items: Json[] = [];
  const placed = new Set<string>();
  const structures: Json[] = [];
  const memberRefs: string[] = [];

  curationSelectionsOf(curation).forEach((s, si) => {
    if (!s.readable) return;
    const source = manifests.get(s.manifestUrl);
    const canvases = canvasesOf(source);
    if (canvases.size === 0) return;
    const manifestLabel = s.manifestLabel ?? (isObject(source) ? source.label : undefined);
    const partOf = [{ id: s.manifestUrl, type: 'Manifest', ...(manifestLabel ? { label: manifestLabel } : {}) }];
    const rangeId = s.id ?? `${curationId}#selection-${si + 1}`;
    const children: Json[] = [];
    s.members.forEach((m, mi) => {
      const canvas = canvases.get(m.canvasId);
      if (!canvas) return;
      if (!placed.has(m.canvasId)) {
        placed.add(m.canvasId);
        // どの資料から来たかを、Canvas の partOf に残す
        items.push({ ...canvas, partOf: [...asList(canvas.partOf), ...partOf] });
      }
      memberRefs.push(m.id);
      children.push({
        id: `${rangeId}#member-${mi + 1}`,
        type: 'Range',
        label: m.label ?? canvas.label ?? { none: [`${mi + 1}`] },
        items: [{ id: m.id, type: 'Canvas' }],
      });
    });
    if (children.length === 0) return;
    structures.push({
      id: rangeId,
      type: 'Range',
      label: s.label ?? manifestLabel ?? { none: [s.manifestUrl] },
      items: children,
    });
  });

  if (items.length === 0) return null;

  const at = Number.isInteger(pos) && pos >= 1 && pos <= memberRefs.length ? pos : 1;
  const out: Json = {
    '@context': 'http://iiif.io/api/presentation/3/context.json',
    id: curationId,
    type: 'Manifest',
    label: languageMapOf(curation.label) ?? { none: [curationId] },
    items,
    structures,
    start: { id: memberRefs[at - 1], type: 'Canvas' },
    [CURATION_MARK]: curationId,
  };
  const required = requiredStatementOf(curation.attribution);
  if (required) out.requiredStatement = required;
  const related = idOf(asList(curation.related)[0]);
  if (related) out.homepage = [{ id: related, type: 'Text', label: { none: [related] }, format: 'text/html' }];
  return out;
}

/**
 * キュレーションから組み立てたマニフェストの、pos 番目（1 から）の member が指す Canvas（領域つき）。
 * キュレーションでないか、その番号が無ければ null。
 */
export function curationMemberAt(manifest: unknown, pos: number): CanvasTarget | null {
  if (!isObject(manifest) || !manifest[CURATION_MARK] || !Number.isInteger(pos) || pos < 1) return null;
  const refs: string[] = [];
  for (const r of asList(manifest.structures)) {
    if (!isObject(r)) continue;
    for (const child of asList(r.items)) {
      const ref = isObject(child) ? idOf(asList(child.items)[0]) : undefined;
      if (ref) refs.push(ref);
    }
  }
  const ref = refs[pos - 1];
  if (!ref) return null;
  const { id, fragment } = splitId(ref);
  return { canvasId: id, ...fragment };
}

/**
 * Curation を読み、元のマニフェストを取ってきて、仮のマニフェストにする。
 * fetchJson は URL の JSON を返す（読めなければ null）。同時に取りに行くのは concurrency 件まで。
 */
export async function resolveCuration(
  curation: unknown,
  fetchJson: (url: string) => Promise<unknown>,
  options: { pos?: number; concurrency?: number } = {},
): Promise<Json | null> {
  const urls = curationManifestUrls(curation);
  const manifests = new Map<string, unknown>();
  let next = 0;
  const worker = async () => {
    while (next < urls.length) {
      const url = urls[next++];
      try {
        const raw = await fetchJson(url);
        if (raw) manifests.set(url, upgradeToV3(raw));
      } catch (e) {
        console.error('Error reading a manifest of the curation:', url, e);
      }
    }
  };
  const n = Math.max(1, Math.min(options.concurrency ?? 6, urls.length));
  await Promise.all(Array.from({ length: n }, worker));
  return curationToManifest(curation, manifests, options.pos);
}
