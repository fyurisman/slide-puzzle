/**
 * Square crop editor shown as a modal step. Starts center-cropped; the user
 * zooms with the slider, mouse wheel or pinch, and pans by dragging. The
 * crop always lies fully inside the image, so the square is never padded.
 */

export interface CropRect {
  /** Top-left corner and side length, in source-image pixels. */
  x: number;
  y: number;
  side: number;
}

export interface CropSource {
  image: CanvasImageSource;
  width: number;
  height: number;
}

export const OUTPUT_SIZE = 1024;
const MAX_ZOOM = 6;

export function centerCrop(src: CropSource): CropRect {
  const side = Math.min(src.width, src.height);
  return { x: (src.width - side) / 2, y: (src.height - side) / 2, side };
}

/** Render the crop to a square canvas of OUTPUT_SIZE. */
export function renderCrop(src: CropSource, crop: CropRect): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = OUTPUT_SIZE;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src.image, crop.x, crop.y, crop.side, crop.side, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
  return canvas;
}

/**
 * Opens the editor. Resolves with the chosen crop, or null if cancelled.
 * `gridSize` draws faint guide lines showing how the image will be cut.
 */
export function openCropEditor(
  src: CropSource,
  initial: CropRect,
  gridSize: number,
): Promise<CropRect | null> {
  const dialog = document.getElementById("crop-dialog") as HTMLDialogElement;
  const canvas = document.getElementById("crop-canvas") as HTMLCanvasElement;
  const slider = document.getElementById("crop-zoom") as HTMLInputElement;
  const doneBtn = document.getElementById("crop-done") as HTMLButtonElement;
  const cancelBtn = document.getElementById("crop-cancel") as HTMLButtonElement;
  const ctx = canvas.getContext("2d")!;

  const fullSide = Math.min(src.width, src.height);
  const minSide = fullSide / MAX_ZOOM;
  let crop: CropRect = { ...initial };

  const clamp = () => {
    crop.side = Math.min(fullSide, Math.max(minSide, crop.side));
    crop.x = Math.min(src.width - crop.side, Math.max(0, crop.x));
    crop.y = Math.min(src.height - crop.side, Math.max(0, crop.y));
  };

  const draw = () => {
    const rect = canvas.getBoundingClientRect();
    const px = Math.round(rect.width * devicePixelRatio);
    if (canvas.width !== px) canvas.width = canvas.height = px;
    ctx.imageSmoothingQuality = "high";
    ctx.clearRect(0, 0, px, px);
    ctx.drawImage(src.image, crop.x, crop.y, crop.side, crop.side, 0, 0, px, px);
    // Grid guides.
    ctx.strokeStyle = "rgba(255,255,255,0.45)";
    ctx.lineWidth = Math.max(1, devicePixelRatio);
    ctx.beginPath();
    for (let i = 1; i < gridSize; i++) {
      const p = Math.round((i * px) / gridSize) + 0.5;
      ctx.moveTo(p, 0);
      ctx.lineTo(p, px);
      ctx.moveTo(0, p);
      ctx.lineTo(px, p);
    }
    ctx.stroke();
    slider.value = String(fullSide / crop.side);
  };

  /** Zoom to `side`, keeping the source point under (u, v) in [0,1] fixed. */
  const zoomTo = (side: number, u = 0.5, v = 0.5) => {
    const px = crop.x + u * crop.side;
    const py = crop.y + v * crop.side;
    crop.side = Math.min(fullSide, Math.max(minSide, side));
    crop.x = px - u * crop.side;
    crop.y = py - v * crop.side;
    clamp();
    draw();
  };

  const toUnit = (e: { clientX: number; clientY: number }) => {
    const r = canvas.getBoundingClientRect();
    return { u: (e.clientX - r.left) / r.width, v: (e.clientY - r.top) / r.height, w: r.width };
  };

  // Pointer handling: one pointer pans, two pointers pinch-zoom (and pan).
  const pointers = new Map<number, { x: number; y: number }>();
  const onPointerDown = (e: PointerEvent) => {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };
  const onPointerMove = (e: PointerEvent) => {
    const prev = pointers.get(e.pointerId);
    if (!prev) return;
    const { w } = toUnit(e);
    if (pointers.size === 1) {
      crop.x -= ((e.clientX - prev.x) * crop.side) / w;
      crop.y -= ((e.clientY - prev.y) * crop.side) / w;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      clamp();
      draw();
      return;
    }
    const [a, b] = [...pointers.values()];
    const before = Math.hypot(a.x - b.x, a.y - b.y);
    const midBefore = { clientX: (a.x + b.x) / 2, clientY: (a.y + b.y) / 2 };
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const [c, d] = [...pointers.values()];
    const after = Math.hypot(c.x - d.x, c.y - d.y);
    const midAfter = { clientX: (c.x + d.x) / 2, clientY: (c.y + d.y) / 2 };
    // Pan by midpoint movement, then zoom around the new midpoint.
    crop.x -= ((midAfter.clientX - midBefore.clientX) * crop.side) / w;
    crop.y -= ((midAfter.clientY - midBefore.clientY) * crop.side) / w;
    clamp();
    const { u, v } = toUnit(midAfter);
    if (before > 0 && after > 0) zoomTo((crop.side * before) / after, u, v);
    else draw();
  };
  const onPointerUp = (e: PointerEvent) => {
    pointers.delete(e.pointerId);
  };
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const { u, v } = toUnit(e);
    zoomTo(crop.side * Math.exp(e.deltaY * 0.0015), u, v);
  };
  const onSlider = () => zoomTo(fullSide / Number(slider.value));
  const onResize = () => draw();

  slider.min = "1";
  slider.max = String(MAX_ZOOM);
  slider.step = "0.01";

  return new Promise((resolve) => {
    const finish = (result: CropRect | null) => {
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("wheel", onWheel);
      slider.removeEventListener("input", onSlider);
      window.removeEventListener("resize", onResize);
      doneBtn.onclick = null;
      cancelBtn.onclick = null;
      dialog.oncancel = null;
      dialog.close();
      resolve(result);
    };
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    slider.addEventListener("input", onSlider);
    window.addEventListener("resize", onResize);
    doneBtn.onclick = () => finish({ ...crop });
    cancelBtn.onclick = () => finish(null);
    dialog.oncancel = (e) => {
      e.preventDefault();
      finish(null);
    };
    dialog.showModal();
    clamp();
    draw();
  });
}
