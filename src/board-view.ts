import { type Board, gapCell, gapId, neighbors } from "./puzzle";

/** Duration of the snap after a drag or tap, for a full tile of travel. */
const SNAP_MS = 150;
/** Movement under this many pixels counts as a tap. */
const TAP_SLOP_PX = 6;

export interface BoardViewHooks {
  /** Current board (owned by the controller). */
  board(): Board;
  /** False while a scramble or solve is animating. */
  canDrag(): boolean;
  /** The user dragged or tapped the tile at `cell` into the gap. */
  onUserMove(cell: number, snapMs: number): void;
}

interface DragState {
  tileId: number;
  cell: number;
  pointerId: number;
  startX: number;
  startY: number;
  dirX: number;
  dirY: number;
  tilePx: number;
  offset: number;
  maxDistance: number;
}

export class BoardView {
  private tiles: HTMLElement[] = [];
  private n = 0;
  private drag: DragState | null = null;

  constructor(
    private readonly root: HTMLElement,
    private readonly hooks: BoardViewHooks,
  ) {
    root.addEventListener("pointerdown", (e) => this.onPointerDown(e));
    root.addEventListener("pointermove", (e) => this.onPointerMove(e));
    root.addEventListener("pointerup", (e) => this.onPointerUp(e, false));
    root.addEventListener("pointercancel", (e) => this.onPointerUp(e, true));
  }

  /** Rebuild all tiles for a board of size n. */
  build(n: number, board: Board, imageUrl: string): void {
    this.n = n;
    this.drag = null;
    this.root.style.setProperty("--n", String(n));
    this.root.replaceChildren();
    this.tiles = [];
    for (let id = 0; id < n * n; id++) {
      const tile = document.createElement("div");
      tile.className = "tile";
      tile.dataset.id = String(id);
      const row = Math.floor(id / n);
      const col = id % n;
      // Where this tile's slice sits within the image.
      tile.style.backgroundPosition = `${(col / (n - 1)) * 100}% ${(row / (n - 1)) * 100}%`;
      this.tiles.push(tile);
      if (id !== gapId(n)) this.root.append(tile);
    }
    this.setImage(imageUrl);
    for (let cell = 0; cell < board.length; cell++) this.place(board[cell], cell, 0);
  }

  setImage(url: string): void {
    for (const tile of this.tiles) tile.style.backgroundImage = `url("${url}")`;
  }

  /** Move a tile's element to `cell`, animating over `ms`. */
  place(tileId: number, cell: number, ms: number): void {
    const tile = this.tiles[tileId];
    tile.style.transitionDuration = `${ms}ms`;
    tile.style.setProperty("--col", String(cell % this.n));
    tile.style.setProperty("--row", String(Math.floor(cell / this.n)));
    tile.style.setProperty("--dx", "0px");
    tile.style.setProperty("--dy", "0px");
  }

  /** Like `place`, but resolves when the slide has finished. */
  slide(tileId: number, cell: number, ms: number): Promise<void> {
    this.place(tileId, cell, ms);
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /** Cancel any drag in progress, snapping the tile back. */
  cancelDrag(): void {
    if (!this.drag) return;
    const { tileId, cell } = this.drag;
    this.drag = null;
    this.place(tileId, cell, SNAP_MS);
  }

  private onPointerDown(e: PointerEvent): void {
    if (this.drag || !this.hooks.canDrag()) return;
    const target = (e.target as HTMLElement).closest<HTMLElement>(".tile");
    if (!target) return;
    const tileId = Number(target.dataset.id);
    const board = this.hooks.board();
    const cell = board.indexOf(tileId);
    const gap = gapCell(board);
    if (!neighbors(this.n, gap).includes(cell)) return;

    e.preventDefault();
    this.root.setPointerCapture(e.pointerId);
    const n = this.n;
    this.drag = {
      tileId,
      cell,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      dirX: (gap % n) - (cell % n),
      dirY: Math.floor(gap / n) - Math.floor(cell / n),
      tilePx: this.root.getBoundingClientRect().width / n,
      offset: 0,
      maxDistance: 0,
    };
    target.style.transitionDuration = "0ms";
  }

  private onPointerMove(e: PointerEvent): void {
    const d = this.drag;
    if (!d || e.pointerId !== d.pointerId) return;
    const mx = e.clientX - d.startX;
    const my = e.clientY - d.startY;
    d.maxDistance = Math.max(d.maxDistance, Math.hypot(mx, my));
    // Follow the pointer along the one allowed axis, at most one tile.
    d.offset = Math.min(d.tilePx, Math.max(0, mx * d.dirX + my * d.dirY));
    const tile = this.tiles[d.tileId];
    tile.style.setProperty("--dx", `${d.offset * d.dirX}px`);
    tile.style.setProperty("--dy", `${d.offset * d.dirY}px`);
  }

  private onPointerUp(e: PointerEvent, cancelled: boolean): void {
    const d = this.drag;
    if (!d || e.pointerId !== d.pointerId) return;
    this.drag = null;
    const isTap = d.maxDistance < TAP_SLOP_PX;
    const pastHalf = d.offset > d.tilePx / 2;
    const stillValid =
      this.hooks.canDrag() && this.hooks.board()[d.cell] === d.tileId && neighbors(this.n, gapCell(this.hooks.board())).includes(d.cell);
    if (!cancelled && stillValid && (isTap || pastHalf)) {
      const remaining = 1 - d.offset / d.tilePx;
      this.hooks.onUserMove(d.cell, Math.max(60, SNAP_MS * remaining));
    } else {
      this.place(d.tileId, this.hooks.board().indexOf(d.tileId), Math.max(60, (SNAP_MS * d.offset) / d.tilePx));
    }
  }
}
