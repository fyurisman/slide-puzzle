import { defineConfig } from "vitest/config";

export default defineConfig({
  // Relative base so the build works at any GitHub Pages path.
  base: "./",
  test: {
    include: ["src/**/*.test.ts"],
  },
});
