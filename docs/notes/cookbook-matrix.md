# IIIF Cookbook のレシピへの対応（Cookbook の対応表に載せる）

## 2026-10-14

### 目的

Cookbook の対応表（https://iiif.io/api/cookbook/recipe/matrix/）に Kasane を載せる。
対応表は、IIIF/cookbook-recipes の各レシピの冒頭にある `viewers:` / `v4-viewers:` から作られる。
そのため、まず全レシピを Kasane で開けるかを調べ、足りないものを直してから、先方に PR を出す。

### 調べ方

- 対象は 69 レシピ。2 つの組（A 36 件・B 33 件）に分け、並行して調べた。
- 本番（https://kasane.ldas.jp/<ja|en>/viewer/?iiif-content=<URL>）を、ヘッドレスの Playwright（Chromium）で開いた。
  画面写真・DOM・通信を見て、必要ならソースも読んだ。
- 判定は YES（そのまま使える）／ PARTIAL（一部欠ける）／ NO（表示できない）。
- v4 の Manifest が iiif.io に実在するのは 0001・0002・0003・0219・0253・0608 の 6 件だけ。
  ほかの `/v4/manifest.json` は、状態 200 で HTML の 404 ページを返す（存在確認に状態コードを使えない）。

### 結果のまとめ

- A: 36 件中 YES 35、PARTIAL 1（0045）。
- B: 33 件中 YES 30、PARTIAL 2（0377・0540）、NO 1（0434）。
- 細かい不足: 0283 のページ一覧のサムネイルが「Scene」、0326 のアノテーション一覧が 0 件、0258 の Wikidata が生の URL のまま。

以下の 2 つの表は、調査した各組の報告をそのまま写したもの（英語のまま）。

### 組 A の表

**Kasane vs IIIF Cookbook (group A), tested on https://kasane.ldas.jp/en/viewer/ with headless Playwright, 2026-10-14**

v4 availability: only 0001, 0002, 0003 have a v4 manifest on iiif.io (other `/v4/manifest.json` URLs return an HTML 404 page with status 200). All three v4 load fine. All others are v3 only. 0010, 0011, 0030, 0032, 0040 have several named manifests instead of manifest.json (all tested).

