import { defineConfig } from "vitest/config";
import path from "node:path";

// Unit tests for the web app and the extension, plus tests/integration.test.ts,
// which runs against a real Postgres when TEST_DATABASE_URL is set (skipped otherwise).
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "apps/web/src") },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
});
