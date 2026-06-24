// ════════════════════════════════════════════════════════════════════════
// Entrypoint do Worker (Cloudflare). Liga as deps REAIS (Supabase + Gemini) e
// delega o roteamento para src/app.ts (testável). Auth fail-closed vive lá.
//
// v1 NÃO dispara mensagem (spec §7): a notificação de prazo fiscal (PUSH por cron
// + rotas PULL /notificacao/*) é v1.1. Os módulos vivem em src/notificacao/* e a
// engine anti-ban em src/scheduler + src/adapters/whatsapp — CONGELADOS e testados,
// mas NÃO wired neste entrypoint na v1. O `scheduled` é um no-op (sem cron também).
// Para ativar v1.1: religar os imports/rotas abaixo + o cron em wrangler.toml.
// ════════════════════════════════════════════════════════════════════════

import { handleRequest, type AppDeps } from "./app";
import { AgendaSupabase } from "./supabase-agenda";
import { SaidasSupabase } from "./saidas";
import { CompetenciasSupabase, EmpresasSupabase } from "./entidades";
import { LeadsSupabase } from "./crm";
import { ReceitasSupabase, CustosSupabase } from "./financeiro";
import { geminiFlash } from "./gemini/client";

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
  GEMINI_API_KEY: string;
  // Notificação de prazo (v1.1) — OPCIONAL. Sem estes, o cron de PUSH é no-op.
  WHATSAPP_PROVIDER?: string;
  EVOLUTION_URL?: string;
  EVOLUTION_INSTANCE?: string;
  EVOLUTION_API_KEY?: string;
  CONTADOR_WHATSAPP?: string; // destino do resumo diário (só dígitos, com DDI)
  // Modelo PULL (poller local): token dedicado do endpoint /notificacao/*.
  NOTIF_PULL_TOKEN?: string;
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function withCors(res: Response): Response {
  const next = new Response(res.body, res);
  Object.entries(CORS).forEach(([k, v]) => next.headers.set(k, v));
  return next;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    // v1.1: aqui entram as rotas PULL /notificacao/* (handleNotificacaoPull de
    // ./notificacao/pull), com auth própria por token, ANTES do roteador /api.
    // Na v1 NÃO são wired — o produto não notifica (spec §7).
    const deps: AppDeps = {
      agenda: new AgendaSupabase(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY),
      saidas: new SaidasSupabase(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY),
      empresas: new EmpresasSupabase(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY),
      competencias: new CompetenciasSupabase(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY),
      leads: new LeadsSupabase(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY),
      receitas: new ReceitasSupabase(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY),
      custos: new CustosSupabase(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY),
      llm: (prompt) => geminiFlash(prompt, { GEMINI_API_KEY: env.GEMINI_API_KEY }),
    };
    return withCors(await handleRequest(req, env, deps));
  },

  // v1 NÃO dispara mensagem (spec §7): no-op. Sem cron em wrangler.toml, este
  // handler nem é invocado — fica como stub explícito. A notificação de prazo
  // fiscal (resumo diário via engine anti-ban) é v1.1: religar o corpo a partir
  // de ./notificacao/run (enviarResumoDiario) + createAdapter + o cron.
  async scheduled(_event: ScheduledController, _env: Env): Promise<void> {
    return; // reservado v1.1 — a v1 não notifica
  },
};
