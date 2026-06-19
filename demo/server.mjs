// ════════════════════════════════════════════════════════════════════════
// DEMO local do Contabilidade ZX Control. `node demo/server.mjs` sobe o painel
// POPULADO sem NENHUMA credencial (sem .env, sem Supabase, sem chave de IA).
//
// Espelha o contrato da API real (src/app.ts): rotas /api/* com Bearer auth
// fail-closed, servindo dados de demo/data.mjs em memória. Os agentes respondem
// com outputs MOCK pré-gravados (sem chamada de IA real — spec §8).
// Serve um /config.js próprio em modo demo (login fake).
// ════════════════════════════════════════════════════════════════════════

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import * as DB from "./data.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PAINEL = join(__dirname, "..", "painel");
const PORT = Number(process.env.PORT ?? 8910);
const TOKEN = DB.TOKEN;
const DISCLAIMER = "Conteúdo gerado por IA — a conferência pelo contador responsável é obrigatória.";

// Estado mutável em memória (cópias rasas — nunca muta o seed importado).
const state = {
  empresas: DB.empresas.map((x) => ({ ...x })),
  competencias: DB.competencias.map((x) => ({ ...x })),
  prazos: DB.prazos.map((x) => ({ ...x })),
  saidas: DB.saidas.map((x) => ({ ...x })),
};
let seq = 1000;
const novoId = (p) => `${p}${++seq}`;
const agora = () => new Date().toISOString();
const comDisc = (t) => `${t}\n\n${DISCLAIMER}`;

const MIME = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "application/javascript; charset=utf-8", ".svg": "image/svg+xml", ".ico": "image/x-icon" };
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Authorization, Content-Type", "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS" };

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

// Config da demo, injetada em /config.js (login fake, token demo).
const CONFIG_JS = `window.ZX = { mode: "demo", apiBase: "/api", token: ${JSON.stringify(TOKEN)}, prazoAlertaDias: 5 };`;

