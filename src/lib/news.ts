import { COOKBOOK_VIDEO_ID } from '@/lib/cookbookVideo';
import { USE_CASES, hrefOf, type UseCase } from '@/lib/usecases';

// お知らせ。トップには新しいものから NEWS_ON_HOME 件、/news に全件、/news/<id> に 1 件ずつの詳細を出す。
// 1 件足すときは NEWS の先頭に 1 項目を書き足す（新しいものが上）。ページの部品は触らなくてよい。

type Localized = { ja: string; en: string };

/** 詳細ページの「試す」ボタン。label は messages の News.<label> */
export interface NewsAction {
  // 言語で行き先が違うとき（日英の記事など）は Localized で書く
  href: string | Localized;
  external?: boolean;
  label?: 'tryIt' | 'readArticle';
}

export interface NewsItem {
  // 詳細ページの URL（/news/<id>）。英小文字・数字・ハイフン。公開後は変えない
  id: string;
  // YYYY-MM-DD
  date: string;
  // 一覧に出す見出し。短く
  title: Localized;
  // 詳細ページの本文。2〜3 文。何ができるようになったか
  body: Localized;
  action?: NewsAction;
  // 紹介動画（YouTube の videoId）。片方の言語しか無いときは、それを両方の言語で出す
  video?: Partial<Localized>;
  // 関連するユースケースの id。詳細ページにサムネイル付きで出す（先頭のものは動画が無いときの画像にも使う）
  usecases?: string[];
}

export const NEWS_ON_HOME = 5;

const viewer = (manifest: string, params: string) =>
  `/viewer/?iiif-content=${encodeURIComponent(manifest)}&${params}`;