| folder | verdict | v4 loads? | what is missing / evidence | likely code location |
|---|---|---|---|---|
| 0001-mvm-image | YES | v4 yes | image + title shown | - |
| 0002-mvm-audio | YES | v4 yes | audio player, title | - |
| 0003-mvm-video | YES | v4 yes | video player, title | - |
| 0004-canvas-size | YES | no v4 | image shown | - |
| 0005-image-service | YES | no v4 | tiled image | - |
| 0006-text-language | YES | no v4 | multilingual metadata, Rights tab | - |
| 0007-string-formats | YES | no v4 | loads, metadata shown (HTML formatting inside strings not individually inspected) | - |
| 0008-rights | YES | no v4 | Rights tab shown | - |
| 0009-book-1 | YES | no v4 | paged, 1/5 navigation, Pages panel | - |
| 0010-book-2-viewing-direction | YES | no v4 | rtl: prev/next arrows mirrored (DOM order Next before Previous, Next enabled at p.1); ttb: vertical page layout, Pages panel; code PagedDisplay.tsx handles all 4 directions. Page-turn by click not exercised | react/displays/PagedDisplay.tsx, core/features/structure.ts |
| 0011-book-3-behavior | YES | no v4 | continuous: horizontal strip of canvases (Strip component), individuals: single page. Strip scroll not exercised | react/displays/PagedDisplay.tsx (Strip) |
| 0013-placeholderCanvas | YES | no v4 | poster image with big play button shown before playback | react/displays/ImageExtras.tsx, ImageCanvasDisplay.tsx |
| 0014-accompanyingcanvas | YES | no v4 | score image shown above audio player | ImageCanvasDisplay.tsx |
| 0015-start | YES | no v4 | video.currentTime = 120.5 on load (matches PointSelector t=120.5) | core/features/temporal.ts |
| 0017-transcription-av | YES | no v4 | transcript listed under "Downloads and other formats" (rendering) + Annotation transcript tab | core/features/about.ts |
| 0019-html-in-annotations | YES | no v4 | Annotations panel renders the HTML link with icon (sanitised) | core/features/annotationHtml.ts |
| 0021-tagging | YES | no v4 | Tag annotation listed, region box drawn | - |
| 0022-linking-with-a-hotspot | YES | no v4 | blue region box + "Link Region" entry with "Canvas 2" link in Annotations tab. Clicking the box itself was not tested | react/panels/CanvasAnnotationsPanel.tsx |
| 0024-book-4-toc | YES | no v4 | Contents tab | react/panels/StructurePanel.tsx |
| 0025-newspaper-article-index | YES | no v4 | Contents with articles + target regions | StructurePanel.tsx |
| 0026-toc-opera | YES | no v4 | Contents with timestamps (0:00, 5:02, 1:06:11) | StructurePanel.tsx |
| 0027-alternative-page-order | YES | no v4 | Contents has "Manifest order / Physical sequence / Author-intended sequence" switch | core/features/structure.ts |
| 0029-metadata-anywhere | YES | no v4 | "Current item" metadata shown per canvas | react/metadata/Metadata.tsx |
| 0030-multi-volume | YES | no v4 | collection lists "Vol. 1 / Vol. 2" manifests; each manifest loads (collection.json, manifest_v1/v2) | react/displays/CollectionDisplay.tsx |
| 0031-bound-multivolume | YES | no v4 | loads, Contents tab, 1/6 pages | - |
| 0032-collection | YES | no v4 | collection lists two manifests; manifest-01 loads | CollectionDisplay.tsx |
| 0033-choice | YES | no v4 | Choice bar (Natural Light / X-Ray / Compare) + Layers tab | react/displays/ChoiceBar.tsx |
| 0035-foldouts | YES | no v4 | paged, 1/9; non-paged handled in code (structureState.ts); foldout page order not visually checked | react/displays/structureState.ts |
| 0036-composition-from-multiple-images | YES | no v4 | illumination composited on page, Layers tab | ImageCanvasDisplay.tsx |
| 0040-image-rotation-service | YES | no v4 | both manifest-service (rotation 90 in URL) and manifest-css (CSS transform rotate) render the same upright landscape image | react/displays/ImageTiles.tsx |
| 0045-css | PARTIAL | no v4 | both annotation boxes are the same blue; the author1/author2 colours live in external https://iiif.io/api/cookbook/recipe/0045-css/style.css, which the browser blocks (no CORS header, console error). Kasane parses stylesheet/styleClass (annotationStyle.ts) and applies inline CssStylesheet values, so only external stylesheets from servers without CORS fail | core/features/annotationStyle.ts (external fetch); fix needs a fetch proxy or a fallback palette per styleClass |
| 0046-rendering | YES | no v4 | "Downloads and other formats: PDF version" | core/features/about.ts |
| 0047-homepage | YES | no v4 | homepage link listed in About | about.ts |
| 0053-seeAlso | YES | no v4 | "Related resources: MODS metadata text/xml" | about.ts |
| 0064-opera-one-canvas | YES | no v4 | video 2:01:18, Contents (ranges with times) | - |

### 組 B の表

**Kasane x IIIF Cookbook survey, group B (33 recipes) — 2026-10-14**
Method: headless Playwright (1.62.1) against https://kasane.ldas.jp/ja/viewer/?iiif-content=<url>, screenshots + DOM/network checks + source reading. Throwaway scripts/screenshots in scratchpad mx/B/.
v4 availability: only 0219, 0253, 0608 have a v4 manifest (all load in Kasane, v4 URL used). All others are v3 only (v4 URL returns the iiif.io 404 redirect). 0230/0318 are Collections (navdate-collection.json / collection.json); 0466/0599 reuse 0001 / 0006 manifests; 0485/0540 are content-state annotation.json files.

