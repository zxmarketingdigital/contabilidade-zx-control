// ════════════════════════════════════════════════════════════════════════
// Endpoints PULL da notificação de prazo (modelo poller local). A máquina do
// escritório pergunta "tem resumo pra mandar agora?"; o Worker DECIDE (read-only,
// via engine anti-ban: janela BRT + dedup diário + rate-cap) e devolve o texto +
// a chave do dia. A máquina envia pela Evolution LOCAL e, só se der certo, CONFIRMA
// — aí sim o disparo é registrado (dedup passa a bloquear o resto do dia). Assim a
// nuvem nunca alcança o PC, nada é exposto, e uma falha de envio é re-tentada.
//
// AUTENTICAÇÃO: token dedicado NOTIF_PULL_TOKEN (Bearer), fail-closed, comparado
// em tempo constante. FICA FORA do prefixo /api de propósito — para NÃO tocar no
// gate JWT do Supabase que protege /api (invariante CRÍTICO da linha).
// ════════════════════════════════════════════════════════════════════════

import { AgendaSupabase } from "../supabase-agenda";
import { EmpresasSupabase } from "../entidades";
import { DisparosSupabase } from "./disparos-db";
import { decidirResumoDiario, confirmarResumo } from "./run";
import type { DbLike } from "../scheduler/types";
import type { PrazoRow } from "../agenda";
import type { EmpresaResumo } from "./digest";

export interface PullEnv {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
  NOTIF_PULL_TOKEN?: string;
}

/** Deps de dados injetáveis (testes passam fakes; prod constrói do Supabase). */
export interface PullDataDeps {
  agenda: { listarTodos(): Promise<PrazoRow[]> };
  empresas: { listar(): Promise<EmpresaResumo[]> };
  db: DbLike;
  now?: Date;
}

const json = (data: unknown, status = 200): Response =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

/** Compara dois segredos em tempo constante (HMAC com chave efêmera por request,
 *  digests de tamanho fixo — não vaza comprimento nem por short-circuit). */
async function tokensIguais(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const raw = crypto.getRandomValues(new Uint8Array(32));
  const key = await crypto.subtle.importKey("raw", raw, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const [ha, hb] = await Promise.all([
    crypto.subtle.sign("HMAC", key, enc.encode(a)),
    crypto.subtle.sign("HMAC", key, enc.encode(b)),
  ]);
  const da = new Uint8Array(ha), db = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < da.length; i++) diff |= da[i]! ^ db[i]!;
  return diff === 0;
}

/**
 * Trata as rotas /notificacao/*. Retorna null se a rota não for desta área
 * (o Worker segue para o roteador /api normal). Fail-closed: sem token
 * configurado → 401; token diferente → 401.
 */
export async function handleNotificacaoPull(
  req: Request,
  env: PullEnv,
  override?: PullDataDeps,
): Promise<Response | null> {
  const url = new URL(req.url);
  if (!url.pathname.startsWith("/notificacao/")) return null;

  // ── Auth fail-closed (token dedicado, não é o JWT do painel) ──
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!env.NOTIF_PULL_TOKEN || !(await tokensIguais(token, env.NOTIF_PULL_TOKEN))) {
    return json({ error: "unauthorized" }, 401);
  }

  const data: PullDataDeps =
    override ?? {
      agenda: new AgendaSupabase(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY),
      empresas: new EmpresasSupabase(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY),
      db: new DisparosSupabase(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY),
    };

  // GET /notificacao/pendente — DECIDE (não persiste).
  if (url.pathname === "/notificacao/pendente" && req.method === "GET") {
    const d = await decidirResumoDiario({ agenda: data.agenda, empresas: data.empresas, db: data.db, now: data.now });
    return d.enviar ? json({ enviar: true, texto: d.texto, chave: d.chave }) : json({ enviar: false, motivo: d.motivo });
  }

  // POST /notificacao/confirmado — registra o envio que o poller já fez.
  if (url.pathname === "/notificacao/confirmado" && req.method === "POST") {
    const body = (await req.json().catch(() => ({}))) as { chave?: string };
    if (!body.chave) return json({ error: "chave obrigatória" }, 400);
    await confirmarResumo(data.db, body.chave);
    return json({ ok: true });
  }

  return json({ error: "not found" }, 404);
}
