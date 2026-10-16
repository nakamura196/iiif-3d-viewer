import { describe, expect, it } from 'vitest';
import { rowAt, rowOffsets, scrollToShow, visibleRange } from './virtualList';

const keys = ['a', 'b', 'c', 'd', 'e'];
// a: 10 (measured), others: 20 (estimate)
const offsets = rowOffsets(keys, new Map([['a', 10]]), 20);

describe('rowOffsets', () => {
  it('adds measured heights and the estimate', () => {
    expect([...offsets]).toEqual([0, 10, 30, 50, 70, 90]);
  });
});

describe('rowAt', () => {
  it('finds the row under a height', () => {
    expect(rowAt(offsets, 0)).toBe(0);
    expect(rowAt(offsets, 9)).toBe(0);
    expect(rowAt(offsets, 10)).toBe(1);
    expect(rowAt(offsets, 1000)).toBe(4);
    expect(rowAt(rowOffsets([], new Map(), 20), 5)).toBe(0);
  });
});

describe('visibleRange', () => {
  it('takes the rows in view and the overscan', () => {
    expect(visibleRange(offsets, 15, 20, 0)).toEqual({ start: 1, end: 3 });
    expect(visibleRange(offsets, 15, 20, 1)).toEqual({ start: 0, end: 4 });
    expect(visibleRange(offsets, 80, 100, 3)).toEqual({ start: 1, end: 5 });
  });
});

describe('scrollToShow', () => {
  it('does not move when the row is in view', () => {
    expect(scrollToShow(offsets, 1, 0, 50)).toBeNull();
  });
  it('moves up or down by the least', () => {
    expect(scrollToShow(offsets, 0, 20, 30)).toBe(0); // above: its top to the top
    expect(scrollToShow(offsets, 4, 0, 30)).toBe(60); // below: its bottom to the bottom
  });
});
