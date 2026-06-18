// ⚓ Sincronizado de zxmarketingdigital/contabilidade-zx-control (engine anti-ban) em 13/Jun/2026.
// Se a engine do Contabilidade evoluir, re-sincronizar esta casca e rodar os testes.
// CASCA CATÁLOGO (congelada) — ÚNICO ponto de saída proativa do sistema.
// TODA mensagem proativa (qualquer agente/cron do nicho) DEVE passar por aqui.
// Invariantes anti-ban/anti-spam testadas (foi onde o Contabilidade teve 4 bugs CRITICAL no PR#2):
//   (a) dedup por estratégia, (b) janela inf+sup BRT, (c) idempotência por entidade,
//   (d) rate-cap GLOBAL da instância emissora, (e) opt-out "SAIR", + delay/jitter.
import { gerarChave } from "./dedup";
import type { AdapterLike, DbLike, DispatchOptions } from "./types";

const RATE_CAP_HORA_DEFAULT = 20;
const RATE_CAP_DIA_DEFAULT = 80;

// Janela de disparo é em horário do Brasil (America/Sao_Paulo). Usamos Intl pra
// ser robusto a fuso/DST, em vez de assumir UTC.
function horaSaoPaulo(now: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(now);
  return parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10) % 24;
}

export async function dispatch(
  db: DbLike,
  adapter: AdapterLike,
  opts: DispatchOptions,
): Promise<"enviado" | "bloqueado"> {
  const now = opts.now ?? new Date();
  const hora = horaSaoPaulo(now);
  const capHora = opts.rateCap?.hora ?? RATE_CAP_HORA_DEFAULT;
  const capDia = opts.rateCap?.dia ?? RATE_CAP_DIA_DEFAULT;

  // (e) opt-out
  if (await db.clienteOptOut(opts.clienteId)) return "bloqueado";

  // (b) janela inferior+superior
  if (hora < opts.window.start || hora >= opts.window.end) return "bloqueado";

  // (d) rate-cap GLOBAL da instância (protege a linha emissora, não o destinatário)
  const h1ago = new Date(now.getTime() - 3_600_000);
  const d1ago = new Date(now.getTime() - 86_400_000);
  const [enviosHora, enviosDia] = await Promise.all([
    db.contarEnviosHora(h1ago),
    db.contarEnviosDia(d1ago),
  ]);
  if (enviosHora >= capHora || enviosDia >= capDia) return "bloqueado";

  // (a) dedup + (c) idempotência por entidade
  const chave = gerarChave(opts.clienteId, opts.agente, now, opts.dedup);
  if (await db.existeDisparo(opts.clienteId, opts.agente, chave)) return "bloqueado";

  // Passa todos os checks → envia
  await adapter.send(opts.numero, opts.mensagem);
  await db.registrarDisparo({
    clienteId: opts.clienteId,
    numero: opts.numero,
    agente: opts.agente,
    chave,
    status: "enviado",
  });
  // anti-ban: espaça o próximo envio (jitter injetado pelo Worker; no-op em testes)
  if (opts.delayMs && opts.delayMs > 0) {
    await (opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms))))(opts.delayMs);
  }
  return "enviado";
}
