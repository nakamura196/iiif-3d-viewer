# モデルの追加の手引き（推論タブ）

推論タブ（ブラウザの中で OCR などを動かす機能）に、モデルを 1 つ足すときの手順。
PP-OCRv6 を足したとき（2026-10-16）の作業を、そのまま手順にした。経緯と実測は
[`docs/notes/browser-inference.md`](notes/browser-inference.md) にある。

足すファイルは原則 3〜4 つで、共有のファイルは一覧（`registry.ts`）に 1 行足すだけ。

```
packages/iiif-viewer/src/react/inference/models/
  <名前>.ts           モデルの説明（名前・説明文・ライセンス・ファイルの場所）。軽い。画面が読む
  <名前>.run.ts       実際に動かす処理。Worker の中でだけ読み込まれる
  <名前>.chars.json   字の一覧（OCR のとき）
  registry.ts         一覧に 1 行足す
packages/iiif-viewer/src/core/features/inference/
  <手順>.ts           前処理・後処理（React に依存しない）。既存の手順に乗るなら触らない
```

型は `models/types.ts` の `InferenceModel`。ファイルの置き方の決まりは
`packages/iiif-viewer/EXTENDING.md` の表にある。

## 1. 候補を調べる

まず、ブラウザで動く形（ONNX）の公式の配布物があるかを見る。

```
curl -s "https://huggingface.co/api/models?author=PaddlePaddle&search=PP-OCRv6&limit=50" | python3 -c "import sys,json; [print(m['id']) for m in json.load(sys.stdin)]"
```

確かめること:

- **ライセンス**（Hugging Face の `cardData.license`）。サイトに表示するので正確に
- **ファイルの大きさ**。利用者の端末に毎回ダウンロードさせるので、数十 MB までが目安。
  `https://huggingface.co/api/models/<リポジトリ>?blobs=true` の `siblings[].size` で分かる
- **固定の版（revision）**。同じ API の `sha`。URL にはこれを入れる（後述）
- **字の一覧に、読みたい字が入っているか**（OCR のとき）。名前や評価表だけで決めない。
  PP-OCRv6 の tiny 版は日本語の評価が高いが、字の一覧（6,904 字）に**仮名が 1 字も無かった**。
  漢字だけの評価だったとみられる。small 版（18,708 字）には仮名 180 字が入っている

公式の ONNX が無いときは、自分で変換して `nakamura196/<名前>-web-onnx` に置く（PP-OCRv5 はそうした。
paddle2onnx の使い方は実験ノートの 2026-10-14 の節）。

### ONNX の中身を見る

```
python -I -c "import onnx,collections; m=onnx.load('inference.onnx'); g=m.graph; print([(o.domain,o.version) for o in m.opset_import]); print([(i.name,[d.dim_param or d.dim_value for d in i.type.tensor_type.shape.dim]) for i in g.input]); print([(o.name,[d.dim_param or d.dim_value for d in o.type.tensor_type.shape.dim]) for o in g.output]); print(sorted(collections.Counter(n.op_type for n in g.node).items()))"
```

- 入力・出力の形が、既存の手順が渡す形と同じか。PP-OCR の読み取りなら、出力の最後の次元が
  「字の数 + 2」（先頭の空白と末尾のスペース）になっていること。v6 small は 18,710 だった
- 演算子（op_type）が標準のものだけか。独自の演算子があると onnxruntime-web で動かない

## 2. 公式の手順と、既存の写しの違いを確かめる

Kasane の手順は、公式の推論の手順を TypeScript に写したもの。新しい版で手順が変わっていないかを
**公式のソースで**確かめる。PaddleOCR なら、`pip install paddleocr` で入る paddlex の中を見る。

```
grep -rn "PP-OCRv6" <venv>/lib/python3.12/site-packages/paddlex/configs/pipelines/OCR.yaml
```

**落とし穴: モデルに付いている設定ファイルと、公式のパイプラインの設定が違うことがある。**
PP-OCRv6 の検出モデルの `inference.yml` には、検出のしきい値が 0.2・0.4、広げる倍率が 1.4 と書いてある。
ところが公式の OCR パイプライン（`paddleocr ocr` や `PaddleOCR()`）は、`OCR.yaml` の値
（0.3・0.6・1.5。v5 と同じ）で上書きして動く。モデル単体（`TextDetection`）で動かしたときだけ、
`inference.yml` の値になる。

Kasane は公式のパイプラインに合わせているので、v6 でも v5 と同じ値でよかった。
`inference.yml` だけを見て値を変えると、公式と結果がずれる。

PP-OCRv6 で確かめた結果、前処理（検出の縮小・正規化、読み取りの高さ 48）も後処理も v5 と同じで、
違うのはモデルのファイルと字の一覧だけだった。

## 3. ファイルを足す

### 字の一覧（OCR のとき）

読み取りモデルの `inference.yml` の `PostProcess.character_dict` を、そのまま JSON の配列にする。
YAML の読み込みは js-yaml でよい（ESLint などの依存として `node_modules` に入っている）。

```
node -e 'const y=require("js-yaml"),fs=require("fs"); fs.writeFileSync(process.argv[2], JSON.stringify(y.load(fs.readFileSync(process.argv[1],"utf8")).PostProcess.character_dict.map(String)))' inference.yml <名前>.chars.json
```

