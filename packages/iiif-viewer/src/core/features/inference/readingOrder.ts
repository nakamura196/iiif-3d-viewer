// 行の読む順。@nakamura196/ndl-koten-ocr-web（MIT）の src/reading-order.ts から、docviz を経て写した。
// 変えたのは型だけ（行の型を外から受け取る形にした）。
// Reading order — recursive block XY-cut, ported 1:1 from
// src/reading_order/xy_cut/block_xy_cut.py (ndl-lab/ndlocr-lite, CC BY 4.0).
//
// `solve()` works purely on bounding boxes and returns a rank per box; the XML
// glue in eval.py just writes those ranks back. We reproduce solve() exactly
// (eval_xml is called with the default line_width_scale=1.0, so the optional
// box-dilation path in normalize_bboxes is inactive and omitted) and order the
// detections by rank.
//
// NOT ported: the order/*.py refinement that eval_xml applies AFTER solve()
// (sort_lines → warichu 割注 grouping, duplicate removal, local smoothing). Those
// are a separate layer from the XY-cut itself.

/** 行の枠（[x, y, 幅, 高さ]、画像の画素）。ほかの項目はそのまま持ち回る */
interface LineDetection {
  box: [number, number, number, number]
}

type Box = [number, number, number, number] // x0, y0, x1, y1

class BlockNode {
  children: BlockNode[] = []
  lineIdx: number[] = []
  numLines = 0
  numVerticalLines = 0
  constructor(
    public x0: number,
    public y0: number,
    public x1: number,
    public y1: number,
  ) {}

  /** All children span this node's full y-range ⇒ it was cut along x. */
  isXSplit(): boolean {
    return this.children.every((c) => c.y0 === this.y0 && c.y1 === this.y1)
  }

  isVertical(): boolean {
    return this.numLines < this.numVerticalLines * 2
  }
}

interface Span {
  beg: number
  end: number
  val: number
}

/** Longest run of the minimum value; val = -min/max (deeper/cleaner gap ⇒ larger
 *  val, since min=0 ⇒ 0 and a uniform band ⇒ ~-1). Mirrors calc_min_span. */
function calcMinSpan(hist: number[]): Span {
  if (hist.length === 1) return { beg: 0, end: 1, val: hist[0] }
  let minVal = Infinity
  let maxVal = -Infinity
  for (const v of hist) {
    if (v < minVal) minVal = v
    if (v > maxVal) maxVal = v
  }
  // Runs where hist === minVal, via the diff-of-mask trick from numpy.
  let bestBeg = 0
  let bestEnd = 1
  let bestLen = -1
  let runStart = -1
  for (let i = 0; i <= hist.length; i++) {
    const isMin = i < hist.length && hist[i] === minVal
    if (isMin && runStart < 0) runStart = i
    else if (!isMin && runStart >= 0) {
      const len = i - runStart
      if (len > bestLen) {
        bestLen = len
        bestBeg = runStart
        bestEnd = i
      }
      runStart = -1
    }
  }
  const val = maxVal > 0 ? -minVal / maxVal : 0
  return { beg: bestBeg, end: bestEnd, val }
}

/** Column / row sums of the occupancy table over a sub-region. */
function calcHist(
  table: Uint8Array,
  W: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): { xHist: number[]; yHist: number[] } {
  const xHist = new Array<number>(x1 - x0).fill(0)
  const yHist = new Array<number>(y1 - y0).fill(0)
  for (let y = y0; y < y1; y++) {
    const row = y * W
    for (let x = x0; x < x1; x++) {
      if (table[row + x]) {
        xHist[x - x0]++
        yHist[y - y0]++
      }
    }
  }
  return { xHist, yHist }
}

