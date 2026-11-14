import { describe, expect, it } from "vitest";
import {
  MAX_SIZE,
  MIN_SIZE,
  applyMove,
  applyMoves,
  canMove,
  gapCell,
  isSolved,
  neighbors,
  solvedBoard,
} from "./puzzle";
import {
  SCRAMBLE_BASE_MS,
  SCRAMBLE_MAX_TOTAL_MS,
  generateScramble,
  scrambleLength,
  scrambleMoveDuration,
} from "./scramble";
import { isSolvable, solve } from "./solver";

/** Small deterministic PRNG so failures are reproducible. */
function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Uniformly random solvable board (shuffle, then fix parity). */
function randomSolvableBoard(n: number, random: () => number) {
  const b = solvedBoard(n);
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  if (!isSolvable(b, n)) {
    // Swapping two non-gap tiles flips parity.
    const gap = n * n - 1;
    const [x, y] = b.map((t, i) => (t === gap ? -1 : i)).filter((i) => i >= 0);
    [b[x], b[y]] = [b[y], b[x]];
  }
  return b;
}

/** Applies moves one by one, failing on the first illegal one. */
function playLegally(board: number[], n: number, moves: number[]) {
  const b = board.slice();
  moves.forEach((m, i) => {
    if (!canMove(b, n, m)) throw new Error(`move #${i} (cell ${m}) is illegal`);
    applyMove(b, n, m);
  });
  return b;
}

const sizes = Array.from({ length: MAX_SIZE - MIN_SIZE + 1 }, (_, i) => MIN_SIZE + i);

describe("puzzle model", () => {
  it("starts solved with the gap bottom-right", () => {
    for (const n of sizes) {
      const b = solvedBoard(n);
      expect(isSolved(b)).toBe(true);
      expect(gapCell(b)).toBe(n * n - 1);
    }
  });

  it("knows each cell's neighbors", () => {
    expect(neighbors(3, 0).sort()).toEqual([1, 3]);
    expect(neighbors(3, 4).sort()).toEqual([1, 3, 5, 7]);
    expect(neighbors(3, 8).sort()).toEqual([5, 7]);
  });

  it("rejects moves of tiles not next to the gap", () => {
    const b = solvedBoard(3);
    expect(canMove(b, 3, 7)).toBe(true);
    expect(canMove(b, 3, 0)).toBe(false);
    expect(() => applyMove(b, 3, 0)).toThrow();
  });
});

describe("scramble", () => {
  it("uses 20 × N² moves", () => {
    expect(scrambleLength(3)).toBe(180);
    expect(scrambleLength(8)).toBe(1280);
  });

  it("paces slides at 150 ms but never exceeds 60 s in total", () => {
    for (const n of sizes) {
      const count = scrambleLength(n);
      const ms = scrambleMoveDuration(count);
      expect(ms).toBeLessThanOrEqual(SCRAMBLE_BASE_MS);
      expect(ms * count).toBeLessThanOrEqual(SCRAMBLE_MAX_TOTAL_MS + 1e-6);
    }
    expect(scrambleMoveDuration(180)).toBe(150);
    expect(scrambleMoveDuration(1280)).toBeCloseTo(46.875);
  });

  it("produces legal moves that never undo the previous one", () => {
    const random = mulberry32(1);
    for (const n of sizes) {
      for (let trial = 0; trial < 20; trial++) {
        const start = trial === 0 ? solvedBoard(n) : randomSolvableBoard(n, random);
        const moves = generateScramble(start, n, scrambleLength(n), random);
        expect(moves.length).toBeGreaterThanOrEqual(scrambleLength(n));
        const b = start.slice();
        let previousGap = -1;
        for (const m of moves) {
          expect(canMove(b, n, m)).toBe(true);
          expect(m).not.toBe(previousGap);
          previousGap = gapCell(b);
          applyMove(b, n, m);
        }
        expect(isSolved(b)).toBe(false);
      }
    }
  });
});

describe("solver", () => {
  it("returns no moves for a solved board", () => {
    for (const n of sizes) expect(solve(solvedBoard(n), n)).toEqual([]);
  });

  it("rejects unsolvable boards", () => {
    const b = solvedBoard(3);
    [b[0], b[1]] = [b[1], b[0]];
    expect(isSolvable(b, 3)).toBe(false);
    expect(() => solve(b, 3)).toThrow();
  });

  // Thousands of boards in total, weighted towards the cheaper small sizes.
  const trials: Record<number, number> = { 3: 1500, 4: 800, 5: 300, 6: 150, 7: 80, 8: 50 };

  for (const n of sizes) {
    it(`solves ${trials[n]} random ${n}×${n} boards with only legal moves`, () => {
      const random = mulberry32(1000 + n);
      for (let trial = 0; trial < trials[n]; trial++) {
        const board = randomSolvableBoard(n, random);
        const moves = solve(board, n);
        expect(isSolved(playLegally(board, n, moves))).toBe(true);
      }
    }, 120_000);

    it(`solves ${n}×${n} boards produced by the scramble`, () => {
      const random = mulberry32(2000 + n);
      for (let trial = 0; trial < 10; trial++) {
        const scrambled = applyMoves(solvedBoard(n), n, generateScramble(solvedBoard(n), n, scrambleLength(n), random));
        expect(isSolved(playLegally(scrambled, n, solve(scrambled, n)))).toBe(true);
      }
    }, 120_000);
  }
});
