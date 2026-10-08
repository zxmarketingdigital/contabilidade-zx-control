// @cloudflare/vitest-pool-workers@0.16 + vitest@4:
// pool é configurado via cloudflarePool(options).
//
// Dois projetos: o núcleo roda em workerd (sem disco real); tests/node/ roda em Node puro porque
// testa código de navegador/CLI (painel/marca.js, setup/marca.mjs) que precisa de arquivos reais.
import { defineConfig } from "vitest/config";
import { cloudflarePool } from "@cloudflare/vitest-pool-workers";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "workers",
          include: ["tests/**/*.test.ts"],
          exclude: ["tests/node/**", "**/node_modules/**"],
          pool: cloudflarePool({ wrangler: { configPath: "./wrangler.toml" } }),
        },
      },
      {
        test: {
          name: "node",
          include: ["tests/node/**/*.test.ts"],
          environment: "node",
        },
      },
    ],
  },
});