function blockXYCut(table: Uint8Array, W: number, node: BlockNode, depth = 0): void {
  if (depth > 4096) return // safety guard against pathological recursion
  const { x0, y0, x1, y1 } = node
  const { xHist, yHist } = calcHist(table, W, x0, y0, x1, y1)
  const xs = calcMinSpan(xHist)
  const ys = calcMinSpan(yHist)
  const xBeg = xs.beg + x0
  const xEnd = xs.end + x0
  const yBeg = ys.beg + y0
  const yEnd = ys.end + y0
  if (x0 === xBeg && x1 === xEnd && y0 === yBeg && y1 === yEnd) return

  const splitChild = (cx0: number, cy0: number, cx1: number, cy1: number) => {
    if (!(cx0 < cx1 && cy0 < cy1)) return
    if (cx0 === x0 && cy0 === y0 && cx1 === x1 && cy1 === y1) return
    const child = new BlockNode(cx0, cy0, cx1, cy1)
    node.children.push(child)
    blockXYCut(table, W, child, depth + 1)
  }
  const splitX = () => {
    splitChild(x0, y0, xBeg, y1)
    splitChild(xBeg, y0, xEnd, y1)
    splitChild(xEnd, y0, x1, y1)
  }
  const splitY = () => {
    splitChild(x0, y0, x1, yBeg)
    splitChild(x0, yBeg, x1, yEnd)
    splitChild(x0, yEnd, x1, y1)
  }

  if (ys.val < xs.val) splitX()
  else if (xs.val < ys.val) splitY()
  else if (xEnd - xBeg < yEnd - yBeg) splitY()
  else splitX()
}

/** Unusual IoU formula from block_xy_cut.py (kept verbatim for parity). */
function calcIou(box: Box, b: Box): number {
  const x0 = Math.max(box[0], b[0])
  const y0 = Math.max(box[1], b[1])
  const x1 = Math.min(box[2], b[2])
  const y1 = Math.min(box[3], b[3])
  const inter = Math.max(0, x1 - x0 + 1) * Math.max(0, y1 - y0 + 1)
  const boxArea = (box[2] - b[0] + 1) * (box[3] - b[1] + 1)
  const boxesArea = (b[2] - box[0] + 1) * (b[3] - box[1] + 1)
  const denom = boxArea + boxesArea - inter
  return denom === 0 ? NaN : inter / denom
}

function collectLeaves(node: BlockNode, leaves: BlockNode[]): void {
  if (node.children.length === 0) leaves.push(node)
  for (const c of node.children) collectLeaves(c, leaves)
}

/** Assign each box to the leaf node with the largest IoU. */
function assignBoxes(root: BlockNode, boxes: Box[]): void {
  const leaves: BlockNode[] = []
  collectLeaves(root, leaves)
  if (leaves.length === 0) return
  for (let i = 0; i < boxes.length; i++) {
    let best = -1
    let bestIou = -Infinity
    for (let j = 0; j < leaves.length; j++) {
      const l = leaves[j]
      const iou = calcIou(boxes[i], [l.x0, l.y0, l.x1, l.y1])
      if (!Number.isNaN(iou) && iou > bestIou) {
        bestIou = iou
        best = j
      }
    }
    if (best < 0) best = 0 // all-NaN: fall back to first leaf (nanargmax parity)
    leaves[best].lineIdx.push(i)
  }
}

/** Depth-first ordering of nodes; sorts lines inside a leaf and flips x-split
 *  children right→left for vertical text (mirrors sort_nodes). */
function sortNodes(node: BlockNode, boxes: Box[]): [number, number] {
  if (node.lineIdx.length > 0) {
    let vCount = 0
    for (const i of node.lineIdx) {
      const w = boxes[i][2] - boxes[i][0]
      const h = boxes[i][3] - boxes[i][1]
      if (w < h) vCount++
    }
    node.numLines = node.lineIdx.length
    node.numVerticalLines = vCount
    if (node.numLines > 1) {
      const vertical = node.isVertical()
      // vertical: primary -x0 (right first), secondary y0.
      // horizontal: primary y0, secondary x0.
      node.lineIdx.sort((a, b) => {
        if (vertical) {
          if (boxes[a][0] !== boxes[b][0]) return boxes[b][0] - boxes[a][0]
          return boxes[a][1] - boxes[b][1]
        }
        if (boxes[a][1] !== boxes[b][1]) return boxes[a][1] - boxes[b][1]
        return boxes[a][0] - boxes[b][0]
      })
    }
  } else {
    for (const child of node.children) {
      const [n, v] = sortNodes(child, boxes)
      node.numLines += n
      node.numVerticalLines += v
    }
    if (node.isXSplit() && node.isVertical()) node.children.reverse()
  }
  return [node.numLines, node.numVerticalLines]
}

