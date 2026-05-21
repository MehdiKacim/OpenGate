import { defineConfig } from "vitest/config"
import path from "node:path"

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    exclude: ["**/node_modules/**", "**/archive/**"],
  },
  resolve: {
    alias: {
      "@opengate/db/test-utils": path.resolve(__dirname, "packages/db/src/test-utils.ts"),
    },
  },
})
