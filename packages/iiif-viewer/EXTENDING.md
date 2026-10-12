# 機能の足し方（並行で作業するときの決まり）

機能は「1 機能 1 担当 1 組のファイル」で足す。ほかの機能のファイルは書き換えない。

| 足すもの | 書くファイル（新規） | 共有ファイルで触る所 |
| --- | --- | --- |
| 表示（ページ送り・合成など） | `src/react/displays/<名前>Display.tsx`（型は `displays/types.ts`） | `displays/registry.ts` に 1 行 |
| 右パネルのタブ | `src/react/panels/<名前>Panel.tsx`（型は `panels/types.ts`） | `panels/registry.ts` に 1 行 |
| 画像の上に重ねる表示 | `src/react/overlays/<名前>Overlay.tsx`（型は `overlays/types.ts`） | `overlays/registry.ts` に 1 行 |
| 読み取り（React に依存しない） | `src/core/features/<機能>.ts` と `<機能>.test.ts` | 無し（`features/index.ts` に用意済み） |
| 文言 | `src/react/messages/features/<機能>.{ja,en}.json` | 無し（`messages/index.ts` が足し合わせる） |

機能の枠（用意済み）: `image`（画像・深いズーム・重ね表示）、`structure`（ページ送り・目次）、`temporal`（時間の指定・複数メディア）、`about`（来歴・権利・リンク）、`annotations`（Canvas 上の注釈）。

## 操作をどこに置くか

- **応用的な操作は、右パネルのタブとして足すのを基本とする**（例: レイヤーの表示・不透明度・重ね順、注釈の絞り込み、目次）。
  画像の領域を狭めない。`available` で、使える Canvas のときだけタブが出る。埋め込み（`<iiif-viewer>`）でも同じ場所にある
- 画像の上の帯に置くのは、その Canvas を見るのに欠かせない最小限の切り替えだけ（Choice の候補選び、ページ送り）
- 同じものを帯とタブの両方で操作するときは、同じ状態（`atoms.ts`）を読み書きし、食い違わないようにする
  （例: Choice の候補選びは、レイヤーの表示・非表示として持つ）
- タブを足したら、サイトの `?tab=` の許可一覧（`src/components/page/ViewerContent.tsx` の `TABS`）にも足す

## 守ること

- `core/containers.ts`・`Viewer.tsx`・`Info.tsx`・`messages/ja.json`・`messages/en.json` は書き換えない。足りないときは、担当に頼む（または別 PR で先に直す）
- `core` は React・Next.js・DOM に依存しない。テストを同じ場所に置く
- 再生位置は `usePlayback()`、画面の状態は Viewer ごとの jotai store（`atoms.ts`）。グローバルな変数を作らない
- 表示とパネルは、`ContainerInfo`（`core/services/containers.ts`）を入力にする
