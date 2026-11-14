import "./style.css";
import { BoardView } from "./board-view";
import { type CropRect, type CropSource, centerCrop, openCropEditor, renderCrop } from "./crop-editor";
import { type Board, MAX_SIZE, MIN_SIZE, applyMove, isSolved, solvedBoard } from "./puzzle";
import { drawSampleImage } from "./sample-image";
import {
  DEFAULT_SCRAMBLE_SECONDS,
  SCRAMBLE_DURATIONS,
  SCRAMBLE_MOVE_MS,
  generateScramble,
  scrambleMovesFor,
} from "./scramble";
import { SOLVE_MOVE_MS, solve } from "./solver";

const DEFAULT_SIZE = 4;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const boardEl = $<HTMLDivElement>("board");
const sizeSelect = $<HTMLSelectElement>("size");
const uploadBtn = $<HTMLButtonElement>("upload");
const fileInput = $<HTMLInputElement>("file");
const recropBtn = $<HTMLButtonElement>("recrop");
const scrambleBtn = $<HTMLButtonElement>("scramble");
const solveBtn = $<HTMLButtonElement>("solve");
const messageEl = $<HTMLParagraphElement>("message");
const countdownEl = $<HTMLParagraphElement>("countdown");
const scrambleMenu = $<HTMLDivElement>("scramble-menu");
const scrambleOptions = $<HTMLDivElement>("scramble-options");
const menuBackdrop = $<HTMLDivElement>("menu-backdrop");

// ---- State -----------------------------------------------------------------

type RunKind = "scramble" | "solve";
interface Run {
  kind: RunKind;
  stopRequested: boolean;
  done: Promise<void>;
}

let n = DEFAULT_SIZE;
let board: Board = solvedBoard(n);
let source: CropSource;
let crop: CropRect;
let imageUrl = "";
let run: Run | null = null;
/** Bumped by every control; a stale async action checks it and bails. */
let actionSeq = 0;

const view = new BoardView(boardEl, {
  board: () => board,
  canDrag: () => run === null,
  onUserMove: (cell, ms) => {
    const tileId = board[cell];
    applyMove(board, n, cell);
    view.place(tileId, board.indexOf(tileId), ms);
    updateButtons();
  },
});

// ---- Animation runs --------------------------------------------------------

function startRun(kind: RunKind, moves: number[], msPerMove: number): void {
  const r: Run = { kind, stopRequested: false, done: Promise.resolve() };
  r.done = (async () => {
    for (let i = 0; i < moves.length; i++) {
      if (r.stopRequested) break;
      if (kind === "scramble") showCountdown((moves.length - i) * msPerMove);
      const cell = moves[i];
      const tileId = board[cell];
      applyMove(board, n, cell);
      await view.slide(tileId, board.indexOf(tileId), msPerMove);
    }
  })().finally(() => {
    if (run === r) run = null;
    countdownEl.textContent = "";
    updateButtons();
  });
  run = r;
  view.cancelDrag();
  updateButtons();
}

/** Stop the current run after its current slide; resolves once stopped. */
async function stopRun(): Promise<void> {
  if (!run) return;
  run.stopRequested = true;
  await run.done;
}

/** Time left in the scramble, in whole seconds rounded up. */
function showCountdown(msLeft: number): void {
  countdownEl.textContent = `${Math.ceil(msLeft / 1000)} s`;
}

function updateButtons(): void {
  // While a run is going, its Stop button is the only enabled control.
  const running = run !== null;
  scrambleBtn.textContent = run?.kind === "scramble" ? "Stop" : "Scramble";
  solveBtn.textContent = run?.kind === "solve" ? "Stop" : "Solve";
  scrambleBtn.disabled = run?.kind === "solve";
  solveBtn.disabled = run?.kind === "scramble" || (!running && isSolved(board));
  sizeSelect.disabled = running;
  uploadBtn.disabled = running;
  recropBtn.disabled = running;
  scrambleBtn.classList.toggle("stop", run?.kind === "scramble");
  solveBtn.classList.toggle("stop", run?.kind === "solve");
}

// ---- Image handling --------------------------------------------------------

async function applyImage(src: CropSource, rect: CropRect): Promise<void> {
  const canvas = renderCrop(src, rect);
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.92));
  if (imageUrl) URL.revokeObjectURL(imageUrl);
  imageUrl = blob ? URL.createObjectURL(blob) : canvas.toDataURL("image/jpeg", 0.92);
  source = src;
  crop = rect;
}

function resetBoard(): void {
  board = solvedBoard(n);
  view.build(n, board, imageUrl);
  updateButtons();
}

const UNSUPPORTED =
  "Sorry, your browser can't open that file. Please try a JPG, PNG, WebP or GIF picture.";

