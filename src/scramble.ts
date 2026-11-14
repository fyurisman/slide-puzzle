import { type Board, gapCell, isSolved, neighbors } from "./puzzle";

/** Base pace of one scramble slide, in milliseconds. */
export const SCRAMBLE_BASE_MS = 150;
/** A scramble never takes longer than this in total. */
export const SCRAMBLE_MAX_TOTAL_MS = 60_000;

/** Number of random moves for a proper scramble: 20 × N². */
export function scrambleLength(n: number): number {
  return 20 * n * n;
}

/** Per-slide duration so the whole scramble fits within the cap. */
export function scrambleMoveDuration(moveCount: number): number {
  if (moveCount <= 0) return SCRAMBLE_BASE_MS;
  return Math.min(SCRAMBLE_BASE_MS, SCRAMBLE_MAX_TOTAL_MS / moveCount);
}

/**
 * Random walk of legal moves starting from `board`. No move immediately
 * undoes the previous one. If the walk happens to land on the solved
 * board, it keeps going until it doesn't.
 */
export function generateScramble(
  board: Board,
  n: number,
  count: number = scrambleLength(n),
  random: () => number = Math.random,
): number[] {
  const b = board.slice();
  const moves: number[] = [];
  let previousGap = -1;
  while (moves.length < count || isSolved(b)) {
    const gap = gapCell(b);
    const options = neighbors(n, gap).filter((c) => c !== previousGap);
    const cell = options[Math.floor(random() * options.length)];
    b[gap] = b[cell];
    b[cell] = n * n - 1;
    moves.push(cell);
    previousGap = gap;
  }
  return moves;
}
