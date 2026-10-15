# 作業する人へ

このリポジトリで、Issue（依頼）を受けて直すときの手順です。
**作業はプルリクエストを出すところまで**です。取り込み・サイトへの反映・共同研究者への連絡は中村が行います。

進め方の全体（「そのまま作る」依頼と「先に方針の確認をもらう」依頼の違い、プルリクエストに付けるもの）は、
[開発の進め方（nakamura196/maintenance）](https://github.com/nakamura196/maintenance/blob/main/%E9%96%8B%E7%99%BA%E3%81%AE%E9%80%B2%E3%82%81%E6%96%B9%EF%BC%88%E5%A6%BB%E5%90%91%E3%81%91%EF%BC%89.md) にあります。先に読んでください。

**main に入った変更は、そのまま本番のサイト（https://kasane.ldas.jp/ ）に出ます。** 開発用のサイトはありません。
そのため、main への直接の push とプルリクエストの取り込み（マージ）は、中村だけが行います。

**このリポジトリは公開されています。** Issue・プルリクエスト・コミットに、先方とのやり取り・個人名・金額・未公開の資料の URL を書かないでください。

## 用意するもの（最初の 1 回だけ）

- GitHub でこのリポジトリに書き込める権限（中村が招待します）
- Node.js 24（本番の組み立てと同じ版）
- 鍵は要りません（`.env.local` も作らなくてかまいません）

```
git clone https://github.com/nakamura196/iiif-kasane.git
cd iiif-kasane
npm ci
```

## 手元でサイトを動かす

```
npm run dev
```

http://localhost:3838/ja を開きます。止めるときは、ターミナルで Ctrl + C を押します。

ビューアの本体は `packages/iiif-viewer/` にあります。サイト（`src/`）はそれを使って画面を組み立てています。
機能を足すときのファイルの置き場所は [`packages/iiif-viewer/EXTENDING.md`](packages/iiif-viewer/EXTENDING.md) にあります。

## 1 つの Issue の流れ

1. main を最新にして、ブランチを作る
   ```
   git switch main
   git pull
   git switch -c fix/issue-<番号>
   ```
2. 直す。画面は `npm run dev` で確かめる。日本語（`/ja/`）と英語（`/en/`）の両方を見る
3. 出す前に、次の 3 つが通ることを確かめる
   ```
   npm run lint
   npm test
   npm run build
   ```
4. コミットして、GitHub に送る
   ```
   git add <直したファイル>
   git commit -m "<何を直したか>"
   git push -u origin fix/issue-<番号>
   ```
   `git add .` は使わず、ファイルを 1 つずつ指定します（意図しないファイルが入るのを防ぐため）。
   `npm run dev` が `AGENTS.md` を書き換えることがあります。その変更はコミットに入れないでください
5. プルリクエストを作る。本文に次を書く
   - `Closes #<Issue の番号>`
   - 何をどう直したか（2〜3 行）
   - 直す前と直した後の画面キャプチャ（画面に関わるとき）
   - 確かめに使ったマニフェストの URL と開き方
   - 迷ったところ、決めたことと理由

## してはいけないこと

- main への直接の push、プルリクエストの取り込み（マージ）。本番にそのまま出ます
- Vercel・Cloudflare などの管理画面の操作
- `.env` や鍵のファイルをコミットする

## 困ったとき

Issue にコメントしてください。「迷ったら手を止めて聞く」で失敗になることはありません。