async function serveStatic(req, res) {
  if (req.url === "/config.js") {
    res.writeHead(200, { "Content-Type": MIME[".js"] });
    return res.end(CONFIG_JS);
  }
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

// Outputs mock dos agentes texto→texto (sem IA real).
const MOCK_AGENTE = {
  enquadramento: () => comDisc("FICHA: empresa de serviços, porte compatível com ME/EPP.\nREGIME SUGERIDO: Simples Nacional (análise preliminar).\nOBRIGAÇÕES: DAS, DCTFWeb, eSocial.\nDOCUMENTOS A SOLICITAR: contrato social, faturamento dos últimos 12 meses, folha.\nPARECER: enquadramento preliminar; confira a apuração efetiva e a legislação vigente."),
  comunicado: () => comDisc("Olá! Segue o resumo do mês: há tributos a pagar conforme as guias que enviaremos e algumas pendências de documentos. Próximos passos: nos envie o que falta para fecharmos a competência no prazo. Qualquer dúvida, estamos à disposição."),
  consultor: () => comDisc("Orientação geral: avalie o porte, a atividade e a projeção de faturamento antes de decidir. Cada regime tem obrigações e impactos diferentes. Recomendo simular os cenários e conferir a legislação vigente para a situação concreta da empresa."),
  fisco: () => comDisc("Ao órgão competente.\nAssunto: resposta à intimação/notificação nº [PREENCHER].\nA empresa vem, respeitosamente, apresentar os esclarecimentos solicitados, anexando os documentos pertinentes e colocando-se à disposição para eventuais diligências."),
};

// Mock do calendário: grava 3 prazos na agenda (datas relativas) e devolve saída.
function mockCalendario(empresaId) {
  const D = 86400000, n = Date.now();
  const d = (off) => new Date(n + off * D).toISOString().slice(0, 10);
  const obrig = [
    { sigla: "DAS", descricao: "Documento de Arrecadação do Simples Nacional", diaNominal: 20, dataFatal: d(8) },
    { sigla: "DCTFWeb", descricao: "Declaração de Débitos e Créditos Previdenciários", diaNominal: 15, dataFatal: d(3) },
    { sigla: "eSocial", descricao: "Eventos periódicos do eSocial", diaNominal: 15, dataFatal: d(3) },
  ];
  const gravados = obrig.map((o) => {
    const row = { id: novoId("prz"), empresaId, sigla: o.sigla, descricao: o.descricao, dataFatal: o.dataFatal, status: "pendente" };
    state.prazos.push(row);
    return row;
  });
  return { obrigacoes: obrig, prazosGravados: gravados,
    texto: comDisc("Obrigações da competência gravadas na agenda. Priorize as de vencimento mais próximo; as datas já estão ajustadas para dias úteis.") };
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (!url.pathname.startsWith("/api")) return serveStatic(req, res);
  if (req.method === "OPTIONS") { res.writeHead(204, CORS); return res.end(); }

  // Bearer auth fail-closed (igual ao router real — token ausente/vazio = 401).
  if ((req.headers.authorization ?? "") !== `Bearer ${TOKEN}`) return json(res, { error: "Unauthorized" }, 401);

  const path = url.pathname.replace(/^\/api/, "");
  const m = req.method;
  const reg = (s) => s.exec(path);

  // ── Empresas ──
  if (path === "/empresas" && m === "GET") return json(res, state.empresas);
  if (path === "/empresas" && m === "POST") {
    const b = await readBody(req);
    if (!b.razaoSocial || !b.regime) return json(res, { error: "Empresa inválida" }, 400);
    const row = { id: novoId("emp"), razaoSocial: b.razaoSocial, cnpj: b.cnpj, regime: b.regime, porte: b.porte, criadoEm: agora() };
    state.empresas.push(row);
    return json(res, row, 201);
  }
  const delEmp = reg(/^\/empresas\/([^/]+)$/);
  if (delEmp && m === "DELETE") {
    state.empresas = state.empresas.filter((e) => e.id !== delEmp[1]);
    return json(res, { ok: true });
  }

  // ── Competências ──
  if (path === "/competencias" && m === "GET") {
    const eid = url.searchParams.get("empresaId");
    return json(res, state.competencias.filter((c) => !eid || c.empresaId === eid));
  }
  if (path === "/competencias" && m === "POST") {
    const b = await readBody(req);
    const row = { id: novoId("comp"), empresaId: b.empresaId, ano: Number(b.ano), mes: Number(b.mes), status: b.status ?? "aberta", criadoEm: agora() };
    state.competencias.push(row);
    return json(res, row, 201);
  }

  // ── Prazos / agenda ──
  if (path === "/prazos" && m === "GET") {
    const eid = url.searchParams.get("empresaId");
    if (!eid) return json(res, { error: "empresaId obrigatório" }, 400);
    return json(res, state.prazos.filter((p) => p.empresaId === eid).sort((a, b) => a.dataFatal.localeCompare(b.dataFatal)));
  }
  if (path === "/prazos" && m === "POST") {
    const b = await readBody(req);
    if (!b.empresaId || !b.sigla || !b.descricao || !/^\d{4}-\d{2}-\d{2}$/.test(b.dataFatal || "")) return json(res, { error: "Prazo inválido" }, 400);
    const row = { id: novoId("prz"), empresaId: b.empresaId, sigla: b.sigla, descricao: b.descricao, dataFatal: b.dataFatal, status: "pendente" };
    state.prazos.push(row);
    return json(res, row, 201);
  }
  const prazoStatus = reg(/^\/prazos\/([^/]+)\/status$/);
  if (prazoStatus && m === "PUT") {
    const b = await readBody(req);
    if (b.status !== "pendente" && b.status !== "cumprido") return json(res, { error: "status inválido" }, 400);
    const row = state.prazos.find((p) => p.id === prazoStatus[1]);
    if (row) row.status = b.status;
    return json(res, { ok: true });
  }

  // ── Saídas ──
  if (path === "/saidas" && m === "GET") {
    const eid = url.searchParams.get("empresaId");
    const rows = eid ? state.saidas.filter((s) => s.empresaId === eid) : state.saidas;
    return json(res, [...rows].sort((a, b) => new Date(b.criadoEm) - new Date(a.criadoEm)));
  }

  // ── Agentes ──
  if (path === "/agentes/calendario" && m === "POST") {
    const b = await readBody(req);
    const r = mockCalendario(b.empresaId || "sem-empresa");
    state.saidas.push({ id: novoId("sai"), empresaId: b.empresaId, agente: "calendario", titulo: "Calendário de obrigações", conteudo: r.texto, criadoEm: agora() });
    return json(res, { titulo: "Calendário de obrigações", ...r }, 201);
  }
  const agMatch = reg(/^\/agentes\/(enquadramento|comunicado|consultor|fisco)$/);
  if (agMatch && m === "POST") {
    const tipo = agMatch[1];
    const b = await readBody(req);
    const titulos = { enquadramento: "Enquadramento preliminar de empresa", comunicado: "Comunicado ao cliente", consultor: "Orientação tributária", fisco: "Minuta de resposta ao Fisco" };
    const row = { id: novoId("sai"), empresaId: b.empresaId ?? null, agente: tipo, titulo: titulos[tipo], conteudo: MOCK_AGENTE[tipo](), criadoEm: agora() };
    state.saidas.push(row);
    return json(res, row, 201);
  }

  return json(res, { error: "Not Found" }, 404);
});

server.listen(PORT, () => {
  console.log(`\n  📊 DEMO local — Contabilidade ZX Control (painel populado, zero credencial)`);
  console.log(`  Painel:  http://localhost:${PORT}/`);
  console.log(`  Login:   qualquer e-mail/senha entram (modo demo)`);
  console.log(`  ${state.empresas.length} empresas · ${state.competencias.length} competências · ${state.prazos.length} prazos · ${state.saidas.length} saídas\n`);
});
