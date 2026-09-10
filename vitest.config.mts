import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";
import nextEnv from "@next/env";
const { loadEnvConfig } = nextEnv;

loadEnvConfig(process.cwd());

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    environment: "node",
    setupFiles: ["tests/e2e/setup.ts"],
    exclude: ["tests/e2e/**/*.spec.ts", "node_modules/**", ".next/**"],
  },
});
