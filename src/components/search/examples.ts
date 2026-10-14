// 検索画面の入力欄の下に出す例。どちらも CORS に対応している（2026-10-13 に確認）。
// label は messages の Search.examples.<key>。
export const SEARCH_EXAMPLES = [
  {
    key: 'curation',
    // NDL 顔検出のキュレーション。member が metadata（作品・年・性別・検出器など）を持つ
    url: 'https://nakamura196.github.io/ndl-face-finder/curations/works/edonohanami.json',
  },
  {
    key: 'collection',
    // e-codices のボドメール文庫（Presentation 2、214 冊）。各マニフェストが metadata を持つ
    url: 'https://www.e-codices.unifr.ch/metadata/iiif/collection/fmb.json',
  },
] as const;
