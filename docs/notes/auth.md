# IIIF 認証 (Authorization Flow API 2.0)

## 2026-10-14 画像の認証に対応した

何を作ったか。

- `core/features/auth.ts`: manifest の `body.service[ImageService3].service[AuthProbeService2]`（body 直下も可）と、
  info.json の `service` から Probe service を読む。Probe の応答（AuthProbeResult2）とトークンの postMessage
  （AuthAccessToken2 / AuthAccessTokenError2、messageId の照合つき）も読む。`ImageLayer.auth` に入る。
- `react/auth/authStore.ts`: 仕様の "Workflow from the Client Perspective" をそのまま実装した進行役。
  Probe URL ごとに 1 つ持ち、同じ Probe の画像で共有する。トークンはメモリだけ（localStorage に入れない）。
- `react/auth/AuthPrompt.tsx`: 画像の上に重ねる案内（heading / note / confirmLabel、拒否の理由と「もう一度」、ログアウト）。
- `react/displays/ImageTiles.tsx`: ログイン後に info.json を取り直し、タイル・ベース画像の URL に `_auth=<回数>` を付けて取り直す。
- `scripts/auth-mock-server.mjs`（`npm run auth-mock`）と `e2e/auth.spec.ts`: ローカルのモックと通しの E2E。

access service を試す順番は external → kiosk → active。
仕様は順番を client に任せている。external は窓が要らず、kiosk は確認なしで窓が開くだけなので、
利用者に操作を求める active を最後にした（`ACCESS_ORDER`）。

判断した点。

- 画像の取得（`<img>`）は Cookie が付くので、タイルは今までどおり。info.json の `fetch` は、Probe を持つ service
  だけ `credentials: 'include'`（CORS `*` の他のサーバを壊さないため）。
- 未ログインで返る劣化画像はブラウザに残りうる。ログイン後の取り直しは URL を変えて確実に再取得する
  （モックは劣化画像を `max-age=3600` で返し、E2E でそれでも色付きに替わることを確かめた）。
- 劣化画像が返る間は、案内の下でそのまま描く。案内は画像を塞がない。

公開のデモサーバ https://iiif-auth2-server.herokuapp.com は消えていた（Heroku の "No such app"、2026-10-13 確認）。
そのためローカルにモックを書いた。

## 限界・未確認

- 実際のサーバでは試していない（モックだけ）。
- 画像サーバが別サイトのとき、ブラウザの第三者 Cookie 制限で `<img>` に Cookie が付かない。
  モックは localhost のポート違い（same-site）なので、この問題は出ない。
- 音声・動画・3D は未対応（画像だけ）。
- info.json が Cookie なしで 401 を返すサーバでは、manifest に Probe が無いと検出できない。
- substitute（401 で別リソースを返す段階的アクセス）と、substitute 側の Probe は扱っていない。
  `location`（30x）の代替画像だけ置き換える。
- トークンの有効期限は expiresIn（無ければ 300 秒）で捨てるだけで、期限切れでの自動再取得はしない。

## 2026-10-14（続き）Wellcome Collection の実物で試した

- 実在する Auth 2.0 のマニフェストとして Wellcome Collection を見つけた（内容の注意書きに同意すると見られる資料。目録 API で access status = open-with-advisory が 53,304 件）。例: https://iiif.wellcomecollection.org/presentation/v3/b18659135
- 画像の probe の中の access service は `{id, type}` だけで、中身はマニフェスト末尾の `services` にある。読み込み直後に参照を中身へ置き換える処理を足した（core/services/sharedServices.ts）。
- note に HTML が入っている（`<p>` `<ul>` `<a>`）。資料情報と同じ消毒をかけて HTML として出すようにした。
- probe と info.json は CORS `*` で返る。Cookie 付き（credentials: include）で取ると、ブラウザが応答を捨てる。どちらも Cookie なしで取るように直した。probe はトークン（Bearer）で足りる。
- info.json は未認証だと 401 だが、本文は完全な info.json。認証付きの service に限り、401 の本文も読む。
- 結果（Playwright のヘッドレス Chromium）: 注意書き → 同意窓の Submit → 窓が閉じる → トークン取得 → probe 200 → ログアウトのリンク表示、まで通った。
- ただし画像そのものは出なかった。Wellcome は、ブラウザの User-Agent で Cookie なしに来た画像要求を 403 にする（curl で UA を変えて確認。UA なしは 200）。自動試験のブラウザが門前払いされているのか、Kasane 側の問題なのかは、まだ切り分けられていない。普段使いの Chrome で確かめる必要がある。

## 2026-10-14（続き 2）普段の Chrome では画像が出た

- 普段使いの Chrome で同じマニフェストを開き、「Accept Terms and Open」→ 同意窓の Submit のあと、画像が表示された（中村が目視で確認）。
- したがって、ヘッドレスで画像が出なかったのは、自動試験のブラウザが Wellcome に門前払いされていたためで、Kasane 側の問題ではない、と判断する。
- 主張の候補: 実在する Auth 2.0 の公開例（Wellcome）は access service を末尾の `services` に置く書き方で、これを読まないビューアは注意書きを出せない（根拠: 2026-10-14（続き）の節）。
