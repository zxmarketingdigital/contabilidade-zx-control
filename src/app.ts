// ════════════════════════════════════════════════════════════════════════
// Roteador HTTP do Worker — lógica testável, deps injetáveis.
//
// AUTH FAIL-CLOSED no caminho de TODA rota /api (spec §4): cada handler chama
// requireUser ANTES de qualquer trabalho. Sem token válido → 401.
//
// src/index.ts liga as deps reais (Supabase + Gemini); os testes injetam fakes.
// ════════════════════════════════════════════════════════════════════════

import { requireUser, unauthorized, AuthError, type AuthEnv, type VerifyOverride } from "./auth";
import { gerarCalendario, type LLM } from "./agents/calendario";
import type { AgendaRepo } from "./agenda";

export interface AppDeps {
  agenda: AgendaRepo;
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

  // POST /api/agentes/calendario — Agente 1: calcula, grava na agenda, redige.
  if (pathname === "/api/agentes/calendario" && req.method === "POST") {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return json({ error: "JSON inválido" }, 400);
    }
    try {
      const resultado = await gerarCalendario(body, { agenda: deps.agenda, llm: deps.llm });
      return json(resultado, 201);
    } catch (err) {
      // erro de validação (zod) → 400; não vaza dado de empresa em log (LGPD)
      return json({ error: "Dados inválidos para o calendário", detalhe: (err as Error).name }, 400);
    }
  }

  // GET /api/prazos?empresaId= — agenda de prazos (lê o que o Agente 1 gravou).
  if (pathname === "/api/prazos" && req.method === "GET") {
    const empresaId = url.searchParams.get("empresaId");
    if (!empresaId) return json({ error: "empresaId obrigatório" }, 400);
    const prazos = await deps.agenda.listarPrazos(empresaId);
    return json(prazos);
  }

  return json({ error: "Not Found" }, 404);
}
