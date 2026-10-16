# 実寸の物差し（IIIF physdim service）

## 2026-10-16

### 何をしたか

Mirador のプラグイン mirador-physical-ruler（nakamura196）の物差しを、Kasane の画像（2D）表示に移した。
Canvas の service に physdim（`physicalScale`: 1 ピクセルあたりの実寸、`physicalUnits`: mm / cm / in）があるときだけ、
画像の上端と左端に目盛りが出る。拡大・移動に合わせて目盛りの間隔と数字が変わる。

- 読み取りと計算: `core/features/physdim.ts`（試験は `physdim.test.ts`）。
  service は配列でも単体でもよく、`profile` は文字列でも配列（Presentation 2）でもよい。
  `profile` が無くても `@context` や `type` に physdim とあれば読む
- 表示: `react/displays/PhysicalRuler.tsx`。`ImageView` の `over`（ステージの外、画面の座標で描く場所）に置く。
  左上の歯車から、文字の大きさ・目盛りの長さ・色・背景の濃さ・単位（mm / cm / in）を変え、「定規を隠す」で消せる。
  隠すと左上に「定規」ボタンだけが残る。設定は画面を開いている間だけ覚える（保存はしない）
- 文言: `messages/features/physdim.{ja,en}.json`
- サンプル: `public/manifests/physdim-{hyakki,kaitou,ryukyu}.json`（元は mirador-physical-ruler の `demo/`）。
  `/samples` に百鬼夜行図と海東諸国紀の 2 件を足し、サムネイルを撮った

### 目盛りの計算

ステージは Canvas を箱にちょうど収めた大きさ（`stageW`）で、そこへ CSS で `scale` 倍と移動をかける。
したがって、画面上の Canvas の幅は `stageW × scale`、1 画面ピクセルあたりの Canvas ピクセルは
`canvasWidth / (stageW × scale)`。表示単位 1 あたりの画面ピクセル（`pixelsPerUnit`）は
`stageW × scale / (canvasWidth × physicalScale × 単位換算)`。
Canvas の左上の画面位置は `箱の幅/2 + tx − stageW × scale / 2`（縦も同じ）。

目盛りの間隔は、約 80 px になる 1・2・5 × 10^n（元のプラグインと同じ）。
元は目盛りを定規の帯の太さだけずらして描いていたが、ここでは Canvas の位置そのままに描き、
帯（28 px）に隠れる分だけを除いた。Canvas の左上より手前、右下より先には目盛りを出さない。

### 決めたこと・確かめたこと

- 物差しは SVG で、拡大しても太さと文字が変わらない。画像のドラッグ・ホイールが効くよう `pointer-events: none`、
  歯車と設定の枠だけがクリックを受ける
- ブラウザ（Playwright）で百鬼夜行図を開き、ホイールで拡大すると、横の目盛りが 50 cm 刻み（初期）から 10 cm 刻みに変わり、
  数字も 310〜420 cm の範囲に変わることを確かめた
- 百鬼夜行図の physicalScale（0.09993 mm/px）は、公開されている縦 28 cm から求めた推定値（マニフェストの備考にある）。実測値ではない

### 残したこと・限界

- `physdim-ryukyu.json` は、元の画像（www.hi.u-tokyo.ac.jp の ryukyu）が 404 を返すため、画像が出ない。
  ファイルは置いたが、`/samples` には載せていない。画像の置き場が見つかれば足す
- 回転した画像・複数の画像を重ねた Canvas では、Canvas 全体に対する縮尺として目盛りを出すだけで、回転は考慮していない
- 設定のブラウザへの保存はしていない
- トップページの例には足していない
- 本番（kasane.ldas.jp）に配るまで、サンプルの URL は開けない

## 2026-10-16（追記）

- ユースケースとサンプルに載せる資料から、史料編纂所の所蔵資料を外すことにした。
  ユースケースの『海東諸国紀』（kaitou-ruler）を、東京大学総合図書館の『百鬼夜行図』（hyakki-ruler）に差し替えた。
  `/samples` の海東諸国紀も外し、`physdim-kaitou.json` と、画像が出ないまま置いていた `physdim-ryukyu.json` を消した
- 百鬼夜行図は 1 枚の横長の絵巻なので、「ページを移しても物差しが付く」例は無くなった
