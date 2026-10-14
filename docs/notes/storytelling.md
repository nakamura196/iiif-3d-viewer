# デジタルストーリーテリング（ガイドツアー）への対応

## 2026-10-14

### 何を目指すか

倭寇図巻の「ストーリー」表示（https://www.hi.u-tokyo.ac.jp/collection/digitalgallery/wakozukan/story/?u=…/data/cp/story/m.json ）
のように、画像の領域を順に寄りながら説明を読ませる表示を Kasane で出したい。
既存の m.json の書き方をそのまま写すのではなく、他の実装を調べてから、なるべく標準の部品で書ける形にする。

### m.json の中身（実測）

- IIIF Presentation 3 のマニフェスト。Canvas 1 枚（90916×6615 の巻物）、`viewingDirection: left-to-right`
- Canvas の `annotations` の最初の AnnotationPage に、`motivation: describing` の注釈が 31 件。
  本文は `TextualBody`（`format: text/html`）、対象は `#xywh=` の領域
- 見せる順番 = 配列の順番。順番を書く欄は無い
- 章 8 件と細部 23 件の区別は、本文の先頭に `<h2>` があるかどうかだけ（例: 「（１）倭寇船の登場」）。
  細部は直前の章の領域の中にある
- 本文に表示用のクラス（`annotatedzoom-annotation-detail__label` など）が入っている。言語の指定（`language`）は無い
- `metadata` に `test_label` / `test_value` の仮の値が残っている。`behavior: individuals` は 1 Canvas のマニフェストには意味が無い
- 表示は Digirati の `@canvas-panel/full-page-plugin` v0.2.0（React 16、OpenSeadragon 2.4.1、2019 年ごろ）

### 先行事例の調査

調べたもの（Web とリポジトリの実物。サブエージェントの調査を、主な 2 件はコードで確かめた）:

- **Digirati Manifest Editor の Exhibition（TU Delft と共同）** — https://github.com/digirati-co-uk/iiif-manifest-editor
  （最終コミット 2026-10-14、活発）。「Create Tour」で Canvas の最初の AnnotationPage を作り、
  ステップ 1 件 = 注釈 1 件。**ステップの見出しは本文 HTML の先頭の `<h1>`〜`<h6>`** で、
  `presets/exhibition-preset/src/components/tour-step-html.ts` の `splitTourStepHtml` が見出しと本文に分ける。
  表示の切り替えは Canvas の `behavior` に独自の値を足す（`non-linear-tour`、`tour-marker-pin`、`splash` など）。
  → **m.json はこの書き方とほぼ同じ。** 倭寇図巻の形式は古いビューア専用ではなく、今も使われている慣習に乗っている
- **Storiiies（Cogapp）** — https://github.com/CogappLabs/StoriiiesViewer （最終コミット 2026-06-29）。
  P3 マニフェストに埋め込んだ `annotationPages` を順に見せる。本文は `text/plain` か `text/html`。
  点の注目箇所は `PointSelector`（Cookbook 0135）。`label` / `summary` が表紙のスライドになる。
  外部参照の AnnotationPage、複数画像、多言語は非対応と README に明記
- **Annona（NCSU）** — P2 の AnnotationList 前提。Range storyboard で複数画像を順に見る。保守状況は未確認
- **Exhibit（Mnemoscene）** — 内部の形式は未確認。Kiosk / Scroll / Slides / Quiz の表示
- **Mirador / Universal Viewer** — ツアー専用のプラグインは見つからなかった
- **IIIF の仕様・Cookbook** — 「ツアー」専用の仕組みやレシピは無い。
  目次は Range（0024、Canvas の一部も指せる）、別の閲覧順は `behavior: sequence` の Range（0027）、
  領域を指して開くのは Content State。どれも「順に送りながら説明を読む」ことまでは決めていない
- **W3C Web Annotation** — 注釈の並びに順番の意味を与える決まりは見当たらない（未確認な部分あり）。事実上「配列の順」が慣習
- 比較の文献: FARO「Overzicht van de verschillende op IIIF gebaseerde storytellingtools」(2023)
  https://www.faro.be/sites/default/files/WP4%20Taak%209%20Deliverable%2011.%20Overzicht%20van%20de%20verschillende%20op%20IIIF%20gebaseerde%20storytellingtools.pdf
  （本文は読み切れていない）

主張の候補: IIIF のストーリーテリング表示は、専用の形式を作らず「Canvas の最初の AnnotationPage の describing 注釈を配列順に見せる」という
慣習に収れんしている（Digirati Exhibition・Storiiies・倭寇図巻 m.json が同じ型）。根拠は上の 3 件のコードと README。

### 途中で分かったこと

- Kasane には既に近い部品がある。注釈の表示、目次（Range）の読み取り、キュレーション（`curation.ts`、
  領域つき Range を順に並べ `?pos=` で位置を指す）。足りないのは「ステップを送りながら、その領域に寄って本文を大きく見せる」表示

### 方針の案（未決）

