# 動画の時間と範囲への注釈

## 2026-10-15 枠を重ねる表示を足した

**題材。** ArchiveBase の Video Search（https://ab.ldas.jp/ja/na-kamura-1263/video）。
85 本の動画に、AI が付けた注釈が 19,072 件ある（検索 API `api/search?type=annotation` で数えた）。
1 件は、動画の 1 コマで見つかった物の枠で、時刻は `metadata.t`、枠は slug の末尾（`<item>-<t>-<x>-<y>-<w>-<h>`、動画の画素）にある。
`unit` が `shot` のものが枠つき、`segment` のものは枠の無い時間の区間。

**分かったこと（ArchiveBase 側）。**
- 枠つきの注釈は、IIIF の注釈としては出ていない。マニフェスト（`api/iiif/3/<id>/manifest`）にあるのは字幕の VTT だけ。
  Canvas の注釈の窓口（`canvas/p1/annotations`）は OCR の行だけを返し、動画では空
- `metadata.time_end` は、`shot` では開始 + 100 秒になっている（枠の時間としては使えない）
- マニフェストの動画の URL（`ab.ldas.jp/api/assets/...`）は `s3ds.mdx.jp` へ転送され、転送先が CORS を返さない。
  `crossOrigin` を付けた `<video>` では読めない。素のマニフェストが使う `archivebase-s3.ldas.jp` は CORS を返す

**作ったもの。**
- 見本のマニフェスト `public/manifests/sample-manifest-video-objects.json`（`scripts/build-video-objects-sample.mjs` で作る）。
  『芦の尻の道祖神祭り』の枠 125 件（42 コマ、0:05〜0:35）を、target `<canvas>#t=開始,終了&xywh=x,y,w,h` の tagging 注釈にした。
  終了は、同じ動画で次に枠が付いたコマの時刻（最長 1 秒）
- 読み取り: 注釈に `time`（開始・終了・一瞬か）を持たせた。`#t=` の断片、FragmentSelector、PointSelector の `instant` を読む。
  `#t=10` は最後まで、`instant` は 1 秒だけ出す
- 表示: 動画と同じ縦横比の箱を動画の上に置き、その中に割合で枠を置く（黒い余白があってもずれない）。
  再生中は requestAnimationFrame で位置を追う（timeupdate は 1 秒に 4 回ほどで、0.5 秒の枠には粗い）
- 範囲も指す時刻つきの注釈は、文字起こしの一覧から外した（枠と注釈タブに出るので）

**試してやめたこと。** 枠そのものを押せるようにする案。動画の標準の操作（再生・シーク）と重なるので、押せるのは左上の名札だけにした。

**確かめていないこと。** Safari・Firefox・スマートフォン。全画面にすると枠は出ない（全画面になるのは `<video>` だけ）。

**次にできること。** ArchiveBase がこの形の注釈を出せば、見本を作らずに元のマニフェストをそのまま開ける。
