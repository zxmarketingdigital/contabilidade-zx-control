// ════════════════════════════════════════════════════════════════════════
// Roteador HTTP do Worker — lógica testável, deps injetáveis.
//
// AUTH FAIL-CLOSED no caminho de TODA rota /api (spec §4): cada handler chama
// requireUser ANTES de qualquer trabalho. Sem token válido → 401.
//
// src/index.ts liga as deps reais (Supabase + Gemini); os testes injetam fakes.
// ════════════════════════════════════════════════════════════════════════

import { requireUser, unauthorized, AuthError, type AuthEnv, type VerifyOverride } from "./auth";
import type { LLM } from "./agents/base";
import { gerarCalendario } from "./agents/calendario";
import { gerarEnquadramento } from "./agents/enquadramento";
import { gerarComunicado } from "./agents/comunicado";
import { gerarConsultoria } from "./agents/consultor";
import { gerarRespostaFisco } from "./agents/fisco";
import { prazoManualSchema, type AgendaRepo } from "./agenda";
import type { AgenteTipo, SaidasRepo } from "./saidas";
import {
  competenciaInputSchema,
  empresaInputSchema,
  type CompetenciasRepo,
  type EmpresasRepo,
} from "./entidades";

export interface AppDeps {
  agenda: AgendaRepo;
  saidas: SaidasRepo;
  empresas: EmpresasRepo;
  competencias: CompetenciasRepo;
  llm: LLM;
  /** override do verificador de auth (testes); produção usa o GoTrue do Supabase */
  verify?: VerifyOverride;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function lerJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return undefined;
  }
}

export async function handleRequest(req: Request, env: AuthEnv, deps: AppDeps): Promise<Response> {
  const url = new URL(req.url);
  const { pathname } = url;

  if (!pathname.startsWith("/api/")) return json({ error: "Not Found" }, 404);

  // ── Auth fail-closed: barra TODA rota /api antes de qualquer lógica ──
  try {
    await requireUser(req, env, { _verify: deps.verify });
  } catch (err) {
    if (err instanceof AuthError) return unauthorized();
    throw err;
  }

  // ── Agente 1: Calendário (calcula datas, grava na agenda, redige) ──
  if (pathname === "/api/agentes/calendario" && req.method === "POST") {
    const body = await lerJson(req);
    try {
      const r = await gerarCalendario(body, { agenda: deps.agenda, llm: deps.llm });
      const empresaId = (body as { empresaId?: string })?.empresaId;
      await deps.saidas.registrar({ empresaId, agente: "calendario", titulo: r.titulo, conteudo: r.texto });
      return json(r, 201);
    } catch {
      return json({ error: "Dados inválidos para o calendário" }, 400);
    }
  }

  // ── Agentes 2-5: texto→texto (mesmo formato {titulo, conteudo}) ──
  const textoAgentes: Record<string, { tipo: AgenteTipo; run: (b: unknown) => Promise<{ titulo: string; conteudo: string }> }> = {
    "/api/agentes/enquadramento": { tipo: "enquadramento", run: (b) => gerarEnquadramento(b, { llm: deps.llm }) },
    "/api/agentes/comunicado": { tipo: "comunicado", run: (b) => gerarComunicado(b, { llm: deps.llm }) },
    "/api/agentes/consultor": { tipo: "consultor", run: (b) => gerarConsultoria(b, { llm: deps.llm }) },
    "/api/agentes/fisco": { tipo: "fisco", run: (b) => gerarRespostaFisco(b, { llm: deps.llm }) },
  };
  const agente = textoAgentes[pathname];
  if (agente && req.method === "POST") {
    const body = await lerJson(req);
    try {
      const r = await agente.run(body);
      const empresaId = (body as { empresaId?: string })?.empresaId;
      const saida = await deps.saidas.registrar({ empresaId, agente: agente.tipo, titulo: r.titulo, conteudo: r.conteudo });
      return json(saida, 201);
    } catch {
      return json({ error: "Dados inválidos" }, 400);
    }
  }

  // ── CRUD Empresas-cliente (spec §6.1) ──
  if (pathname === "/api/empresas") {
    if (req.method === "GET") return json(await deps.empresas.listar());
    if (req.method === "POST") {
      const parsed = empresaInputSchema.safeParse(await lerJson(req));
      if (!parsed.success) return json({ error: "Empresa inválida" }, 400);
      return json(await deps.empresas.criar(parsed.data), 201);
    }
  }
  const empMatch = /^\/api\/empresas\/([^/]+)$/.exec(pathname);
  if (empMatch && req.method === "DELETE") {
    await deps.empresas.remover(empMatch[1]!);
    return json({ ok: true });
  }

  // ── CRUD Competências (spec §6.2) ──
  if (pathname === "/api/competencias") {
    if (req.method === "GET") {
      const empresaId = url.searchParams.get("empresaId") ?? undefined;
      return json(await deps.competencias.listar(empresaId));
    }
    if (req.method === "POST") {
      const parsed = competenciaInputSchema.safeParse(await lerJson(req));
      if (!parsed.success) return json({ error: "Competência inválida" }, 400);
      return json(await deps.competencias.criar(parsed.data), 201);
    }
  }

  // ── Agenda de prazos (lê o que o Agente 1 gravou; aceita entrada manual) ──
  if (pathname === "/api/prazos" && req.method === "GET") {
    const empresaId = url.searchParams.get("empresaId");
    if (!empresaId) return json({ error: "empresaId obrigatório" }, 400);
    return json(await deps.agenda.listarPrazos(empresaId));
  }
  if (pathname === "/api/prazos" && req.method === "POST") {
    const parsed = prazoManualSchema.safeParse(await lerJson(req));
    if (!parsed.success) return json({ error: "Prazo inválido" }, 400);
    const [row] = await deps.agenda.inserirPrazos([parsed.data]);
    return json(row, 201);
  }
  const prazoStatus = /^\/api\/prazos\/([^/]+)\/status$/.exec(pathname);
  if (prazoStatus && req.method === "PUT") {
    const body = (await lerJson(req)) as { status?: string };
    if (body?.status !== "pendente" && body?.status !== "cumprido") {
      return json({ error: "status inválido" }, 400);
    }
    await deps.agenda.atualizarStatus(prazoStatus[1]!, body.status);
    return json({ ok: true });
  }

  // ── Histórico de saídas dos agentes ──
  if (pathname === "/api/saidas" && req.method === "GET") {
    const empresaId = url.searchParams.get("empresaId") ?? undefined;
    return json(await deps.saidas.listar(empresaId));
  }

  return json({ error: "Not Found" }, 404);
}
