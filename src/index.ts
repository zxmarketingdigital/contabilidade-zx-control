// ════════════════════════════════════════════════════════════════════════
// Entrypoint do Worker (Cloudflare). Liga as deps REAIS (Supabase + Gemini) e
// delega o roteamento para src/app.ts (testável). Auth fail-closed vive lá.
//
// v1 NÃO dispara mensagem (spec §7): o handler `scheduled` existe só porque há
// cron em wrangler.toml, mas é no-op reservado para a notificação de prazo (v1.1).
// ════════════════════════════════════════════════════════════════════════

import { handleRequest, type AppDeps } from "./app";
import { AgendaSupabase } from "./supabase-agenda";
import { SaidasSupabase } from "./saidas";
import { CompetenciasSupabase, EmpresasSupabase } from "./entidades";
import { LeadsSupabase } from "./crm";
import { ReceitasSupabase, CustosSupabase } from "./financeiro";
import { geminiFlash } from "./gemini/client";
import { createAdapter } from "./adapters/whatsapp";
import { DisparosSupabase } from "./notificacao/disparos-db";
import { enviarResumoDiario } from "./notificacao/run";
import { handleNotificacaoPull } from "./notificacao/pull";

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
    // Rotas /notificacao/* (poller local) — auth própria por token, ANTES do
    // roteador /api para não passar pelo (nem afetar o) gate JWT do Supabase.
    // Sem CORS de propósito: é consumo server-to-server (Node), não navegador.
    const pull = await handleNotificacaoPull(req, env);
    if (pull) return pull;
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

  // Notificação de prazo fiscal (v1.1). Cron de hora em hora (wrangler.toml); o
  // resumo sai 1x/dia quando a janela BRT abre (dedup por dia na engine anti-ban).
  // FAIL-SAFE: sem credenciais Evolution + número do contador, é no-op silencioso.
  async scheduled(_event: ScheduledController, env: Env): Promise<void> {
    if (!env.EVOLUTION_URL || !env.EVOLUTION_INSTANCE || !env.EVOLUTION_API_KEY || !env.CONTADOR_WHATSAPP) {
      return; // notificação não configurada → não dispara nada
    }
    const adapter = createAdapter({
      WHATSAPP_PROVIDER: env.WHATSAPP_PROVIDER ?? "evolution",
      EVOLUTION_URL: env.EVOLUTION_URL,
      EVOLUTION_INSTANCE: env.EVOLUTION_INSTANCE,
      EVOLUTION_API_KEY: env.EVOLUTION_API_KEY,
    });
    await enviarResumoDiario({
      agenda: new AgendaSupabase(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY),
      empresas: new EmpresasSupabase(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY),
      db: new DisparosSupabase(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY),
      adapter,
      numero: env.CONTADOR_WHATSAPP,
      delayMs: 1500, // jitter anti-ban entre envios (1 só por dia, mas mantém o contrato)
    });
  },
};