1. **読み取りは慣習に合わせる。** Canvas の最初の AnnotationPage の `describing`（と `commenting`）注釈を、配列順にステップとして扱う。
   本文先頭の見出しタグをステップの見出しにする（Digirati と同じ規則）。これで m.json も Digirati・Storiiies の出力も、そのまま読める
2. **改善はすべて「あれば使う」形で足す。** 無くても動く
   - 章: `structures` の Range で章を書き、`items` に注釈の対象（`#xywh=` の SpecificResource）を入れる。
     Range が無ければ 1 と同じく平らに並べる。`<h2>` の有無で章を推し量るのは補助にとどめる
   - 多言語: `TextualBody` に `language` を付けて複数並べる（W3C の書き方どおり）。UI の言語で選ぶ
   - 複数 Canvas: ステップの対象が別の Canvas でもよいようにする（Storiiies・Annona の制約を避ける）
3. **独自の `behavior` は増やさない。** 要るなら Digirati の値（`non-linear-tour` など）を借りる

確かめていないこと: Digirati Exhibition の実際の出力マニフェスト（JSON の実物）、Exhibit の形式、FARO 報告書の本文。

### 方針を決めた（同日、本人了承）

上の「方針の案」1〜3 のとおりにする。今の書き方をそのまま読み、章（Range）・多言語・複数 Canvas は「書いてあれば使う」。独自の behavior は作らない。

### 実装した（同日）

- 読み取り `packages/iiif-viewer/src/core/features/story.ts`。ステップは describing / commenting で文字の本文を持つ注釈、Canvas の順につなぐ。
  ステップが 2 件未満か、どれも Canvas 全体を指すときは「ストーリー無し」
- 章の決め方: Range があれば、Range の領域と同じ領域、無ければ中心を含むいちばん小さい領域の Range に入れる。
  Range が無く、見出しのあるステップと無いステップが混ざるときだけ、見出しのあるステップを章の頭にする。
  全部に見出しがある（Digirati の書き方）なら章にしない
- 右パネルに「ストーリー」タブ（order 15）。前へ／次へ、本文、場面の一覧。画像上の枠を押すと、その場面に合わせる
- 画像の表示（ImageView）が、目次やステップの移動先の領域へ寄るようにした（これまでは見開き表示で枠を出すだけで、1 枚の画像では寄らなかった）。
  目次・キュレーションの移動にも効く
- テスト: 倭寇図巻 m.json の先頭 7 件を `__fixtures__/wakozukan-story.json` に保存（章 3 つ、細部 4 件を読めること）

### 途中で分かったこと

- **注釈の枠線が、深く拡大すると太くなっていた（既存の不具合）。** 舞台ごと CSS の transform で拡大しているため。
  倭寇図巻は 90916 px の巻物で、細部に寄ると約 130 倍になり、2 px の枠が数十〜百 px の帯になって絵を隠した。
  - `border-width: calc(2px / var(--image-scale))` は効かない。Chrome は枠線を拡大の前に 1 px 未満にしない
  - SVG の `vector-effect: non-scaling-stroke` も効かない。外側の CSS transform を見ていない
  - `box-shadow: inset 0 0 0 calc(2px / var(--image-scale))` は効いた（Chrome で確認）。長方形の枠はこれにした。
    マニフェストの stylesheet が枠線を指定しているとき（レシピ 0045）は、その指定を残す
  - 多角形（SVG）の枠は同じ問題が残っている（未対応）
- 画像は Image API の深いズームが効く（cantaloupe の level2、512 px タイル）。寄った直後の数秒はぼやけ、タイルが来ると鮮明になる

確かめていないこと: Safari・Firefox・スマートフォンでの表示。多角形の枠。複数 Canvas・Range・多言語の実データでの見た目（テストのみ）。

### 枠と色を消した（同日、本人の指摘）

本人から「色や枠線が付いていると醜い」。ストーリーでは寄ること自体が場所を示すので、
ストーリーのタブを開いている間は注釈の枠を出さないことにした。
タブの「場面の枠を表示」を入れたときだけ、いまの場面の枠を 1 つ、塗りなしの細い線で出す。注釈タブに移れば元の表示に戻る。

あわせて、新しい機能を足したらユースケース・お知らせ・サンプルに載せるかを検討することを、
リポジトリ直下の CLAUDE.md に標準の作業として書いた（本人の指示）。

### ユースケースとお知らせに載せた（同日）

- ユースケース `wakozukan-story`（倭寇図巻をストーリータブで開く）、札「ストーリー」を新設。お知らせ item14
- サムネイルを撮るとき、黄色い枠と塗りが出た。目次の移動先を示す枠（見開き表示の `RegionHighlight`）が、
  ストーリーの移動にも反応していた。ストーリーのタブを開いている間は出さないようにした
- 開いた直後は巻物の全体なので、サムネイルは一覧の「（２）倭寇の上陸」を押してから撮る。深く寄るとタイルが届くまで 10 秒ほどかかる
- サムネイルは手元の開発サーバで撮った（本番にはまだタブが無い）。隅に Next.js の印が写るので、公開後に本番で撮り直すとよい
