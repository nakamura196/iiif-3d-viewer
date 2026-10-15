# IIIF バーチャル美術館（/gallery/）

任意の IIIF（Curation / Collection / Manifest）を、3D の仮想美術館として歩いて鑑賞するページ。
元は [nakamura196/iiif-vr-gallery](https://github.com/nakamura196/iiif-vr-gallery)（2026-09-08 版）で、
2026-10 に Kasane へ統合した。旧サイト（nakamura196.github.io/iiif-vr-gallery/）は、ここへ移るように変えてある。

## 置き場所

- `engine/` — 描画と操作の本体。元の `docs/src/*.js` をほぼそのまま移した素の JavaScript
  （lint の対象外）。設定は `engine/config.json`（元の `docs/config.json`）
- `gallery.css` — 見た目。元の `docs/index.html` の `<style>`。画面全体（`position: fixed`）だった部品を、
  ヘッダーの下の枠（`#vrg`）基準に変えた
- `../page/GalleryContent.tsx` — 部品の置き場所（id 付きの要素）を用意し、`startGallery()` で起動、
  ページを離れるときに `stopGallery()` で後片付けする
- `public/gallery/` — アバター（`assets/*.glb`）、見本の展示（`sample/`）、OpenSeadragon のボタン画像（`osd-images/`）

## 元からの主な変更

- three.js を 0.160 から Kasane の 0.178 に上げた。r163 以降の `RoomEnvironment` は中の点光源が強く（5 → 900）、
  室内が明るくなりすぎるので、元の強さ（5）に戻している（`engine/scene.js`）
- OpenSeadragon は CDN ではなく npm の 4.1.1（元と同じ版）
- 言語は `?lang=` ではなく Kasane の URL（`/ja/`・`/en/`）で決める
- 描画の大きさは画面全体ではなく `#scene` の大きさ。クリック位置も描画領域の左上から測る

## URL で指定できること（元と同じ）

`?u=<IIIF の URL>`、`?selections=0,2`、`?limit=`、`?mode=walk|orbit`、`?quality=auto|high|medium|low`、
`?look=museum`、`?vc=auto|always|off`。

## 権利

- 3D は three.js（MIT）、深ズームは OpenSeadragon（New BSD）
- 見本の画像は東京大学総合図書館バーチャルミュージアムの IIIF を参照している。権利は提供機関に帰属する
- 見本の 3 つ目の展示「広重の東海道と大正の写真」は、国立国会図書館デジタルコレクションの
  『東海道 : 広重画五拾三次現状写真対照』（東光園、1918年、info:ndljp/pid/1873421、パブリックドメイン）を参照している。
  東京大学のサーバ（da.dl.itc.u-tokyo.ac.jp）が止まっていても見本が 1 つは開けるよう、別のサーバから選んだ
- 三人称のアバター（`man.glb`・`girl.glb`・`walk.glb`）は nakamura196/iiif-vr の VRM と Mixamo の歩行を合わせたもの
  （元リポジトリのコミット c7ad87b）。配布元の条件は元リポジトリでも明記されていない（要確認）
