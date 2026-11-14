import { type Board, gapCell, isSolved, neighbors } from "./puzzle";

/** Pace of one scramble slide, in milliseconds. Same on every grid. */
export const SCRAMBLE_MOVE_MS = 150;
/** Durations offered in the scramble picker, in seconds. */
export const SCRAMBLE_DURATIONS = [10, 20, 30, 40, 50, 60] as const;
export const DEFAULT_SCRAMBLE_SECONDS = 30;
/** How often the gap steps toward its current target instead of anywhere. */
const DRIFT = 0.9;

/** Number of moves that fit in `seconds` at the fixed pace (60 s → 400). */
export function scrambleMovesFor(seconds: number): number {
  return Math.floor((seconds * 1000) / SCRAMBLE_MOVE_MS);
}

/**
 * "Spread-out" random walk of legal moves starting from `board`.
 *
 * Each move is a random legal slide that never undoes the previous one. To
 * mix big boards well within a limited number of moves, the gap drifts
 * toward a target: a random cell among those it has visited least recently.
 * Most moves step closer to that target (picked at random among the moves
 * that do); the rest are any legal move. On arrival a new target is chosen.
 *
 * If the walk happens to land on the solved board, it keeps going.
 */
export function generateScramble(
  board: Board,
  n: number,
  count: number,
  random: () => number = Math.random,
): number[] {
  const b = board.slice();
  const moves: number[] = [];
  const lastVisit = new Array<number>(n * n).fill(-1);
  const distance = (a: number, c: number) =>
    Math.abs((a % n) - (c % n)) + Math.abs(Math.floor(a / n) - Math.floor(c / n));
  const pick = <T>(items: T[]) => items[Math.floor(random() * items.length)];

  let previousGap = -1;
  let target = -1;
  while (moves.length < count || isSolved(b)) {
    const gap = gapCell(b);
    lastVisit[gap] = moves.length;
    if (target < 0 || gap === target) {
      let oldest = Infinity;
      for (let c = 0; c < n * n; c++) if (c !== gap) oldest = Math.min(oldest, lastVisit[c]);
      target = pick([...lastVisit.keys()].filter((c) => c !== gap && lastVisit[c] === oldest));
    }
    const options = neighbors(n, gap).filter((c) => c !== previousGap);
    const closer = options.filter((c) => distance(c, target) < distance(gap, target));
    const cell = pick(closer.length > 0 && random() < DRIFT ? closer : options);
    b[gap] = b[cell];
    b[cell] = n * n - 1;
    moves.push(cell);
    previousGap = gap;
  }
  return moves;
}
