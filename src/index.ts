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
import { geminiFlash } from "./gemini/client";

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
  GEMINI_API_KEY: string;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const deps: AppDeps = {
      agenda: new AgendaSupabase(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY),
      saidas: new SaidasSupabase(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY),
      empresas: new EmpresasSupabase(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY),
      competencias: new CompetenciasSupabase(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY),
      llm: (prompt) => geminiFlash(prompt, { GEMINI_API_KEY: env.GEMINI_API_KEY }),
    };
    return handleRequest(req, env, deps);
  },

  // Reservado v1.1 (notificação de prazo fiscal). v1 não dispara nada.
  async scheduled(): Promise<void> {
    return;
  },
};
