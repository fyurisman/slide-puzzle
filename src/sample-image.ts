/**
 * Original built-in artwork: a stylised sunset over mountains and water,
 * drawn on a canvas so the site ships with no third-party image. Lots of
 * distinct shapes and colors so every tile is recognisable.
 */
export function drawSampleImage(size = 1024): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const s = size / 1024;
  ctx.scale(s, s);

  const horizon = 640;

  // Sky.
  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, "#14163d");
  sky.addColorStop(0.35, "#4a2a7a");
  sky.addColorStop(0.7, "#d9507a");
  sky.addColorStop(1, "#f9a65a");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 1024, horizon);

  // Stars (deterministic).
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  ctx.fillStyle = "#fff";
  for (let i = 0; i < 90; i++) {
    const x = rand() * 1024;
    const y = rand() * 330;
    ctx.globalAlpha = 0.4 + rand() * 0.6;
    ctx.beginPath();
    ctx.arc(x, y, 0.8 + rand() * 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Crescent moon, top right.
  ctx.fillStyle = "#fdf3c4";
  ctx.beginPath();
  ctx.arc(850, 150, 58, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#20194a";
  ctx.beginPath();
  ctx.arc(878, 132, 52, 0, Math.PI * 2);
  ctx.fill();

  // Soft clouds.
  const cloud = (x: number, y: number, w: number, color: string) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(x, y, w, w * 0.18, 0, 0, Math.PI * 2);
    ctx.ellipse(x - w * 0.35, y + 6, w * 0.5, w * 0.14, 0, 0, Math.PI * 2);
    ctx.ellipse(x + w * 0.4, y + 8, w * 0.45, w * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
  };
  cloud(230, 300, 150, "rgba(255, 170, 200, 0.55)");
  cloud(760, 380, 120, "rgba(255, 190, 160, 0.5)");
  cloud(420, 430, 90, "rgba(255, 210, 170, 0.45)");

  // Striped sun.
  const sunY = 440;
  const sunR = 170;
  ctx.save();
  ctx.beginPath();
  ctx.arc(512, sunY, sunR, 0, Math.PI * 2);
  ctx.clip();
  const sun = ctx.createLinearGradient(0, sunY - sunR, 0, sunY + sunR);
  sun.addColorStop(0, "#ffe58a");
  sun.addColorStop(1, "#ff6a3d");
  ctx.fillStyle = sun;
  ctx.fillRect(312, sunY - sunR, 400, sunR * 2);
  for (let i = 0; i < 7; i++) {
    const y = sunY - 30 + i * 30;
    ctx.fillStyle = sky;
    ctx.fillRect(312, y, 400, 4 + i * 3);
  }
  ctx.restore();

  // Mountain layers.
  const ridge = (points: [number, number][], color: string) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, horizon);
    for (const [x, y] of points) ctx.lineTo(x, y);
    ctx.lineTo(1024, horizon);
    ctx.closePath();
    ctx.fill();
  };
  ridge(
    [[0, 470], [120, 400], [210, 460], [330, 360], [450, 470], [560, 430], [680, 330], [800, 450], [920, 390], [1024, 440]],
    "#8a3f86",
  );
  ridge(
    [[0, 540], [90, 500], [190, 560], [300, 470], [420, 570], [600, 520], [720, 470], [860, 560], [960, 510], [1024, 540]],
    "#5a2a6e",
  );
  // Snow caps on the back range.
  ctx.fillStyle = "#f3d9ef";
  for (const [x, y] of [[330, 360], [680, 330]] as const) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - 38, y + 36);
    ctx.lineTo(x - 12, y + 28);
    ctx.lineTo(x + 6, y + 42);
    ctx.lineTo(x + 40, y + 34);
    ctx.closePath();
    ctx.fill();
  }
  ridge(
    [[0, 600], [140, 560], [260, 610], [380, 580], [520, 620], [650, 575], [780, 615], [900, 570], [1024, 600]],
    "#33194f",
  );

  // Water.
  const water = ctx.createLinearGradient(0, horizon, 0, 1024);
  water.addColorStop(0, "#3b1f5c");
  water.addColorStop(1, "#0d0f2b");
  ctx.fillStyle = water;
  ctx.fillRect(0, horizon, 1024, 1024 - horizon);

  // Sun reflection: shrinking warm stripes.
  for (let i = 0; i < 12; i++) {
    const y = horizon + 18 + i * 30;
    const w = 300 - i * 20;
    ctx.fillStyle = i % 2 ? "rgba(255, 140, 80, 0.75)" : "rgba(255, 220, 120, 0.8)";
    ctx.fillRect(512 - w / 2 + Math.sin(i * 1.7) * 18, y, w, 8 - i * 0.4);
  }

  // Pine trees on the left shore.
  const pine = (x: number, base: number, h: number) => {
    ctx.fillStyle = "#0b0a1e";
    ctx.fillRect(x - 5, base - h * 0.15, 10, h * 0.15);
    for (let t = 0; t < 3; t++) {
      const top = base - h + t * h * 0.22;
      const half = h * (0.18 + t * 0.07);
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x - half, top + h * 0.4);
      ctx.lineTo(x + half, top + h * 0.4);
      ctx.closePath();
      ctx.fill();
    }
  };
  ctx.fillStyle = "#0b0a1e";
  ctx.beginPath();
  ctx.moveTo(0, 820);
  ctx.quadraticCurveTo(160, 790, 300, 860);
  ctx.lineTo(300, 1024);
  ctx.lineTo(0, 1024);
  ctx.fill();
  pine(60, 840, 260);
  pine(150, 830, 190);
  pine(230, 860, 140);

  // Little sailboat on the right.
  ctx.fillStyle = "#1a1233";
  ctx.beginPath();
  ctx.moveTo(740, 800);
  ctx.lineTo(860, 800);
  ctx.lineTo(840, 825);
  ctx.lineTo(760, 825);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#fbe7d0";
  ctx.beginPath();
  ctx.moveTo(800, 690);
  ctx.lineTo(800, 795);
  ctx.lineTo(860, 795);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#ff8f6b";
  ctx.beginPath();
  ctx.moveTo(795, 710);
  ctx.lineTo(795, 795);
  ctx.lineTo(752, 795);
  ctx.closePath();
  ctx.fill();

  // Fireflies over the water for texture in the dark lower corners.
  ctx.fillStyle = "#ffe9a8";
  for (let i = 0; i < 26; i++) {
    const x = 320 + rand() * 700;
    const y = 860 + rand() * 150;
    ctx.globalAlpha = 0.3 + rand() * 0.6;
    ctx.beginPath();
    ctx.arc(x, y, 1.5 + rand() * 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  return canvas;
}
