import ja from './ja.json';
import en from './en.json';
import { FEATURE_MESSAGES } from './features.generated';

export type ViewerMessages = Record<string, Record<string, string>>;

// 名前空間（Info・Viewer など）ごとに、機能のファイルの文言を足し合わせる。
// 機能の担当は、自分の features/<機能>.{ja,en}.json だけを書く（一覧は scripts/gen-registries.mjs が作る）。
const merge = (...parts: ViewerMessages[]): ViewerMessages => {
  const out: ViewerMessages = {};
  for (const part of parts) {
    for (const [ns, table] of Object.entries(part)) out[ns] = { ...out[ns], ...table };
  }
  return out;
};

export const messages: Record<'ja' | 'en', ViewerMessages> = {
  ja: merge(ja, ...FEATURE_MESSAGES.ja),
  en: merge(en, ...FEATURE_MESSAGES.en),
};
