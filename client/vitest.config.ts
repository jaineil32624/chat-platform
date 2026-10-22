import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    globals: true,
    environment: "jsdom",
    include: ["../tests/**/*.test.ts"],
    setupFiles: ["../tests/setup.ts"],
  },
  server: { fs: { allow: [".."] } },
});