async function loadFile(file: File): Promise<CropSource> {
  if (file.type && !file.type.startsWith("image/")) throw new Error(UNSUPPORTED);
  try {
    const bitmap = await createImageBitmap(file);
    return { image: bitmap, width: bitmap.width, height: bitmap.height };
  } catch {
    // Fallback for browsers that can't decode some formats via createImageBitmap.
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return { image: img, width: img.naturalWidth, height: img.naturalHeight };
    } catch {
      throw new Error(UNSUPPORTED);
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

function showMessage(text: string): void {
  messageEl.textContent = text;
}

// ---- Controls --------------------------------------------------------------

// During a run every other control is disabled, so pressing the run's own
// button can only mean Stop. The board isn't usable again until it has.
scrambleBtn.addEventListener("click", () => {
  if (run) return void stopRun();
  openScrambleMenu();
});

// ---- Scramble duration picker ---------------------------------------------

const SECONDS_KEY = "slide-puzzle:scramble-seconds";

/** Last chosen duration, remembered in this browser (storage may be blocked). */
function rememberedSeconds(): number {
  try {
    const saved = Number(localStorage.getItem(SECONDS_KEY));
    if ((SCRAMBLE_DURATIONS as readonly number[]).includes(saved)) return saved;
  } catch {
    /* fall through to the default */
  }
  return DEFAULT_SCRAMBLE_SECONDS;
}

function rememberSeconds(seconds: number): void {
  try {
    localStorage.setItem(SECONDS_KEY, String(seconds));
  } catch {
    /* not remembered; that's fine */
  }
}

function openScrambleMenu(): void {
  const selected = rememberedSeconds();
  for (const btn of scrambleOptions.querySelectorAll<HTMLButtonElement>("button")) {
    btn.classList.toggle("selected", Number(btn.dataset.seconds) === selected);
  }
  scrambleMenu.hidden = false;
  menuBackdrop.hidden = false;
  scrambleBtn.setAttribute("aria-expanded", "true");
  scrambleOptions.querySelector<HTMLButtonElement>("button.selected")?.focus();
}

function closeScrambleMenu(): void {
  if (scrambleMenu.hidden) return;
  scrambleMenu.hidden = true;
  menuBackdrop.hidden = true;
  scrambleBtn.setAttribute("aria-expanded", "false");
}

for (const seconds of SCRAMBLE_DURATIONS) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = `${seconds} s`;
  btn.dataset.seconds = String(seconds);
  btn.addEventListener("click", () => {
    closeScrambleMenu();
    rememberSeconds(seconds);
    actionSeq++;
    startRun("scramble", generateScramble(board, n, scrambleMovesFor(seconds)), SCRAMBLE_MOVE_MS);
  });
  scrambleOptions.append(btn);
}

// A tap anywhere outside the menu (including on Scramble itself) only closes it.
// Close on click (not pointerdown) so the whole tap lands on the backdrop and
// nothing underneath sees the release.
menuBackdrop.addEventListener("pointerdown", (e) => e.preventDefault());
menuBackdrop.addEventListener("click", closeScrambleMenu);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !scrambleMenu.hidden) {
    closeScrambleMenu();
    scrambleBtn.focus();
  }
});

solveBtn.addEventListener("click", () => {
  if (run) return void stopRun();
  if (isSolved(board)) return;
  actionSeq++;
  startRun("solve", solve(board, n), SOLVE_MOVE_MS);
});

sizeSelect.addEventListener("change", async () => {
  const seq = ++actionSeq;
  await stopRun();
  if (seq !== actionSeq) return;
  n = Number(sizeSelect.value);
  resetBoard();
});

uploadBtn.addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", async () => {
  const file = fileInput.files?.[0];
  fileInput.value = "";
  if (!file) return;
  showMessage("");
  const seq = ++actionSeq;
  await stopRun();
  let src: CropSource;
  try {
    src = await loadFile(file);
  } catch (err) {
    showMessage((err as Error).message);
    return;
  }
  if (seq !== actionSeq) return;
  const chosen = await openCropEditor(src, centerCrop(src), n);
  if (!chosen || seq !== actionSeq) return;
  await applyImage(src, chosen);
  resetBoard();
});

recropBtn.addEventListener("click", async () => {
  showMessage("");
  const seq = ++actionSeq;
  await stopRun();
  if (seq !== actionSeq) return;
  const chosen = await openCropEditor(source, crop, n);
  if (!chosen || seq !== actionSeq) return;
  await applyImage(source, chosen);
  resetBoard();
});

// ---- Start -----------------------------------------------------------------

for (let size = MIN_SIZE; size <= MAX_SIZE; size++) {
  sizeSelect.add(new Option(`${size} × ${size}`, String(size), size === n, size === n));
}

const sample = drawSampleImage();
const sampleSource: CropSource = { image: sample, width: sample.width, height: sample.height };
await applyImage(sampleSource, centerCrop(sampleSource));
resetBoard();
