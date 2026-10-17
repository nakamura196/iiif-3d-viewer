// パズルの盤面。order[i] は「i 番目のマスに置いてあるピースの番号」。ピース k の正しい位置はマス k。
// 画面の部品から切り離し、混ぜ方と完成の判定だけをここに置く（テストできるように）。

export type PuzzleBoard = number[];

export const puzzleSolvedBoard = (n: number): PuzzleBoard => Array.from({ length: n * n }, (_, i) => i);

export const isPuzzleSolved = (b: PuzzleBoard) => b.every((p, i) => p === i);

/** Fisher–Yates で混ぜる。最初から完成している並びは返さない（ピースが 2 つ以上のとき）。 */
export const shufflePuzzle = (n: number, random: () => number = Math.random): PuzzleBoard => {
  const b = puzzleSolvedBoard(n);
  if (b.length < 2) return b;
  do {
    for (let i = b.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [b[i], b[j]] = [b[j], b[i]];
    }
  } while (isPuzzleSolved(b));
  return b;
};

/** マス a と b のピースを入れ替えた盤面。 */
export const swapPuzzlePieces = (b: PuzzleBoard, a: number, c: number): PuzzleBoard => {
  const next = b.slice();
  [next[a], next[c]] = [next[c], next[a]];
  return next;
};

/** 正しい位置にあるピースの数。 */
export const puzzlePlacedCount = (b: PuzzleBoard) => b.reduce((s, p, i) => s + (p === i ? 1 : 0), 0);
