import type { CompareMode } from '@nakamura196/iiif-viewer';
import { contentParam } from '@nakamura196/iiif-viewer/core';
import { withBasePath } from '@/lib/basePath';
import { SITE_URL } from '@/lib/site';
import type { ViewerTab } from '@/lib/viewerTabs';

// ユースケース（実際の資料で Kasane を使った例）。/usecases の一覧と、トップの入力欄のサンプルに出す。
// 1 件足すときは USE_CASES に 1 項目を書き足す。ページの部品は触らなくてよい。
// 開く先のページを増やすときは、UseCaseOpen に page の種類を足し、hrefOf に URL の組み立てを足す。

type Localized = { ja: string; en: string };
export type Locale = keyof Localized;

/**
 * 「Kasane で開く」で開く先。開くページごとに、URL に載せられる引数が違うので分けて書く。
 * 新しいページに開かせたいときは、ここに 1 種類足して hrefOf に分岐を足す。
 * georef は地図と並べて見るページ、search はキュレーション・コレクションを横断して検索するページ。
 */
export type UseCaseOpen =
  | {
      page: 'viewer';
      manifest: string;
      // 開いたあとに選ぶタブ
      tab?: ViewerTab;
      // キュレーションの何番目の項目を開くか（1 始まり）
      pos?: number;
    }
  | {
      page: 'compare';
      manifest: string;
      mode?: CompareMode;
    }
  | {
      page: 'georef';
      manifest: string;
    }
  | {
      page: 'search';
      // 検索する対象のキュレーション・コレクションの URL
      url: string;
      // 最初から入れておく検索語
      query?: string;
    };

/** 何を見せる例か。一覧に札として出す。表示名は messages の UseCases.features */
export const USE_CASE_FEATURES = ['image', '3d', 'annotations', 'compare', 'layers', 'georef', 'curation', 'search', 'auth'] as const;
export type UseCaseFeature = (typeof USE_CASE_FEATURES)[number];

export interface UseCase {
  // ページ内リンク（/usecases#<id>）にも使う。英小文字・数字・ハイフン
  id: string;
  title: Localized;
  // 2〜3 文。何の資料で、Kasane で何ができるか
  note: Localized;
  open: UseCaseOpen;
  features: UseCaseFeature[];
  // 紹介動画（YouTube の videoId）。片方の言語しか無いときは、それを両方の言語で出す
  video?: Partial<Localized>;
  // 元のプロジェクトのページ
  site?: string;
  // トップの入力欄のサンプルにも出す
  featured?: boolean;
}

/** 開く資料そのものの URL（マニフェスト、search ならキュレーション・コレクション） */
export const sourceOf = (open: UseCaseOpen): string => (open.page === 'search' ? open.url : open.manifest);

export function hrefOf(open: UseCaseOpen): string {
  if (open.page === 'search') {
    const q = [`u=${encodeURIComponent(open.url)}`];
    if (open.query) q.push(`q=${encodeURIComponent(open.query)}`);
    return `/search?${q.join('&')}`;
  }
  const q = [contentParam(open.manifest)];
  switch (open.page) {
    case 'viewer':
      if (open.tab) q.push(`tab=${open.tab}`);
      if (open.pos) q.push(`pos=${open.pos}`);
      break;
    case 'compare':
      if (open.mode) q.push(`mode=${open.mode}`);
      break;
    case 'georef':
      break;
  }
  return `/${open.page}?${q.join('&')}`;
}

// サムネイル（scripts/capture-thumbnails.mjs で撮った画面）。public/ からのパス
export const thumbnailOf = (u: UseCase): string => withBasePath(`/thumbnails/usecases/${u.id}.webp`);

export const videoOf = (u: UseCase, locale: Locale): string | undefined =>
  u.video?.[locale] ?? u.video?.[locale === 'ja' ? 'en' : 'ja'];

