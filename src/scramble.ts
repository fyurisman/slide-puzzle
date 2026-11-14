import { type Board, gapCell, isSolved, neighbors } from "./puzzle";

/** Pace of one scramble slide, in milliseconds. Same on every grid. */
export const SCRAMBLE_MOVE_MS = 150;
/** A scramble never takes longer than this in total. */
export const SCRAMBLE_MAX_TOTAL_MS = 60_000;
/** Most moves that fit in the cap at the fixed pace (400). */
export const SCRAMBLE_MAX_MOVES = Math.floor(SCRAMBLE_MAX_TOTAL_MS / SCRAMBLE_MOVE_MS);
/** How often the gap steps toward its current target instead of anywhere. */
const DRIFT = 0.9;

/** Number of moves: 20 × N², limited to what fits in 60 s at 150 ms. */
export function scrambleLength(n: number): number {
  return Math.min(20 * n * n, SCRAMBLE_MAX_MOVES);
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
  count: number = scrambleLength(n),
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
