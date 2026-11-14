# Slide Puzzle

Turn any picture into a sliding puzzle. Upload a photo, crop it, pick a grid from 3×3 to 8×8, scramble it, and solve it yourself, or watch it solve itself.

Everything runs in the browser. Pictures are never uploaded to a server.

## Features

- **Upload and crop**: any JPG, PNG, WebP or GIF. A crop editor starts center-cropped. Zoom with the slider, mouse wheel or pinch, and drag to pan. **Re-crop** reopens it at any time.
- **Built-in sample**: an original generated artwork, so the page is playable straight away.
- **Grid sizes**: 3×3 to 8×8. The bottom-right tile is the gap.
- **Drag to slide**: drag a tile next to the gap (mouse or touch). Past halfway it snaps into the gap; otherwise it springs back. A tap also moves it.
- **Scramble**: tapping Scramble opens a picker for how long to scramble: 10 s to 60 s in 10 s steps. Your last choice is remembered, and the default is 30 s. Tap outside, press Esc or tap Scramble again to close it. Moves are random and legal, at 150 ms per slide on every grid, so the duration sets the number of moves (10 s = 66 moves, 60 s = 400). The gap drifts toward the cells it has visited least recently, so even short scrambles mix the whole board.
- **Solve**: a human-style solver that solves the top row, then the left column, shrinking the puzzle down to the final 2×2 corner. It plays every move at a steady 150 ms per slide.
- While a scramble or solve is running, its button turns into **Stop** and every other control is disabled until you press it or the run ends. A scramble shows a countdown of the seconds left.

## Development

```bash
npm install
npm run dev      # local dev server
npm test         # solver and scramble tests (Vitest)
npm run build    # type-check and build to dist/
```

## How the solver works

`src/solver.ts` follows the classic layer-by-layer method. Each step places one tile, or the last two tiles of a row or column together, the case that is famously fiddly by hand. To do this it runs a breadth-first search over the positions of just those tiles and the gap, using only cells that aren't locked yet. All other tiles are treated as interchangeable, so each search is tiny (an 8×8 board solves in under 30 ms). It also never gets stuck the way hand-written move sequences can.

## Deployment

Pushing to `main` runs `.github/workflows/deploy.yml`. It installs dependencies, runs the tests, builds the site and publishes `dist/` to GitHub Pages. In the repository settings, under **Settings → Pages → Build and deployment**, set **Source** to **GitHub Actions**.