export const USE_CASES: UseCase[] = [
  // 3D モデルへのアノテーションが Kasane の中心の機能なので、先頭に置く
  {
    id: 'globe-annotations',
    title: {
      ja: '石淵家地球儀（3D モデルへのアノテーション）',
      en: 'Ishibuchi family globe (annotations on a 3D model)',
    },
    note: {
      ja: '菊池市立図書館所蔵の『石淵家地球儀』の 3D モデルです。地名にアノテーションを付けてあり、一覧の地名を押すと、その場所へ視点が移ります。',
      en: 'A 3D model of the Ishibuchi family globe (Kikuchi City Library), with annotations on place names. Click a place in the list to move the view there.',
    },
    open: { page: 'viewer', manifest: `${SITE_URL}/manifests/sample-manifest-with-annotations.json`, tab: 'annotations' },
    features: ['3d', 'annotations'],
    featured: true,
  },
  {
    id: 'globe-georef',
    title: {
      ja: '石淵家地球儀（3D と地図を並べて見る）',
      en: 'Ishibuchi family globe (3D beside a map)',
    },
    note: {
      ja: '同じ『石淵家地球儀』を、3D の地球儀と現在の地図を並べて表示します。地名を選ぶと、地球儀の視点と地図の位置が一緒に動きます。',
      en: 'The same globe, shown as the 3D model beside a modern map. Choosing a place name moves both the globe view and the map.',
    },
    open: { page: 'georef', manifest: `${SITE_URL}/manifests/sample-manifest-with-annotations.json` },
    features: ['3d', 'georef'],
  },
  {
    id: 'iiif-geo',
    title: {
      ja: '東京大学本郷キャンパス歴史的建造物マップ（iiif_geo）',
      en: 'Hongo Campus Historical Buildings Map (iiif_geo)',
    },
    note: {
      ja: '鳥瞰図『東京帝國大學本部構内及農學部建物鳥瞰圖』に、IIIF Georeference Extension で現在の地図との対応点を付けた資料です。Kasane では、図と対応点を現在の地図と並べて表示します。対応点を押すと双方で同じ場所が選ばれ、図を地図に重ねることもできます。対応点には、OpenStreetMap にある現在の建物名を付けています。',
      en: 'A bird’s-eye view of the Imperial University campus, georeferenced with the IIIF Georeference Extension. Kasane shows the image and its control points beside a modern map. Selecting a point picks the same place on both, and the image can be overlaid on the map. The control points are labelled with current building names from OpenStreetMap.',
    },
    open: { page: 'georef', manifest: `${SITE_URL}/manifests/geo-hongo-buildings.json` },
    features: ['image', 'georef'],
    video: { ja: '3qsZbPXC9qg', en: 'RoE5Mm6vSFE' },
    site: 'https://geo.ldas.jp/',
    featured: true,
  },
  {
    id: 'shelley',
    title: {
      ja: 'シェリー書簡（元画像と透過光画像）',
      en: 'Shelley letter (original and transmitted-light images)',
    },
    note: {
      ja: '同じ書簡を、ふつうの光と透過光で撮った 2 枚の画像です。左右に並べたり、境目を動かしたりして見比べます。',
      en: 'The same letter photographed in reflected and in transmitted light. Compare the two side by side or with a swipe.',
    },
    open: { page: 'compare', manifest: 'https://utda.github.io/shelley/iiif/shelley/manifest.json' },
    features: ['image', 'compare'],
    site: 'https://utda.github.io/shelley/',
    featured: true,
  },
  {
    id: 'ueno',
    title: {
      ja: '上野駅周辺の点群と建物モデル（3D の左右表示）',
      en: 'Ueno station area: point cloud and building models side by side',
    },
    note: {
      ja: '同じ場所の PLATEAU の建物モデルと LiDAR 点群を、左右・スワイプ・スパイグラスで見比べます。',
      en: 'PLATEAU building models and LiDAR points of the same area, compared side by side, with a swipe, or through a spyglass.',
    },
    open: { page: 'compare', manifest: 'https://nakamura196.github.io/hongo-campus-iiif/ueno.json' },
    features: ['3d', 'compare'],
    video: { ja: 'Sb7m0J6pRTM', en: 'wOh2JiaHkS8' },
    featured: true,
  },
  {
    id: 'curation',
    title: {
      ja: 'IIIF Curation API の例（CODH のサンプル）',
      en: 'IIIF Curation API example (CODH sample)',
    },
    note: {
      ja: '2 冊の資料から 8 か所を選んだ小さなキュレーションです。目次から選ぶと、その頁が開き、選んだ領域に枠が出ます。',
      en: 'A small curation that picks eight regions from two books. Choose one in the contents to open its page with the region outlined.',
    },
    open: {
      page: 'viewer',
      manifest: 'https://codh.rois.ac.jp/software/iiif-curation-viewer/sample/curation.json',
      tab: 'structure',
      pos: 4,
    },
    features: ['image', 'curation'],
    site: 'https://codh.rois.ac.jp/iiif/curation/',
    featured: true,
  },
  {
    id: 'curation-search',
    title: {
      ja: 'キュレーションを検索する（江戸の花見の顔 121 点）',
      en: 'Searching a curation (121 faces in Edo hanami prints)',
    },
    note: {
      ja: 'NDL ラボの顔検出で集めた「江戸の花見」のキュレーションです。29 冊に散らばる 121 か所を読み込み、年代や性別などで絞り込めます。読み込みには少し時間がかかります。',
      en: 'A curation of faces detected in Edo-period hanami (cherry-blossom viewing) prints. It loads 121 regions spread over 29 books, which can be narrowed down by period, gender and more. Loading takes a little while.',
    },
    open: { page: 'search', url: 'https://nakamura196.github.io/ndl-face-finder/curations/works/edonohanami.json' },
    features: ['image', 'curation', 'search'],
  },
  {
    id: 'kaishi',
    title: {
      ja: '大日本海志編纂資料「起絵図」（泰平丸起絵図）',
      en: 'Okoshi-ezu from the Dai Nihon Kaishi materials (Taiheimaru)',
    },
    note: {
      ja: '台紙の上に紙片を貼り重ねた図面です。台紙と紙片を撮った 16 枚の画像を重ねて表示し、1 枚ずつ表示・非表示や透明度を変えられます。',
      en: 'A drawing with paper flaps pasted onto a base sheet. Sixteen images of the sheet and flaps are stacked, and each layer can be hidden or made transparent.',
    },
    open: { page: 'viewer', manifest: 'https://utda.github.io/kaishi/iiif/7-2-24/manifest.json', tab: 'layers' },
    features: ['image', 'layers'],
    video: { ja: 'aDwMzalPIxY' },
    site: 'https://utda.github.io/kaishi/',
    featured: true,
  },
  {
    id: 'wellcome-auth',
    title: {
      ja: 'Wellcome Collection の閲覧注意付き資料（IIIF Auth API 2.0）',
      en: 'Wellcome Collection material behind a content advisory (IIIF Auth API 2.0)',
    },
    note: {
      ja: 'Wellcome Collection が IIIF Auth API 2.0 で閲覧に同意を求めている文書です。開くと画像はぼかされ、先方の注意書きが出ます。「Accept Terms and Open」を押して同意すると、画像が表示されます。',
      en: 'An archive document that Wellcome Collection serves behind a content advisory, using the IIIF Auth API 2.0. The image opens blurred under the advisory, and appears once you press “Accept Terms and Open”.',
    },
    open: { page: 'viewer', manifest: 'https://iiif.wellcomecollection.org/presentation/v3/b18659135' },
    features: ['image', 'auth'],
    site: 'https://wellcomecollection.org/works/a222zvge',
  },
];

export const FEATURED_USE_CASES = USE_CASES.filter((u) => u.featured);