function getRanking(node: BlockNode, ranks: number[], rank: number): number {
  for (const i of node.lineIdx) ranks[i] = rank++
  for (const child of node.children) rank = getRanking(child, ranks, rank)
  return rank
}

/** Coarse-grain boxes onto an integer grid (normalize_bboxes, scale=1.0). */
function normalizeBoxes(src: Box[], grid: number): Box[] {
  const boxes = src.map((b) => [b[0], b[1], Math.max(b[0], b[2]), Math.max(b[1], b[3])] as Box)
  let xMin = Infinity
  let yMin = Infinity
  let xMax = -Infinity
  let yMax = -Infinity
  for (const b of boxes) {
    if (b[0] < xMin) xMin = b[0]
    if (b[1] < yMin) yMin = b[1]
    if (b[2] > xMax) xMax = b[2]
    if (b[3] > yMax) yMax = b[3]
  }
  const wPage = Math.max(1, xMax - xMin)
  const hPage = Math.max(1, yMax - yMin)
  const xGrid = wPage < hPage ? grid : grid * (wPage / hPage)
  const yGrid = hPage < wPage ? grid : grid * (hPage / wPage)
  return boxes.map(
    (b) =>
      [
        Math.max(0, Math.floor(((b[0] - xMin) * xGrid) / wPage)),
        Math.max(0, Math.floor(((b[1] - yMin) * yGrid) / hPage)),
        Math.max(0, Math.floor(((b[2] - xMin) * xGrid) / wPage)),
        Math.max(0, Math.floor(((b[3] - yMin) * yGrid) / hPage)),
      ] as Box,
  )
}

/**
 * Return a rank (reading position) for each input box ([x0, y0, x1, y1]). Port of solve(). Also used on its own by
 * NDLOCR-Lite (ndlOcr.ts), which, like the original eval_xml, sorts the lines further after it.
 */
export function xyCutRanks(rawBoxes: Box[]): number[] {
  return solve(rawBoxes)
}

function solve(rawBoxes: Box[]): number[] {
  const n = rawBoxes.length
  if (n === 0) return []
  const grid = 100 * Math.sqrt(n)
  const boxes = normalizeBoxes(rawBoxes, grid)

  let W = 0
  let H = 0
  for (const b of boxes) {
    if (b[2] + 1 > W) W = b[2] + 1
    if (b[3] + 1 > H) H = b[3] + 1
  }
  const table = new Uint8Array(W * H)
  for (const [x0, y0, x1, y1] of boxes) {
    for (let y = y0; y < y1; y++) {
      const row = y * W
      for (let x = x0; x < x1; x++) table[row + x] = 1
    }
  }

  const root = new BlockNode(0, 0, W, H)
  blockXYCut(table, W, root)
  assignBoxes(root, boxes)
  sortNodes(root, boxes)

  const ranks = new Array<number>(n).fill(-1)
  getRanking(root, ranks, 0)
  return ranks
}

export interface ReadingOrderResult<T extends LineDetection = LineDetection> {
  ordered: T[]
  vertical: boolean
}

/** Order line detections by the block XY-cut reading sequence. */
export function readingOrder<T extends LineDetection>(lines: T[]): ReadingOrderResult<T> {
  if (lines.length <= 1) return { ordered: [...lines], vertical: true }

  const tall = lines.filter((d) => d.box[3] > d.box[2]).length
  const vertical = tall / lines.length > 0.5

  const boxes: Box[] = lines.map((d) => {
    const [x, y, w, h] = d.box
    return [x, y, x + w, y + h]
  })
  const ranks = solve(boxes)

  // Order by rank; unassigned (-1) go last, ties keep input order.
  const order = lines.map((_, i) => i)
  order.sort((a, b) => {
    const ra = ranks[a] < 0 ? Number.POSITIVE_INFINITY : ranks[a]
    const rb = ranks[b] < 0 ? Number.POSITIVE_INFINITY : ranks[b]
    if (ra !== rb) return ra - rb
    return a - b
  })
  return { ordered: order.map((i) => lines[i]), vertical }
}
