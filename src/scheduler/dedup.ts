// ⚓ Sincronizado de zxmarketingdigital/contabilidade-zx-control (engine anti-ban) em 13/Jun/2026.
// Se a engine do Contabilidade evoluir, re-sincronizar esta casca e rodar os testes.
import type { DedupScope } from "./types";

// Semana ISO para dedup semanal de follow-up / reativador.
function isoWeek(d: Date): string {
  const thu = new Date(d);
  thu.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) + 3);
  const jan4 = new Date(Date.UTC(thu.getUTCFullYear(), 0, 4));
  const week = Math.ceil(((thu.getTime() - jan4.getTime()) / 86_400_000 + (jan4.getUTCDay() + 6) % 7 + 1) / 7);
  return `${thu.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

// Chave de dedup conforme a estratégia escolhida pelo agente do nicho.
export function gerarChave(
  clienteId: string,
  agente: string,
  now: Date,
  dedup: DedupScope,
): string {
  if (dedup.tipo === "entity") {
    // 1x por (cliente, agente, entidade) — sem janela temporal.
    return `${clienteId}:${agente}:${dedup.entityId}`;
  }
  if (dedup.tipo === "month") {
    const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
    // inclui o toque: D+3 (1) e D+30 (2) não podem colidir no mesmo mês civil.
    return `${clienteId}:${agente}:${dedup.toque ?? 1}:${month}`;
  }
  return `${clienteId}:${agente}:${isoWeek(now)}`;
}