`map(String)` を忘れない。YAML は `0` や `1` を数に読む。既存の `ppocrV5.chars.json` を
同じ方法で作り直すと、元のファイルと完全に一致することを確かめてある。

### モデルの説明（`<名前>.ts`）

既存のもの（`ppocrV6.ts`）を写して直す。気をつけること:

- **URL は固定の版にする。** `resolve/main/` ではなく `resolve/<sha>/`。ブラウザは一度落としたファイルを
  持ち続けるので、配布元が中身を差し替えると、利用者ごとに違うモデルで動くことになる
- `bytes` は実際の大きさ（ダウンロードの進み具合と、ボタンの「31 MB」の表示に使う）
- `credit` は作った人。自分で変換したなら「（ブラウザ用の変換: 中村 覚）」を添える。公式の ONNX を
  そのまま使うなら作った組織だけ
- `imageLongSide` は、モデルに渡す画像の長辺。PP-OCR は 2,048px
- 説明文には、実測で確かめたことだけを書く

ブラウザから直接ダウンロードするので、配布元が CORS（別のサイトからの読み込み）を許していること。
Hugging Face は許している。確かめ方:

```
curl -sIL -H "Origin: https://example.org" "<URL>" | grep -i "access-control-allow-origin\|content-length"
```

### 動かす処理（`<名前>.run.ts`）

既存の手順に乗るなら、数行で済む。PP-OCR の各版は `ppocr.shared.ts` の `ppocrRunner` を共有している。

```ts
import { ppocrRunner } from './ppocr.shared';
import chars from './ppocrV6.chars.json';

export const run = ppocrRunner(chars as string[]);
```

新しい種類のモデルで、前処理・後処理を書く必要があるなら、React に依存しない部分を
`core/features/inference/<手順>.ts` に置き、テスト（`<手順>.test.ts`）を付ける。

### 一覧に足す（`registry.ts`）

`MODELS` の配列に 1 行。ここの順が、推論タブとモデル一覧のページに並ぶ順になる。

## 4. 公式と突き合わせる

写した手順が公式と同じ結果を出すかを、同じ画像で比べる。道具は `scripts/inference/` にある。

| ファイル | すること |
| --- | --- |
| `ppocr-official.py` | 公式の PaddleOCR で読む。同じ画素を `.rgba` にも書き出す |
| `ppocr-ours.mts` | Kasane の手順（`core/features/inference/ppocr.ts`）を Node で動かす |
| `ppocr-compare.py` | 行を枠の重なりで対応させ、字の差を数える |

準備（リポジトリの外の作業用フォルダで。依存をリポジトリに足さないため）:

```
uv venv -p 3.12 venv
VIRTUAL_ENV=$PWD/venv uv pip install paddleocr paddlepaddle onnxruntime onnx
mkdir harness && cd harness && npm init -y && npm install --ignore-scripts onnxruntime-node@1.22.0 tsx@4.19.2
```

画像は IIIF Image API で、ブラウザと同じ大きさ（長辺 2,048px）で取る。横書きの和文の例:

```
curl -s -o img/ja.jpg 'https://dl.ndl.go.jp/api/iiif/3048008/R0000024/full/2048,/0/default.jpg'
```

実行:

```
venv/bin/python -I <repo>/scripts/inference/ppocr-official.py img out v6 ja
cd harness && npx tsx <repo>/scripts/inference/ppocr-ours.mts <repo> ../img/ja.2048x1367.rgba 2048 1367 det.onnx rec.onnx <repo>/packages/iiif-viewer/src/react/inference/models/ppocrV6.chars.json ../out/ja.ours-v6.json
python3 -I <repo>/scripts/inference/ppocr-compare.py out/ja.official-v6-bs6.json out/ja.ours-v6.json
```

読み方:

- **行の数と枠の重なり（IoU）**: 検出の写しが合っているか。平均 0.95 以上が目安
- **字の差**: 読み取りまで含めて合っているか。英語の活字なら 0% 近くになる
- 和文は、行の枠が 1 画素ずれるだけで読みが変わる字がある。紙面が少し傾いていると差が出やすい。
  **前の版でも同じ画像で比べ、差が同じ程度か小さければ、新しい版に固有の問題ではない**と判断できる
  （PP-OCRv6 の和文 1.78% に対し、v5 は同じ画像で 4.17%）
- 公式は読み取りを 6 行ずつまとめて行う。まとめ方の影響を除くには `BS=1` を付けて公式を動かす

## 5. ブラウザで確かめる

```
npx next dev -p <空いているポート>
```

他の worktree の開発サーバとポートがぶつかることがある（`EADDRINUSE`）。
`lsof -ti tcp:<ポート>` で空きを確かめてから起動する。

推論タブで「ダウンロード」→「この画像で実行」。確かめること:

- 枠が行の上に重なるか
- 件数・かかった時間・動いた方式（`webgpu + wasm` など）が出るか
- Node での結果と、ほぼ同じ文字になるか

## 6. 仕上げ

- `npx vitest run`、`npx tsc --noEmit -p .`、`npx eslint <触ったフォルダ>`
- 実験ノート（`docs/notes/browser-inference.md`）に、日付の節を足す。何をしたか・決めたこと・
  やめた案・実測・確かめていないこと
- サイトでの紹介（ユースケース・お知らせ・サンプル）に載せるかを検討し、PR の本文に書く
  （リポジトリの `CLAUDE.md` の決まり）
