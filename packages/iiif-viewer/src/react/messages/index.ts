import ja from './ja.json';
import en from './en.json';
import aboutJa from './features/about.ja.json';
import aboutEn from './features/about.en.json';
import annotationsJa from './features/annotations.ja.json';
import annotationsEn from './features/annotations.en.json';
import imageJa from './features/image.ja.json';
import imageEn from './features/image.en.json';
import structureJa from './features/structure.ja.json';
import structureEn from './features/structure.en.json';
import temporalJa from './features/temporal.ja.json';
import temporalEn from './features/temporal.en.json';
import layersJa from './features/layers.ja.json';
import layersEn from './features/layers.en.json';

export type ViewerMessages = Record<string, Record<string, string>>;

// 名前空間（Info・Viewer など）ごとに、機能のファイルの文言を足し合わせる。
// 機能の担当は、自分の features/<機能>.{ja,en}.json だけを書く。
const merge = (...parts: ViewerMessages[]): ViewerMessages => {
  const out: ViewerMessages = {};
  for (const part of parts) {
    for (const [ns, table] of Object.entries(part)) out[ns] = { ...out[ns], ...table };
  }
  return out;
};

export const messages: Record<'ja' | 'en', ViewerMessages> = {
  ja: merge(ja, imageJa, structureJa, temporalJa, aboutJa, annotationsJa, layersJa),
  en: merge(en, imageEn, structureEn, temporalEn, aboutEn, annotationsEn, layersEn),
};