export const NEWS: NewsItem[] = [
  {
    id: 'vr-gallery',
    date: '2026-10-14',
    title: {
      ja: 'IIIF を 3D の美術館として歩ける「ギャラリー」を足しました',
      en: 'Gallery: walk through IIIF as a 3D museum',
    },
    body: {
      ja: 'Curation・Collection・マニフェストの画像を、3D の美術館の壁に掛けて歩きながら見られます。見回す・一人称・三人称（アバター）の 3 つの歩き方があり、作品は近づいて拡大できます。これまで別のサイトだった IIIF VR Gallery を Kasane に移しました。',
      en: 'Hang the images of a Curation, Collection or manifest on the walls of a 3D museum and walk around them. Look around, walk in first person, or follow an avatar in third person, and zoom into any work. IIIF VR Gallery, formerly a separate site, now lives in Kasane.',
    },
    action: { href: '/gallery' },
    // 英語版の動画のみ（日本語のページでも英語版を出す）
    video: { en: '91AhCgI7TXY' },
  },
  {
    id: 'click-outline',
    date: '2026-10-14',
    title: {
      ja: '推論タブに「クリックで切り出す」を足しました',
      en: 'Click to outline, new in the Inference tab',
    },
    body: {
      ja: '画像の中の物をクリックすると、SAM 2.1 がその輪郭を多角形の注釈にします。Shift+クリックで範囲を足し、Alt+クリックで削れます。',
      en: 'Click a thing in the image and SAM 2.1 turns its outline into a polygon annotation. Shift+click adds to the shape, and Alt+click takes away from it.',
    },
    // 推論タブを開いた状態の例（face-detection と同じ花見のキュレーション。「クリックで切り出す」を選んで使う）
    action: {
      href: viewer('https://nakamura196.github.io/ndl-face-finder/curations/works/edonohanami.json', 'pos=2&tab=inference'),
    },
    video: { ja: 'RCZvHpaHSc8', en: 'rRyTJmxkckM' },
  },
  {
    id: 'cookbook-video',
    date: '2026-10-14',
    title: {
      ja: '「Cookbook のサンプル」の動画を作り直しました',
      en: 'A new video for the Cookbook samples',
    },
    body: {
      ja: 'IIIF Cookbook のレシピをカテゴリごとに Kasane で開き、声で説明する動画です。日本語版と英語版があります。サンプルの一覧の各レシピから、動画のその場面へ飛べます。',
      en: 'The video opens the IIIF Cookbook recipes in Kasane category by category, with narration. It comes in Japanese and English. Each recipe on the samples page links to its scene in the video.',
    },
    action: { href: '/samples' },
    video: COOKBOOK_VIDEO_ID,
  },
  {
    id: 'face-detection',
    date: '2026-10-14',
    title: {
      ja: '推論タブに「顔の検出（日本の絵画）」を足しました',
      en: 'Faces in Japanese art, a new model in the Inference tab',
    },
    body: {
      ja: '浮世絵・絵巻・近代の美人画などの顔を、ブラウザの中で探して枠で示します。画像を切り分けて調べるので、人混みの小さな顔も拾えます。画像はどこにも送りません。',
      en: 'It finds the faces in ukiyo-e, picture scrolls and modern bijin-ga in your browser and marks them with boxes. The image is scanned in parts, so small faces in a crowd are found too. The image is never sent anywhere.',
    },
    // 推論タブを開いた状態の例（NDL「江戸名所」、ndl-face-finder の花見のキュレーション）
    action: {
      href: viewer('https://nakamura196.github.io/ndl-face-finder/curations/works/edonohanami.json', 'pos=2&tab=inference'),
    },
    usecases: ['curation-search'],
    video: { ja: 'l2j9h0g8SLo', en: 'XX1Tdc4Sxss' },
  },
  {
    id: 'cookbook-all-recipes',
    date: '2026-10-14',
    title: {
      ja: 'IIIF Cookbook の全 76 レシピを並べました',
      en: 'All 76 IIIF Cookbook recipes in the samples',
    },
    body: {
      ja: '「Cookbook のサンプル」に、IIIF Cookbook の全 76 レシピを番号順に並べました。カテゴリで絞り込め、各レシピをそのまま Kasane で開けます。',
      en: 'The Cookbook samples page now lists all 76 IIIF Cookbook recipes in numbering order. Filter them by category and open each one in Kasane.',
    },
    action: { href: '/samples' },
    video: { ja: 'oYfYjzzFfrU', en: 'eh2za9P9LfY' },
  },
  {
    id: 'story-tab',
    date: '2026-10-14',
    title: {
      ja: '右パネルに「ストーリー」タブを足しました',
      en: 'A new Story tab',
    },
    body: {
      ja: 'マニフェストの注釈を順に送りながら、その場面に寄って説明を読めます。倭寇図巻などの、既にあるストーリー用のマニフェストをそのまま開けます。',
      en: 'Step through the annotations of a manifest, gliding to each scene as you read. Existing tour manifests such as the Wakō zukan story open as they are.',
    },
    action: { href: hrefOfUseCase('wakozukan-story') },
    usecases: ['wakozukan-story'],
    video: { ja: 'VDXuQE6P34s', en: 'fXIwtvfEZ-Q' },
  },
  {
    id: 'inference-ocr',
    date: '2026-10-14',
    title: {
      ja: '右パネルに「推論」タブを足しました（ブラウザの中で OCR）',
      en: 'A new Inference tab (OCR in your browser)',
    },
    body: {
      ja: 'NDL古典籍OCR-Lite と NDLOCR-Lite をブラウザの中で動かし、表示中の画像の文字を読み取ります。モデルは初回にだけ読み込みます。画像はどこにも送りません。',
      en: 'Kasane runs NDL Kotenseki OCR-Lite and NDLOCR-Lite in your browser to read the text of the image on screen. The model downloads once. The image is never sent anywhere.',
    },
    action: { href: hrefOfUseCase('meizukushi-ocr') },
    usecases: ['meizukushi-ocr'],
    video: { ja: 'IYhzoqRM7QY', en: 'dJS7uoeb-S0' },
  },
  {
    id: 'maps',
    date: '2026-10-14',
    title: {
      ja: '地図の表示を広げました',
      en: 'More maps',
    },
    body: {
      ja: '右パネルに「地図」タブを足しました。画像に地点の付いたマニフェストをジオリファレンス表示で開けます。地点の付いた絵図は、地図に重ねられます。',
      en: 'The side panel has a Map tab. Manifests whose points sit on the image open in the georeferencing view. Georeferenced pictures can be laid over the map.',
    },
    action: { href: hrefOfUseCase('iiif-geo') },
    usecases: ['iiif-geo', 'globe-georef'],
  },
  {
    id: 'auth2',
    date: '2026-10-14',
    title: {
      ja: 'ログインや同意が必要な画像（IIIF Auth 2.0）に対応しました',
      en: 'Images behind login or consent (IIIF Auth 2.0)',
    },
    body: {
      ja: '閲覧に同意やログインが要る画像は、許可が出るまでぼかして表示します。Wellcome Collection の例をユースケースに足しました。',
      en: 'Images that need consent or a login are blurred until access is granted. A Wellcome Collection example is in the use cases.',
    },
    action: { href: hrefOfUseCase('wellcome-auth') },
    usecases: ['wellcome-auth'],
    video: { ja: 'Trl4ksr5TBU', en: 'etqp6liTkFo' },
  },
  {
    id: 'cookbook-recipes',
    date: '2026-10-14',
    title: {
      ja: 'IIIF Cookbook のレシピへの対応を広げました',
      en: 'More IIIF Cookbook recipes',
    },
    body: {
      ja: 'v4 の字幕、注釈の画像・スタイル・Wikidata、音声・動画の形式の選択に対応しました。別々のマニフェストにまたがる content state と、Collection の年表表示にも対応しました。',
      en: 'Kasane now handles v4 captions, images, styles and Wikidata in annotations, and choosing a playable audio or video format. Content states spanning several manifests and a timeline view of Collections work too.',
    },
    action: { href: '/samples' },
    video: { ja: '8_0_pyBlAyc', en: 'lsKHqDCUBo4' },
  },
  {
    id: 'compare-video',
    date: '2026-10-13',
    title: {
      ja: '比較ページの紹介動画を公開しました',
      en: 'A video introducing the compare page',
    },
    body: {
      ja: '2 つのモデルを左右・スワイプ・スパイグラスで見比べる操作を動画で紹介します。URL での共有と、説明欄の開閉も扱っています。',
      en: 'The video shows how to compare two models side by side, with a swipe, or through a spyglass. It also covers sharing by URL and the collapsible side panel.',
    },
    action: { href: hrefOfUseCase('ueno') },
    video: { ja: 'Sb7m0J6pRTM', en: 'wOh2JiaHkS8' },
    usecases: ['ueno'],
  },
  {
    id: 'usecases-search',
    date: '2026-10-13',
    title: {
      ja: 'ユースケースと検索のページを公開しました',
      en: 'New use cases and search pages',
    },
    body: {
      ja: 'ユースケースのページでは、実際の資料で Kasane を使った例を紹介します。検索のページでは、コレクションやキュレーションを横断して探せます。IIIF Curation API にも対応しました。',
      en: 'The use cases page shows Kasane at work on real collections. The search page searches across collections and curations. Kasane also reads the IIIF Curation API.',
    },
    action: { href: '/usecases' },
    usecases: ['curation-search', 'curation'],
  },
  {
    id: 'layers',
    date: '2026-10-12',
    title: {
      ja: '重ねた画像をレイヤーとして扱えるようにしました',
      en: 'Image layers',
    },
    body: {
      ja: '重ねた画像を 1 枚ずつ表示・非表示にでき、不透明度と重ね順も変えられます。順に重ねていく・外していく再生もできます。画像の Choice は、比較ページで見比べられます。',
      en: 'Show or hide each painted image, and change its opacity and stacking order. The layers can also be played in or out one by one. Image Choices can be compared on the compare page.',
    },
    action: { href: hrefOfUseCase('kaishi') },
    usecases: ['kaishi'],
  },
  {
    id: 'compare-models',
    date: '2026-10-11',
    title: {
      ja: '2 つのモデルを見比べられるようにしました',
      en: 'Comparing two models',
    },
    body: {
      ja: '比較ページで、左右に並べる・スワイプ・スパイグラスの 3 通りで見比べられます。同じ場所に置いた複数のモデルの切り替えと、回転・全体表示・真上からの視点などの操作ボタンも足しました。説明欄は開閉できます。',
      en: 'The compare page shows two models side by side, with a swipe, or through a spyglass. You can also switch between models placed in the same scene, and use a view toolbar (rotate, fit, top view). The side panel can be collapsed.',
    },
    action: { href: hrefOfUseCase('ueno') },
    usecases: ['ueno', 'shelley'],
  },
  {
    id: 'pictures-viewpoints',
    date: '2026-10-01',
    title: {
      ja: '写真の表示と初期の視点に対応しました',
      en: 'Pictures and initial viewpoints',
    },
    body: {
      ja: 'アノテーションに添えた写真を表示し、マニフェストで指定した視点で開くようにしました。地図と並べる表示では、全部のピンが入るように地図を合わせ、「全体を表示」ボタンを足しました。注釈のカードは、どのページでも同じ見た目にそろえました。',
      en: 'Pictures attached to annotations are shown, and models open at the viewpoint given in the manifest. Beside a map, the map fits all pins, with a “Show all” button. Annotation cards look the same on every page.',
    },
    action: { href: hrefOfUseCase('globe-georef') },
    usecases: ['globe-georef'],
    video: { ja: 'NAVE09zRedo', en: 'b8qKqzuNNZY' },
  },
  // 同じ場所の注釈・キー付きタグ（研究段階、2026-09-28）の告知。掲載の了承が得られたら戻す
  {
    id: '3d-rendering',
    date: '2026-07-09',
    title: {
      ja: '3D モデルの表示を改善しました',
      en: 'Better 3D model rendering',
    },
    body: {
      ja: '環境光（IBL）で質感が出るようにしました。アノテーションへ移るときはその面に正対し、開いたときはモデル全体が収まるように合わせます。',
      en: 'Image-based lighting gives models a truer look. Moving to an annotation turns the view to face it, and models fit the screen when they open.',
    },
    action: { href: hrefOfUseCase('globe-annotations') },
    usecases: ['globe-annotations'],
  },
  {
    id: 'pa4-converter-article',
    date: '2026-05-25',
    title: {
      ja: '技術記事「IIIF 3D Viewer：Presentation API 4 コンバーターの実装」を公開しました',
      en: 'Article: “IIIF 3D Viewer: Implementing a Presentation API 4 Converter”',
    },
    body: {
      ja: 'IIIF Presentation API 4 のマニフェストを読み込むための変換の仕組みを、技術記事にまとめました。',
      en: 'A technical article on how the viewer converts IIIF Presentation API 4 manifests.',
    },
    action: {
      href: {
        ja: 'https://tech.ldas.jp/ja/posts/iiif-3d-viewer-presentation-api-4-converter/',
        en: 'https://tech.ldas.jp/en/posts/iiif-3d-viewer-presentation-api-4-converter/',
      },
      external: true,
      label: 'readArticle',
    },
  },
];

function hrefOfUseCase(id: string): string {
  const u = USE_CASES.find((x) => x.id === id);
  if (!u) throw new Error(`news: unknown use case ${id}`);
  return hrefOf(u.open);
}

export const newsById = (id: string): NewsItem | undefined => NEWS.find((n) => n.id === id);

export const relatedUseCasesOf = (n: NewsItem): UseCase[] =>
  (n.usecases ?? []).map((id) => USE_CASES.find((u) => u.id === id)).filter((u): u is UseCase => !!u);

// このユースケースを取り上げたお知らせ（新しいものが先）
export const newsAboutUseCase = (useCaseId: string): NewsItem[] =>
  NEWS.filter((n) => n.usecases?.includes(useCaseId));

export const newsVideoOf = (n: NewsItem, locale: keyof Localized): string | undefined =>
  n.video?.[locale] ?? n.video?.[locale === 'ja' ? 'en' : 'ja'];

export const actionHrefOf = (a: NewsAction, locale: keyof Localized): string =>
  typeof a.href === 'string' ? a.href : a.href[locale];
