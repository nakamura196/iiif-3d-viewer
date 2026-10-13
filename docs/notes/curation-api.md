# IIIF Curation API への対応

## 2026-10-13

### 何をしたか

CODH の Curation API 1.0（`cr:Curation`、https://codh.rois.ac.jp/iiif/curation/ ）を読めるようにした。
キュレーションは、複数のマニフェストから Canvas（またはその一部の領域）を集めて順番を付けたもの。
Presentation 2.1 の独自拡張で、`selections`（Range の並び）が `canvases` か `members` と、元のマニフェスト（`within`）を持つ。

Kasane はマニフェストを 1 つ読む作りなので、キュレーションを **1 冊の仮のマニフェスト（Presentation 3）に組み立てる** 方式にした
（`packages/iiif-viewer/src/core/features/curation.ts`）。

- items: 使われている Canvas を、元のマニフェストから 1 回ずつ取り出して並べる。各 Canvas の `partOf` に元のマニフェストを足す
- structures: selection を Range にし、その下に member ごとの Range を置く。領域は `#xywh=` のまま持たせる
- start: `?pos=` の番号（1 から）の member。既定は 1 番目
- attribution → requiredStatement、related → homepage

入口は 3 つ: `?curation=<URL>`（IIIF Curation Viewer と同じ引数）、`?iiif-content=<URL>`（中身が `cr:Curation` なら同じ扱い）、
埋め込みの `<iiif-viewer iiif-content=...>`。判定は取ってきた JSON の `@type` で行うので、マニフェストを読む箇所すべてに効く。

### 却下した案

- **Collection と同じ一覧画面から 1 冊ずつ開く方式**: 実装は軽いが、開いた先はただのマニフェストになり、
  「キュレーションの順に、領域を見て回る」ことができない。キュレーションの要がここなので採らなかった
- **member ごとに Canvas を 1 枚ずつ並べる方式**: 同じ Canvas が領域違いで何度も出てくる（仕様の例にもある）。
  1 つのマニフェストの中で Canvas の id は重ねられず、注釈など Canvas の id で引いている箇所が壊れる。
  Canvas は 1 回だけ並べ、順番と領域は目次（Range）の側に持たせた

### 途中で分かったこと

- キュレーションは Presentation 2 の `@context` を持つので、v2 判定に引っかかる。
  そのまま v2→v3 の変換（`@iiif/parser` の upgrader）に通すと壊れるため、**変換より前に** `cr:Curation` を見分ける必要がある
- CODH のサンプルの `within` は `http://`。https のページからは http に繋げない（mixed content）。
  さらに、ブラウザから `http://codh.rois.ac.jp/...` に繋ぐと **503** が返った（curl では 301 で https に転送される）。
  読めなければ `https://` で取り直すようにした（`core/services/utils.ts` の `fetchJson`）
- CODH の画像サーバは、ブラウザから続けてタイルを要求すると 503 を返すことがあった（同じ URL を curl で単独に取ると 200）。
  Kasane 側の問題ではない
- 既存の `start` は、時間（`#t=`）があるときだけ強調していた。領域（`#xywh=`）も強調するようにした
  （`react/ContainerList.tsx`）。キュレーション以外のマニフェストでも、`start` に領域があれば枠が出る

### 測り方と結果

- 単体テスト: CODH のサンプル（`sample/curation.json`）と、参照先の 2 冊のマニフェストを 2026-10-13 に保存して使用
  （`core/services/__fixtures__/codh-*.json`）。2 冊・8 項目から Canvas 6 枚、目次 2 章・8 項目ができること、
  `pos=8` が 2 冊目の `canvas/00010#xywh=2850,1000,730,680` を指すことを確かめた。全体で 281 件通過
- ブラウザ: `?curation=https://codh.rois.ac.jp/software/iiif-curation-viewer/sample/curation.json&pos=4` で、
  1 冊目の 24 ページが開き、蛙の領域に枠が出た。目次・「親」のマニフェスト名・Attribution の表示も確認

### 確かめていないこと（限界）

- Timeline API と組み合わせたキュレーション（`cs:Canvas`、`within` が `tl:Manifest`）は読まない（飛ばす）
- member の `metadata`（顔貌コレクションなどがタグに使っている）は表示しない
- ページ送り（← →）は Canvas の順に進む。同じ Canvas の別の領域へは、目次から移る
- キュレーションは、ビューアの中で 2 回（開発時は 3 回）組み立て直される（元のマニフェストを読む箇所が 2 つあるため）。
  そのたびに参照先のマニフェストを取り直す。ブラウザのキャッシュに当たるが、数百冊を参照する大きなキュレーションでは遅くなるかもしれない
