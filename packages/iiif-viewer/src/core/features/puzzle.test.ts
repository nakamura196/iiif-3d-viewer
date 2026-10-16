import { describe, expect, it } from 'vitest';
import { isPuzzleSolved, puzzlePlacedCount, shufflePuzzle, puzzleSolvedBoard, swapPuzzlePieces } from './puzzle';

describe('puzzle board', () => {
  it('starts solved', () => {
    expect(puzzleSolvedBoard(3)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(isPuzzleSolved(puzzleSolvedBoard(4))).toBe(true);
  });

  it('shuffles into an unsolved permutation of every piece', () => {
    for (let k = 0; k < 50; k++) {
      const b = shufflePuzzle(3);
      expect(isPuzzleSolved(b)).toBe(false);
      expect([...b].sort((x, y) => x - y)).toEqual(puzzleSolvedBoard(3));
    }
  });

  it('reshuffles when the random order comes out solved', () => {
    // 最初の 1 周は j = i（何も動かない）→ 完成のままなので、もう 1 周混ぜる
    let calls = 0;
    const random = () => (calls++ < 3 ? 0.999 : 0);
    expect(isPuzzleSolved(shufflePuzzle(2, random))).toBe(false);
  });

  it('swaps two cells without touching the input', () => {
    const b = [1, 0, 2, 3];
    const next = swapPuzzlePieces(b, 0, 1);
    expect(next).toEqual([0, 1, 2, 3]);
    expect(b).toEqual([1, 0, 2, 3]);
    expect(isPuzzleSolved(next)).toBe(true);
  });

  it('counts pieces in place', () => {
    expect(puzzlePlacedCount([0, 2, 1, 3])).toBe(2);
  });
});
