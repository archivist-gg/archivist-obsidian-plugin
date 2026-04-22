import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    setupFiles: [path.resolve(__dirname, "tests/setup.ts")],
  },
  resolve: {
    alias: {
      obsidian: path.resolve(__dirname, "tests/__mocks__/obsidian.ts"),
      "@": path.resolve(__dirname, "src"),
    },
  },
});
