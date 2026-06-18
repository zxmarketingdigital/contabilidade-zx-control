// @cloudflare/vitest-pool-workers@0.16 + vitest@4:
// pool é configurado via cloudflarePool(options).
import { defineConfig } from "vitest/config";
import { cloudflarePool } from "@cloudflare/vitest-pool-workers";

export default defineConfig({
  test: {
    pool: cloudflarePool({ wrangler: { configPath: "./wrangler.toml" } }),
  },
});
