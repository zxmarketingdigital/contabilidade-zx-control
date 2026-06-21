// ════════════════════════════════════════════════════════════════════════
// Orquestrador da notificação de prazo (v1.1). Junta os dados (agenda+empresas),
// monta o resumo e ENVIA exclusivamente através da engine anti-ban congelada
// (dispatch) — que aplica janela BRT, rate-cap global, dedup/idempotência,
// opt-out e delay/jitter. Este arquivo NÃO reimplementa nada disso.
//
// Dedup por DIA: usamos a estratégia `entity` com entityId = data civil BRT.
// Assim, com o cron de hora em hora, só o 1º disparo do dia (quando a janela
// abre) passa; os demais batem em existeDisparo e são bloqueados.
// ════════════════════════════════════════════════════════════════════════

import { dispatch } from "../scheduler/scheduler";
import { gerarChave } from "../scheduler/dedup";
import type { AdapterLike, DbLike } from "../scheduler/types";
import { NOTIFICACAO, PRAZO_ALERTA_DIAS } from "../config";
import { isoDateBRT, montarResumoDiario, type EmpresaResumo } from "./digest";
import { CaptureAdapter } from "./capture-adapter";
import type { PrazoRow } from "../agenda";

const CLIENTE_LINHA = "escritorio"; // 1 instalação = 1 linha emissora

export interface ResumoDeps {
  agenda: { listarTodos(): Promise<PrazoRow[]> };
  empresas: { listar(): Promise<EmpresaResumo[]> };
  db: DbLike;
  adapter: AdapterLike;
  numero: string; // WhatsApp do contador/escritório
  now?: Date;
  delayMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

export async function enviarResumoDiario(deps: ResumoDeps): Promise<"enviado" | "bloqueado" | "vazio"> {
  const now = deps.now ?? new Date();
  const [prazos, empresas] = await Promise.all([deps.agenda.listarTodos(), deps.empresas.listar()]);
  const hojeISO = isoDateBRT(now);
  const mensagem = montarResumoDiario(prazos, empresas, hojeISO, PRAZO_ALERTA_DIAS);
  if (!mensagem) return "vazio"; // nada vencido/vencendo → não envia

  return dispatch(deps.db, deps.adapter, {
    clienteId: CLIENTE_LINHA,
    numero: deps.numero,
    agente: NOTIFICACAO.agente,
    dedup: { tipo: "entity", entityId: hojeISO }, // 1 resumo por dia civil BRT
    mensagem,
    window: NOTIFICACAO.janela,
    rateCap: NOTIFICACAO.rateCap,
    now,
    delayMs: deps.delayMs,
    sleep: deps.sleep,
  });
}

// ── Modelo PULL: decisão (read-only) + confirmação separadas ──────────────
// O poller LOCAL é quem entrega. Para não perder o resumo do dia se a entrega
// falhar, a DECISÃO não persiste nada: roda os checks anti-ban (janela/dedup/
// rate-cap) pela engine com um db read-only, e só devolve o texto + a chave.
// O registro de "enviado" só acontece no confirmar(), APÓS o envio dar certo —
// assim uma falha de entrega é re-tentada no próximo ciclo, sem perda silenciosa.

export interface DecisaoResumo {
  enviar: boolean;
  texto?: string;
  chave?: string;
  motivo?: "vazio" | "bloqueado";
}

/** Decide se há resumo a enviar AGORA, sem persistir nada (idempotente/seguro). */
export async function decidirResumoDiario(deps: {
  agenda: { listarTodos(): Promise<PrazoRow[]> };
  empresas: { listar(): Promise<EmpresaResumo[]> };
  db: DbLike;
  now?: Date;
}): Promise<DecisaoResumo> {
  const now = deps.now ?? new Date();
  const [prazos, empresas] = await Promise.all([deps.agenda.listarTodos(), deps.empresas.listar()]);
  const hojeISO = isoDateBRT(now);
  const mensagem = montarResumoDiario(prazos, empresas, hojeISO, PRAZO_ALERTA_DIAS);
  if (!mensagem) return { enviar: false, motivo: "vazio" };

  const dedup = { tipo: "entity", entityId: hojeISO } as const;
  const chave = gerarChave(CLIENTE_LINHA, NOTIFICACAO.agente, now, dedup);
  // db read-only: os checks da engine rodam, mas a decisão NÃO grava disparo.
  const readOnly: DbLike = {
    existeDisparo: (c, a, k) => deps.db.existeDisparo(c, a, k),
    contarEnviosHora: (d) => deps.db.contarEnviosHora(d),
    contarEnviosDia: (d) => deps.db.contarEnviosDia(d),
    clienteOptOut: (c) => deps.db.clienteOptOut(c),
    registrarDisparo: async () => {},
  };
  const r = await dispatch(readOnly, new CaptureAdapter(), {
    clienteId: CLIENTE_LINHA,
    numero: CLIENTE_LINHA,
    agente: NOTIFICACAO.agente,
    dedup,
    mensagem,
    window: NOTIFICACAO.janela,
    rateCap: NOTIFICACAO.rateCap,
    now,
  });
  return r === "enviado" ? { enviar: true, texto: mensagem, chave } : { enviar: false, motivo: "bloqueado" };
}

/** Registra o envio confirmado pelo poller (idempotente via índice único). */
export async function confirmarResumo(db: DbLike, chave: string): Promise<void> {
  await db.registrarDisparo({
    clienteId: CLIENTE_LINHA,
    numero: CLIENTE_LINHA,
    agente: NOTIFICACAO.agente,
    chave,
    status: "enviado",
  });
}
