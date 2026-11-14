import { type Board, applyMove, gapId, isSolved, neighbors } from "./puzzle";

/** Pace of one solve slide, in milliseconds. */
export const SOLVE_MOVE_MS = 150;

/**
 * Human-style solver: solve the top row, then the left column, shrinking the
 * puzzle by one row and one column each time, until a 2×2 corner is left.
 *
 * Within that structure, each step places one tile (or the last two tiles of
 * a row or column together, the classic tricky case) with a small
 * breadth-first search over the positions of just those tiles and the gap.
 * Every other unlocked tile is treated as interchangeable, so the search
 * stays tiny while never getting stuck the way hand-coded tile shuffles can.
 *
 * Returns the moves (see `puzzle.ts`) that take `board` to the solved board.
 */
export function solve(board: Board, n: number): number[] {
  if (!isSolvable(board, n)) throw new Error("Board is not solvable");
  const b = board.slice();
  const locked = new Uint8Array(n * n);
  const moves: number[] = [];

  const place = (targets: number[]) => {
    for (const m of searchPlacement(b, n, locked, targets)) {
      applyMove(b, n, m);
      moves.push(m);
    }
    for (const t of targets) locked[t] = 1;
  };

  for (let k = 0; k < n - 2; k++) {
    // Row k, left to right; the last two cells go in together.
    for (let c = k; c < n - 2; c++) place([k * n + c]);
    place([k * n + n - 2, k * n + n - 1]);
    // Column k, top to bottom; the last two cells go in together.
    for (let r = k + 1; r < n - 2; r++) place([r * n + k]);
    place([(n - 2) * n + k, (n - 1) * n + k]);
  }
  // Final 2×2 corner: three tiles placed means the gap is in place too.
  place([(n - 2) * n + n - 2, (n - 2) * n + n - 1, (n - 1) * n + n - 2]);

  if (!isSolved(b)) throw new Error("Solver finished without solving the board");
  return moves;
}

/**
 * Shortest sequence of moves, using only unlocked cells, that brings each
 * tile `t` in `targets` to cell `t`. Tracks only those tiles plus the gap.
 */
function searchPlacement(
  board: Board,
  n: number,
  locked: Uint8Array,
  targets: number[],
): number[] {
  const freeCells: number[] = [];
  const localOf = new Int32Array(n * n).fill(-1);
  for (let cell = 0; cell < n * n; cell++) {
    if (!locked[cell]) {
      localOf[cell] = freeCells.length;
      freeCells.push(cell);
    }
  }
  const F = freeCells.length;
  const adjacency = freeCells.map((cell) =>
    neighbors(n, cell)
      .map((c) => localOf[c])
      .filter((l) => l >= 0),
  );

  // State = positions (local indices) of each target tile, then the gap,
  // packed as digits in base F.
  const k = targets.length;
  const digits = k + 1;
  const goal = targets.map((t) => localOf[t]);
  const start: number[] = targets.map((t) => localOf[board.indexOf(t)]);
  start.push(localOf[board.indexOf(gapId(n))]);
  if (start.some((p) => p < 0) || goal.some((p) => p < 0)) {
    throw new Error("Solver tried to place a tile through locked cells");
  }

  const encode = (pos: number[]) => pos.reduce((acc, p) => acc * F + p, 0);
  const decode = (state: number, out: number[]) => {
    for (let i = digits - 1; i >= 0; i--) {
      out[i] = state % F;
      state = Math.floor(state / F);
    }
  };
  const isGoal = (pos: number[]) => goal.every((g, i) => pos[i] === g);

  if (isGoal(start)) return [];

  const total = F ** digits;
  const parent = new Int32Array(total).fill(-1);
  const queue = new Int32Array(total);
  const startState = encode(start);
  parent[startState] = startState;
  queue[0] = startState;
  let head = 0;
  let tail = 1;
  const pos = new Array<number>(digits);

  while (head < tail) {
    const state = queue[head++];
    decode(state, pos);
    const gap = pos[k];
    for (const next of adjacency[gap]) {
      // The tile at `next` (tracked or not) slides into the gap.
      const moved = pos.indexOf(next);
      pos[k] = next;
      if (moved >= 0 && moved < k) pos[moved] = gap;
      const nextState = encode(pos);
      if (parent[nextState] < 0) {
        parent[nextState] = state;
        if (isGoal(pos)) return reconstruct(parent, nextState, startState, F, freeCells);
        queue[tail++] = nextState;
      }
      // Undo for the next neighbor.
      if (moved >= 0 && moved < k) pos[moved] = next;
      pos[k] = gap;
    }
  }
  throw new Error("Solver could not place tiles: " + targets.join(", "));
}

function reconstruct(
  parent: Int32Array,
  end: number,
  start: number,
  F: number,
  freeCells: number[],
): number[] {
  const moves: number[] = [];
  for (let s = end; s !== start; s = parent[s]) {
    // The gap is the last digit; its position after a move is the cell the
    // moved tile came from, which is exactly the move.
    moves.push(freeCells[s % F]);
  }
  return moves.reverse();
}

/** Standard parity test for an n×n sliding puzzle with the gap anywhere. */
export function isSolvable(board: Board, n: number): boolean {
  const gap = gapId(n);
  const tiles = board.filter((t) => t !== gap);
  let inversions = 0;
  for (let i = 0; i < tiles.length; i++) {
    for (let j = i + 1; j < tiles.length; j++) {
      if (tiles[i] > tiles[j]) inversions++;
    }
  }
  if (n % 2 === 1) return inversions % 2 === 0;
  const gapRowFromBottom = n - Math.floor(board.indexOf(gap) / n);
  return (inversions + gapRowFromBottom) % 2 === 1;
}