| folder | verdict | v4 loads? | what is missing / evidence | likely code location to fix |
|---|---|---|---|---|
| 0065-opera-multiple-canvases | YES | v3 only | 2 pages, pager 1/2, thumbnails (also in samples.ts) | - |
| 0074-multiple-language-captions | YES | v3 only | video with en/it VTT tracks in DOM; transcript tab (in samples) | - |
| 0103-poetry-reading-annotations | YES | v3 only | audio + annotation transcript tab (in samples) | - |
| 0117-add-image-thumbnail | YES | v3 only | manifest thumbnail shown in info tab (サムネイル) | - |
| 0118-multivalue | YES | v3 only | multi-value metadata (both alt titles) and fr title shown. Painting shows "画像を読み込めませんでした" but that is upstream: the Wikimedia 1114px thumbnail URL returns HTTP 400 (curl too), not a Kasane bug | - |
| 0135-annotating-point-in-canvas | YES | v3 only | PointSelector drawn as blue dot, list shows tag "Town Creek Aqueduct" | - |
| 0139-geolocate-canvas-fragment | YES | v3 only | map tab: Polygon with target region xywh, OSM link | - |
| 0154-geo-extension | YES | v3 only | map tab shows Point 34.07764,-118.47456 | - |
| 0202-start-canvas | YES | v3 only | opens at 2/5 (start=p2) | core/features/structure.ts start |
| 0219-using-caption-file | YES | yes (v4 only used) | video has VTT track; transcript tab | - |
| 0229-behavior-ranges | YES | v3 only | TOC tab: thumbnail grid (thumbnail-nav), first no-nav range omitted | StructurePanel.tsx |
| 0230-navdate | YES | v3 only (collection) | chronological sort + year grouping + date per item (年代順) | core/features/chronology.ts |
| 0234-provider | YES | v3 only | 権利 tab shows 提供者 UCLA Library (logo/homepage not separately verified) | core/features/about.ts |
| 0240-navPlace-on-canvases | YES | v3 only | map tab, per-canvas place | - |
| 0253-using-transcript-file | YES | yes (v4 used) | transcript text shown in 文字起こし tab | - |
| 0258-tagging-external-resource | YES | v3 only | tag + wikidata URL shown with the region; URL is not resolved to a label | - |
| 0261-non-rectangular-commenting | YES | v3 only | SVG polygon drawn on image | - |
| 0266-full-canvas-annotation | YES | v3 only | whole-canvas comment listed | - |
| 0269-embedded-or-referenced-annotations | YES | v3 only | referenced annotationpage.json loaded and listed | - |
| 0283-missing-image | YES | v3 only | canvas 2 shows "この画像はありません" placeholder, pager 2/4; minor: its thumbnail in page list is labelled "Scene" | PagesPanel / thumbnail fallback |
| 0299-region | YES | v3 only | ImageApiSelector region 1768,2423,1768,2080 requested; only the article region shown | - |
| 0306-linking-annotations-to-manifests | YES | v3 only | external annotation page with partOf manifest target loaded, region drawn | - |
| 0309-annotation-collection | YES | v3 only | collection node (anno_coll.json, 4 items) + paged annotation pages | - |
| 0318-navPlace-navDate | YES | v3 only (collection) | 5 items, chronological, map tab, date + place per item | - |
| 0326-annotating-image-layer | YES | v3 only | Choice layers; annotation nested inside the X-ray image body is drawn only on X-ray layer, text "A group of skulls." appears on click. Minor: the アノテーション tab lists 0件 (not shown in list) | CanvasAnnotationsPanel / annotations.ts |
| 0346-multilingual-annotation-body | YES | v3 only | Choice body picks ja text in ja UI | - |
| 0377-image-in-annotation | PARTIAL | v3 only | Image body is shown as a bare URL link, not as a picture/thumbnail (the region box and text body are fine) | react/panels/CanvasAnnotationsPanel.tsx Body(): for resourceType Image render an <img> (AnnotationImages.tsx already exists for the editor card); core/features/annotations.ts line ~287 |
| 0434-choice-av | NO | v3 only | Loads without error but the viewer area is blank: no <audio>, no player, no choice bar. Cause (from source): v3 Canvas whose only painting body is a Choice of Sound items is not recognised as flat media, so it becomes an empty Scene | packages/iiif-viewer/src/core/services/manifestConverter.ts paintsOnlyFlatMedia(): look inside body.items when body.type==='Choice'. Then ChoiceBar (react/displays/ChoiceBar.tsx) already supports audio options |
| 0466-link-for-loading-manifest | YES | v3 only | ?iiif-content=<manifest url> loads (0001 manifest) | core/contentState.ts |
| 0485-contentstate-canvas-region | YES | n/a | annotation.json (content state URL) resolved, opens spread 2-3/5, yellow box on region xywh=1528,3024,344,408 | core/contentState.ts |
| 0489-multimedia-canvas | YES | v3 only | after Play, image + clock video appear at t=11 (timeline composition, text at t=0..1) | react/displays/CompositeDisplay.tsx |
| 0540-link-for-opening-multiple-canvases | PARTIAL | v3 only | The 2 targets live in two different manifests (manifest-2 canvas/2 + manifest canvas/p2). Kasane opens only the first (The Colosseum); the second canvas / manifest is ignored, no compare view. Multi-canvas compare (PR #51) only matches canvases inside one manifest | ContainerList.tsx onDrop/matchTargets + core/contentState.ts manifestFromParams: load every target's partOf manifest, put canvases together in the compare view |
| 0599-drag-and-drop | YES | v3 only | synthetic drop of text/uri-list with iiif-content link replaced the loaded manifest (0001 -> 0006); real browser link drags use the same data types | react/ContainerList.tsx (parseDroppedText) |
| 0608-mvm-3d | YES | yes (v4 used) | 3D model renders in canvas, camera buttons | - |

Counts: YES 30, PARTIAL 2, NO 1 (total 33).
Caveats: judged on production as of 2026-10-14 in Chromium headless on desktop; 0234 logo/homepage rendering, real (non-synthetic) drag in 0599 and audio playback were not exercised.

### 直したこと（同日）

調査で見つかった不足を、4 本の PR で直した。どれもマージ済みで、本番（2c4af0a）で目で確かめた。

- #84（fix/choice-av）: 0434。音声の Choice だけを描く Canvas が、空の Scene になっていた。
  Choice の中身を見て平面のメディアと判定するようにした。あわせて 0283 のサムネイルの名前を「No image」に。
- #85（feat/annotation-bodies）: 0377 の画像の本文を画像として出す（URL だけだった）。
  0326 のレイヤーに付いたアノテーションを一覧に出し、「レイヤー: X-ray」と添える。
  0258 の Wikidata のタグをラベル（表示言語、無ければ英語）で出す。取れないときは URL のまま。
  0045 は外部のスタイルシートが CORS で読めないので、読めないときは styleClass ごとに固定の色を割り当てる。
  #84 と同じ変更（画像の Choice → 平面の Canvas）を含んでいたため、競合は main 側を残して解いた。
- #86（feat/contentstate-multi-manifest）: 0540。2 つの Manifest にまたがる対象を並べて開く。
- 画像の Choice を平面の Canvas に変えたことで、0033・0036・0040・0608・0009 が崩れていないかも本番と見比べた（問題なし）。

### 却下した案

- **0045 の外部スタイルシートを中継（プロキシ）で取りに行く。** 置かないことにした。
  固定の色でも、レシピの意図（作者ごとに色を分ける）は伝わる。

### 確かめたこと（PR を出す前）

- v3 の 67 件と v4 の 6 件のリンクを、すべて Playwright で開いた。開けないのは 0118 だけ。
  原因は先方の Wikimedia の画像が HTTP 400 を返すことで、Kasane の問題ではない。
- 0269 と 0306 は、annotationpage.json だけを開くと「この画像はありません」になる。
  Manifest のほうのリンクは開ける。先方への確認一覧から annotationpage.json のリンクを外した。
- 全リンクの確認動画（4K、84 本）を撮り、リリース cookbook-review-clips に置いた。
  音声の Choice（0434）と 0489 は、Playwright 付属の Chromium では再生できない（コーデックが無い）。実の Chrome で撮った。

### 先方への PR

- IIIF/cookbook-recipes#734: v4 の 6 レシピに Kasane を足す。
- IIIF/cookbook-recipes#735: v3 の 67 レシピの `viewers:` に Kasane を足す。
- 足していないもの: 0057・0464（中身が空）、0068・0560・0561（調べていない）。
- どちらの本文にも、レシピごとの確認リンクと動画のリンクを付けた。レビュー待ち。
