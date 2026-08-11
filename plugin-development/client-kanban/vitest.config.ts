import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true
  },
  resolve: {
    alias: {
      obsidian: fileURLToPath(new URL("./tests/obsidian.ts", import.meta.url))
    }
  }
});
