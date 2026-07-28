// ════════════════════════════════════════════════════════════════════════
// Monta demo-publica/dist/ pra DEMO PÚBLICA no Cloudflare Pages.
//   node demo-publica/build.mjs
//   wrangler pages deploy demo-publica/dist --project-name demo-contabilidade-zx-control
//
// O painel da demo é GERADO a partir de painel/ — nunca uma cópia mantida à mão.
// Assim uma correção no produto chega na demo no próximo build, e o que vive
// aqui é só o que é exclusivo da demo: mock-api.js (API 100% no browser),
// config.js (mode:"demo") e proposta.html.
//
// A entrada-sem-login NÃO é um fork do painel: é o bloco guardado por
// ZX.mode === "demo" que já existe em painel/app.js + painel/style.css. Em
// produção o modo é "prod" e nada disso roda — a auth do produto não muda.
// ════════════════════════════════════════════════════════════════════════

import { mkdir, readFile, writeFile, copyFile, rm } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(__dirname, "..");
const DIST = join(__dirname, "dist");

await rm(DIST, { recursive: true, force: true });
await mkdir(DIST, { recursive: true });

// Painel estático, direto de painel/ (fonte única).
for (const f of ["index.html", "style.css", "app.js"]) {
  await copyFile(join(RAIZ, "painel", f), join(DIST, f));
}

// Arquivos exclusivos da demo.
for (const f of ["mock-api.js", "proposta.html"]) {
  await copyFile(join(__dirname, f), join(DIST, f));
}

// A demo intercepta window.fetch: mock-api.js precisa carregar DEPOIS do
// config.js (lê ZX.token/ZX.apiBase) e ANTES do app.js (que já dispara chamadas).
const TAG_CONFIG = `<script src="config.js"></script>`;
const TAG_MOCK = `<script src="mock-api.js"></script>`;
const htmlPath = join(DIST, "index.html");
const html = await readFile(htmlPath, "utf8");
if (!html.includes(TAG_CONFIG)) throw new Error(`tag ${TAG_CONFIG} não encontrada em painel/index.html`);
if (html.includes(TAG_MOCK)) throw new Error("painel/index.html já carrega mock-api.js — isso é exclusivo da demo");
await writeFile(htmlPath, html.replace(TAG_CONFIG, `${TAG_CONFIG}\n  ${TAG_MOCK}`));

// Config de DEMO (mesmo token que mock-api.js valida no Bearer).
await writeFile(
  join(DIST, "config.js"),
  `// Demo pública estática — Contabilidade ZX Control (Cloudflare Pages).\n` +
    `// GERADO por demo-publica/build.mjs — não editar à mão.\n` +
    `// Modo demo: entra direto, API 100% mockada no browser por mock-api.js.\n` +
    `// Zero credencial, zero Supabase, zero IA real.\n` +
    `window.ZX = { mode: "demo", apiBase: "/api", token: "demo-contabil-2026", prazoAlertaDias: 5 };\n`,
);

console.log(
  `✅ demo-publica/dist/ pronto — deploy: wrangler pages deploy demo-publica/dist --project-name demo-contabilidade-zx-control`,
);
