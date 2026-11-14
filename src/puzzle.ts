/**
 * Board model.
 *
 * A board of size n is an array of n*n tile ids indexed by cell
 * (cell = row * n + col). Tile id `t` belongs at cell `t`, so the solved
 * board is [0, 1, 2, ...]. The highest id (n*n - 1) is the gap.
 *
 * A move is the cell of the tile that slides into the gap. After the move
 * the gap sits at that cell.
 */
export type Board = number[];

export const MIN_SIZE = 3;
export const MAX_SIZE = 8;

export function solvedBoard(n: number): Board {
  return Array.from({ length: n * n }, (_, i) => i);
}

export function gapId(n: number): number {
  return n * n - 1;
}

export function gapCell(board: Board): number {
  return board.indexOf(board.length - 1);
}

export function isSolved(board: Board): boolean {
  return board.every((tile, cell) => tile === cell);
}

/** Cells orthogonally adjacent to `cell`. */
export function neighbors(n: number, cell: number): number[] {
  const row = Math.floor(cell / n);
  const col = cell % n;
  const out: number[] = [];
  if (row > 0) out.push(cell - n);
  if (row < n - 1) out.push(cell + n);
  if (col > 0) out.push(cell - 1);
  if (col < n - 1) out.push(cell + 1);
  return out;
}

/** True when the tile at `cell` is next to the gap and may slide. */
export function canMove(board: Board, n: number, cell: number): boolean {
  return neighbors(n, gapCell(board)).includes(cell);
}

/** Slide the tile at `cell` into the gap, mutating `board`. */
export function applyMove(board: Board, n: number, cell: number): void {
  const gap = gapCell(board);
  if (!neighbors(n, gap).includes(cell)) {
    throw new Error(`Illegal move: cell ${cell} is not next to the gap at ${gap}`);
  }
  board[gap] = board[cell];
  board[cell] = gapId(n);
}

/** Apply a list of moves to a copy of `board` and return the result. */
export function applyMoves(board: Board, n: number, moves: readonly number[]): Board {
  const b = board.slice();
  for (const m of moves) applyMove(b, n, m);
  return b;
}
