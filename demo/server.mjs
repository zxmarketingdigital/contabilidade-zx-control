// ════════════════════════════════════════════════════════════════════════
// TEMPLATE — mock server da DEMO local (demo/server.mjs).
// Padrão-ouro: demo/server.mjs do Contabilidade ZX Control.
//
// O que ele faz: espelha o contrato da API real (rotas /api/* + Bearer auth,
// fail-closed) servindo dados fictícios de demo/data.mjs em memória, e serve
// os arquivos estáticos de painel/. NÃO toca em src/ — é só andaime de demo.
//
// DoD item 4: `node demo/server.mjs` sobe o painel POPULADO sem NENHUMA
// credencial (sem .env, sem Supabase, sem chave de API).
//
// INSTRUÇÕES PRO DEV (apague este bloco ao preencher):
//  1. Renomeie as coleções genéricas (itens/eventos) pros nomes REAIS das
//     entidades — as rotas devem espelhar 1:1 o router real do Worker.
//  2. Troque TOKEN pra um valor "demo-<slug>-2026" e use o MESMO valor em
//     painel/config.js.
//  3. Os dados vêm de data.mjs (≥10 registros realistas por entidade).
// ════════════════════════════════════════════════════════════════════════

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import * as DB from "./data.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PAINEL = join(__dirname, "..", "painel");
const PORT = Number(process.env.PORT ?? 8910);
const TOKEN = "demo-setup-2026"; // TODO(dev): "demo-<slug>-2026" — mesmo valor em painel/config.js

// Estado mutável em memória: POSTs/PUTs da demo persistem enquanto o server
// vive. Cópias rasas pra nunca mutar o seed importado.
const state = {
  itens: DB.itens.map((x) => ({ ...x })), // TODO(dev): renomear pra entidade real
  clientes: DB.clientes.map((x) => ({ ...x })),
  eventos: DB.eventos.map((x) => ({ ...x })), // TODO(dev): renomear (visitas/consultas/...)
};
// ids novos não colidem com os do seed
const seq = Object.fromEntries(Object.entries(state).map(([k, v]) => [k, v.length]));
let config = { ...DB.config };

// Defaults aplicados no POST de cada coleção (espelhar o router real).
const defaults = {
  itens: () => ({ status: "ativo", origem: "manual", atualizado_em: new Date().toISOString() }),
  clientes: () => ({ estado: "novo", opt_out: false, origem: "manual" }),
  eventos: () => ({ status: "agendada" }),
};
const prefix = { itens: "i", clientes: "c", eventos: "v" };

const MIME = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "application/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".ico": "image/x-icon" };

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

function json(res, data, status = 200) {
  res.writeHead(status, { "Content-Type": "application/json", ...CORS });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve) => {
    let b = "";
    req.on("data", (c) => (b += c));
    req.on("end", () => { try { resolve(b ? JSON.parse(b) : {}); } catch { resolve({}); } });
  });
}

async function serveStatic(req, res) {
  const p = req.url === "/" ? "/index.html" : req.url.split("?")[0];
  try {
    const buf = await readFile(join(PAINEL, p));
    res.writeHead(200, { "Content-Type": MIME[extname(p)] ?? "application/octet-stream" });
    res.end(buf);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (!url.pathname.startsWith("/api")) return serveStatic(req, res);

  if (req.method === "OPTIONS") { res.writeHead(204, CORS); return res.end(); }

  // Bearer auth (fail-closed, igual ao router real — token ausente/vazio = 401)
  if ((req.headers.authorization ?? "") !== `Bearer ${TOKEN}`) return json(res, { error: "Unauthorized" }, 401);

  const path = url.pathname.replace(/^\/api/, "");
  const m = req.method;

  // ── CRUD genérico por coleção: GET lista · POST cria ──
  for (const col of Object.keys(state)) {
    if (path === `/${col}`) {
      if (m === "GET") return json(res, state[col]);
      if (m === "POST") {
        const d = await readBody(req);
        const novo = { ...defaults[col](), ...d, id: prefix[col] + (++seq[col]) };
        state[col].push(novo);
        return json(res, novo, 201);
      }
    }
    // PUT /:colecao/:id/status — atualização de estado (espelhar o router real)
    const sm = path.match(new RegExp(`^/${col}/([^/]+)/status$`));
    if (m === "PUT" && sm) {
      const { status } = await readBody(req);
      const row = state[col].find((x) => x.id === sm[1]);
      if (row) row.status = status;
      return json(res, { ok: true });
    }
  }

  // ── Conversas + mensagens ──
  if (m === "GET" && path === "/conversas") {
    const cid = url.searchParams.get("clienteId");
    if (cid) return json(res, DB.mensagens[cid] ?? []);
    return json(res, DB.conversas);
  }

  // ── Audit log + status + config ──
  if (m === "GET" && path === "/disparos") return json(res, [...DB.disparos].sort((a, b) => new Date(b.criado_em) - new Date(a.criado_em)));
  if (m === "GET" && path === "/status") return json(res, { evolution: DB.adapterStatus });
  if (m === "GET" && path === "/config") return json(res, config);
  if (m === "PUT" && path === "/config") { config = { ...config, ...(await readBody(req)) }; return json(res, { ok: true }); }

  return json(res, { error: "Not Found" }, 404);
});

server.listen(PORT, () => {
  console.log(`\n  📦 DEMO local — painel populado, zero credencial`);
  console.log(`  Painel:  http://localhost:${PORT}/`);
  console.log(`  API:     http://localhost:${PORT}/api/*  (Bearer ${TOKEN})`);
  console.log(`  ${Object.entries(state).map(([k, v]) => `${v.length} ${k}`).join(" · ")} · ${DB.conversas.length} conversas · ${DB.disparos.length} disparos\n`);
});
