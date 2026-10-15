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
      // 何コマ目を開くか（1 始まり）
      canvas?: number;
      // 文字の検索（tab: 'contentSearch'）で、開いたときに探しておく語
      query?: string;
    }
  | {
      page: 'compare';
      // 1 つなら iiif-content=（Choice を持つマニフェストやコレクション）、
      // 複数なら src= を並べて渡す（別々のマニフェストや info.json を見比べる）
      manifest: string | string[];
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
export const USE_CASE_FEATURES = ['image', '3d', 'annotations', 'compare', 'layers', 'georef', 'curation', 'search', 'ocr', 'auth', 'story'] as const;
export type UseCaseFeature = (typeof USE_CASE_FEATURES)[number];

export interface UseCase {
  // ページ内リンク（/usecases#<id>）にも使う。英小文字・数字・ハイフン
  id: string;
  // 一覧に足した日（YYYY-MM-DD）。一覧の「新しい順」と、カードの表示に使う
  added: string;
  title: Localized;
  // 2〜3 文。何の資料で、Kasane で何ができるか
  note: Localized;
  open: UseCaseOpen;
  features: UseCaseFeature[];
  // 紹介動画（YouTube の videoId）。片方の言語しか無いときは、それを両方の言語で出す
  video?: Partial<Localized>;
  // 動画の前に Kasane 自身の画面（thumbnailOf）を出し、押したら再生する。
  // 元のアプリでも使っている動画は、YouTube 側のサムネイルに旧アプリ名が出ているため
  ownPoster?: boolean;
  // 元のプロジェクトのページ
  site?: string;
  // トップの入力欄のサンプルにも出す
  featured?: boolean;
  // トップのカードの見出し。資料の名前ではなく「何ができるか」を短く（featured のときは必ず書く）
  headline?: Localized;
}

/** 開く資料そのものの URL（マニフェスト、search ならキュレーション・コレクション）。compare では複数のことがある */
export const sourcesOf = (open: UseCaseOpen): string[] =>
  open.page === 'search' ? [open.url] : typeof open.manifest === 'string' ? [open.manifest] : open.manifest;

export function hrefOf(open: UseCaseOpen): string {
  if (open.page === 'search') {
    const q = [`u=${encodeURIComponent(open.url)}`];
    if (open.query) q.push(`q=${encodeURIComponent(open.query)}`);
    return `/search?${q.join('&')}`;
  }
  const q =
    typeof open.manifest === 'string'
      ? [contentParam(open.manifest)]
      : open.manifest.map((m) => `src=${encodeURIComponent(m)}`);
  switch (open.page) {
    case 'viewer':
      if (open.tab) q.push(`tab=${open.tab}`);
      if (open.pos) q.push(`pos=${open.pos}`);
      if (open.canvas) q.push(`canvas=${open.canvas}`);
      if (open.query) q.push(`q=${encodeURIComponent(open.query)}`);
      break;
    case 'compare':
      if (open.mode) q.push(`mode=${open.mode}`);
      break;
    case 'georef':
      break;
  }
  return `/${open.page}?${q.join('&')}`;
}

// サムネイル（scripts/capture-thumbnails.mjs で撮った、右の欄を除いたビューアの画面）。言語ごとに撮ってある
// thumbnailPathOf は basePath なし（og:image など metadataBase からの URL 用）、thumbnailOf は画面の <img> 用
export const thumbnailPathOf = (u: UseCase, locale: Locale): string =>
  `/thumbnails/usecases/${u.id}.${locale}.webp`;
export const thumbnailOf = (u: UseCase, locale: Locale): string => withBasePath(thumbnailPathOf(u, locale));

// トップのカードで再生する短い動画（scripts/capture-usecase-clips.mjs で撮った、音なしの数秒の録画）
export const clipOf = (u: UseCase, locale: Locale): string =>
  withBasePath(`/clips/usecases/${u.id}.${locale}.mp4`);

export const videoOf = (u: UseCase, locale: Locale): string | undefined =>
  u.video?.[locale] ?? u.video?.[locale === 'ja' ? 'en' : 'ja'];

export const USE_CASES: UseCase[] = [
  // 3D モデルへのアノテーションが Kasane の中心の機能なので、先頭に置く
  {
    id: 'globe-annotations',
    added: '2026-10-14',
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
    video: { ja: 'ocEU8G3jCXw', en: 'rFGlytYXToc' },
    featured: true,
    headline: { ja: '3D モデルに注釈を付ける', en: 'Annotate a 3D model' },
  },
  {
    id: 'globe-georef',
    added: '2026-10-14',
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
    video: { ja: 'NAVE09zRedo', en: 'b8qKqzuNNZY' },
  },
  {
    id: 'iiif-geo',
    added: '2026-10-13',
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
    ownPoster: true,
    site: 'https://geo.ldas.jp/',
    featured: true,
    headline: { ja: '古地図を現在の地図に重ねる', en: 'Lay an old map over today’s map' },
  },
  {
    id: 'shelley',
    added: '2026-10-13',
    title: {
      ja: 'シェリーの手稿（元画像と透過光画像）',
      en: 'Shelley manuscript (original and transmitted-light images)',
    },
    note: {
      ja: '同じ手稿を、ふつうの光と透過光で撮った 2 枚の画像です。左右に並べたり、境目を動かしたりして見比べます。',
      en: 'The same manuscript photographed in reflected and in transmitted light. Compare the two side by side or with a swipe.',
    },
    open: { page: 'compare', manifest: 'https://utda.github.io/shelley/iiif/shelley/manifest.json' },
    features: ['image', 'compare'],
    video: { ja: 'nQBgdcvWlj0', en: '06oQxj2AXV4' },
    site: 'https://utda.github.io/shelley/',
    featured: true,
    headline: { ja: '2 枚の画像を見比べる', en: 'Compare two images' },
  },
  {
    id: 'kuniezu',
    added: '2026-10-14',
    title: {
      ja: '国絵図を見比べる（天保国絵図 近江国）',
      en: 'Comparing provincial maps (Tenpō kuniezu, Ōmi Province)',
    },
    note: {
      ja: '国立公文書館が所蔵する正式版の近江国絵図と、その前年に作られた同じ大きさの写しをスタンフォード大学図書館が所蔵しています。別々の機関が公開している 2 つの Manifest を、URL に src= で並べて渡すだけで見比べられる例です。境目を動かして記載の違いを確かめます。所蔵: 国立公文書館、スタンフォード大学図書館。',
      en: "The official copy of the Ōmi Province map held by the National Archives of Japan, and a copy of the same size made a year earlier, held by Stanford University Libraries. This example shows how to compare two Manifests published by different institutions: just list both in the URL as src=. Drag the divider to see what each records. Holders: National Archives of Japan, Stanford University Libraries.",
    },
    open: {
      page: 'compare',
      manifest: [
        'https://www.digital.archives.go.jp/api/iiif/764297/manifest.json',
        'https://purl.stanford.edu/hs631zg4177/iiif/manifest',
      ],
      mode: 'swipe',
    },
    video: { ja: 'kWFXPKhW9Tc', en: 'OPX9OJ8voDc' },
    features: ['image', 'compare'],
  },
  {
    id: 'ueno',
    added: '2026-10-13',
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
    ownPoster: true,
    featured: true,
    headline: { ja: '2 つの 3D モデルを見比べる', en: 'Compare two 3D models' },
  },
  {
    id: 'curation',
    added: '2026-10-13',
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
    video: { ja: 'LnkuxXYNCSs', en: 'qvLPzS2hCzo' },
    site: 'https://codh.rois.ac.jp/iiif/curation/',
    featured: true,
    headline: { ja: '資料から選んだ箇所を集めて見せる', en: 'Gather selected regions from books' },
  },
  {
    id: 'curation-search',
    added: '2026-10-14',
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
    // 動画はお知らせ face-detection と同じ（同じ花見のキュレーションで顔を検出する）
    video: { ja: 'l2j9h0g8SLo', en: 'XX1Tdc4Sxss' },
  },
  {
    id: 'kaishi',
    added: '2026-10-13',
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
    headline: { ja: '貼り重ねた紙片を 1 枚ずつめくる', en: 'Peel back stacked paper flaps' },
  },
  {
    id: 'meizukushi-ocr',
    added: '2026-10-14',
    title: {
      ja: '国立国会図書館「銘尽」（ブラウザの中で古典籍 OCR）',
      en: 'Meizukushi, National Diet Library (classical-text OCR in the browser)',
    },
    note: {
      ja: '国立国会図書館デジタルコレクションの『銘尽』を、6 コマ目の推論タブで開きます。NDL古典籍OCR-Lite の「ダウンロード」を押してから実行すると、くずし字の行を読み取り、画像に枠と文字を重ねます。モデル（約 83MB）は初回にだけ読み込み、画像はどこにも送りません。',
      en: 'Meizukushi from the NDL Digital Collections, opened at frame 6 in the Inference tab. Download NDL Kotenseki OCR-Lite and run it to read the cursive lines and overlay boxes and text on the image. The model (about 83 MB) downloads once, and the image is never sent anywhere.',
    },
    open: {
      page: 'viewer',
      manifest: 'https://dl.ndl.go.jp/api/iiif/1288371/manifest.json',
      tab: 'inference',
      canvas: 6,
    },
    features: ['image', 'ocr'],
    site: 'https://dl.ndl.go.jp/pid/1288371',
    // 動画はお知らせ inference-ocr と同じ（同じ『銘尽』の 6 コマ目で OCR する）
    video: { ja: 'IYhzoqRM7QY', en: 'dJS7uoeb-S0' },
  },
  {
    id: 'mdz-content-search',
    added: '2026-10-15',
    title: {
      ja: 'バイエルン州立図書館の写本（資料の中の文字を探す）',
      en: 'Manuscript, Bavarian State Library (search the text inside)',
    },
    note: {
      ja: 'ミュンヘンデジタル化センター（MDZ）が公開する 15 世紀ドイツ語の写本を、文字の検索タブで開きます。提供元の検索窓口（IIIF Content Search API）に「petrus」を問い合わせ、当たった語を一覧と画像の上の枠で示します。一覧を押すと、そのページへ移ります。',
      en: 'A 15th-century German manuscript from the Munich Digitization Center (MDZ), opened in the Search text tab. Kasane asks the provider’s search service (IIIF Content Search API) for “petrus” and marks each hit in the list and on the image. Click a hit to go to its page.',
    },
    open: {
      page: 'viewer',
      manifest: 'https://api.digitale-sammlungen.de/iiif/presentation/v2/bsb00026283/manifest',
      tab: 'contentSearch',
      query: 'petrus',
    },
    features: ['image', 'search'],
    site: 'https://www.digitale-sammlungen.de/view/bsb00026283',
  },
  {
    id: 'wakozukan-story',
    added: '2026-10-14',
    title: {
      ja: '東京大学史料編纂所「倭寇図巻」（ストーリー）',
      en: 'Wakō zukan, Historiographical Institute, The University of Tokyo (story)',
    },
    note: {
      ja: '長さ 90,000 px を超える絵巻を、ストーリータブで開きます。「次へ」を押すと、場面ごとにその部分へ寄りながら説明を読み進められます。説明は IIIF のマニフェストに書かれた注釈そのもので、専用の形式は使っていません。',
      en: 'A handscroll over 90,000 px long, opened in the Story tab. Press Next to glide to each scene and read its description. The tour is just the annotations written in the IIIF manifest, with no special format.',
    },
    open: {
      page: 'viewer',
      manifest: 'https://www.hi.u-tokyo.ac.jp/collection/digitalgallery/wakozukan/data/cp/story/m.json',
      tab: 'story',
    },
    features: ['image', 'annotations', 'story'],
    site: 'https://www.hi.u-tokyo.ac.jp/collection/digitalgallery/wakozukan/',
    // 動画はお知らせ story-tab と同じ（同じ倭寇図巻をストーリータブで読む）
    video: { ja: 'VDXuQE6P34s', en: 'fXIwtvfEZ-Q' },
  },
  {
    id: 'wellcome-auth',
    added: '2026-10-14',
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
    video: { ja: 'Trl4ksr5TBU', en: 'etqp6liTkFo' },
  },
  {
    id: 'video-objects',
    added: '2026-10-15',
    title: {
      ja: '信州デジタルコモンズ「芦の尻の道祖神祭り」（動画の中の人の枠）',
      en: 'Ashinoshiri Dosojin Festival, Shinshu Digital Commons (boxes on people in a video)',
    },
    note: {
      ja: '県立長野図書館の記録映像に、ArchiveBase の Video Search が AI で見つけた人の枠を、IIIF の注釈（時間と範囲を指す #t=…&xywh=…）として重ねた例です。枠は AI の出力です。AI は藁の神面などにも「人」の枠を付けていたので、人が目で確かめて、確かに人が写っている 27 件だけを残しました。枠はその時間だけ動画の上に出ます。一覧の注釈を押すと、その時刻へ移ります。',
      en: 'A documentary film from the Nagano Prefectural Library, with boxes on people that ArchiveBase Video Search found with AI, written as IIIF annotations on a time and a region (#t=…&xywh=…). The boxes are AI output. The AI also put “person” boxes on things such as the straw god mask, so a person checked every box by eye and kept only the 27 that really show a person. Each box appears over the video only at its time. Click an annotation in the list to go there.',
    },
    open: { page: 'viewer', manifest: `${SITE_URL}/manifests/sample-manifest-video-objects.json`, tab: 'canvasAnnotations' },
    features: ['annotations'],
    video: { ja: 'LvrLzdqbCfk', en: '4_zBRW-oS1w' },
    site: 'https://ab.ldas.jp/ja/na-kamura-1263/video',
  },
];

/** 新しく足した順。同じ日なら定義の順のまま */
export const byNewest = (list: UseCase[]): UseCase[] =>
  [...list].sort((a, b) => b.added.localeCompare(a.added));

export const FEATURED_USE_CASES = USE_CASES.filter((u) => u.featured);

// 名前を useCaseById にすると、React の規則の検査が Hook と取り違えるので usecaseById にしてある
export const usecaseById = (id: string): UseCase | undefined => USE_CASES.find((u) => u.id === id);
