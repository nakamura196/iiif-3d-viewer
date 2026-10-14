// 機能ごとの読み取り。1 機能 1 ファイル（<機能>.ts）か 1 機能 1 フォルダ（<機能>/index.ts）。
// 一覧は scripts/gen-registries.mjs が作るので、新しい機能はファイルを足すだけでよい。ここは書き換えない。
// 機能の中だけで使う補助は、名前を _ で始める（一覧に入らない）。
export * from './index.generated';
