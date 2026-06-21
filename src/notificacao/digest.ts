// ════════════════════════════════════════════════════════════════════════
// Montagem do resumo diário de prazos (v1.1). Função PURA e testável: recebe
// os prazos + empresas + a data civil de hoje (BRT) e devolve o texto do
// WhatsApp — ou null quando não há nada a avisar (nesse caso o cron NÃO envia,
// para não mandar mensagem vazia e queimar a janela/rate-cap).
//
// Não loga nada (LGPD/sigilo fiscal): o conteúdo só vai para o WhatsApp do
// próprio escritório, nunca para console.
// ════════════════════════════════════════════════════════════════════════

import type { PrazoRow } from "../agenda";

export interface EmpresaResumo {
  id: string;
  razaoSocial: string;
  inativo?: boolean;
}

/** Data civil (YYYY-MM-DD) em America/Sao_Paulo — "hoje" do ponto de vista fiscal. */
export function isoDateBRT(now: Date): string {
  // en-CA formata como YYYY-MM-DD; timeZone garante o dia civil do Brasil.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function diasEntre(dataISO: string, hojeISO: string): number {
  const a = Date.parse(`${dataISO}T00:00:00Z`);
  const b = Date.parse(`${hojeISO}T00:00:00Z`);
  return Math.round((a - b) / 86_400_000);
}

const MAX_LINHAS = 30; // mensagem de WhatsApp não pode virar um romance

/**
 * Monta o resumo diário. Considera só prazos PENDENTES de empresas ATIVAS.
 * Retorna null se não houver vencidos nem prazos vencendo em ≤ alertaDias.
 */
export function montarResumoDiario(
  prazos: PrazoRow[],
  empresas: EmpresaResumo[],
  hojeISO: string,
  alertaDias: number,
): string | null {
  const nomeAtiva = new Map(empresas.filter((e) => !e.inativo).map((e) => [e.id, e.razaoSocial]));
  const pend = prazos.filter((p) => p.status === "pendente" && nomeAtiva.has(p.empresaId));
  const byData = (a: PrazoRow, b: PrazoRow) => a.dataFatal.localeCompare(b.dataFatal);
  const vencidos = pend.filter((p) => diasEntre(p.dataFatal, hojeISO) < 0).sort(byData);
  const proximos = pend
    .filter((p) => { const d = diasEntre(p.dataFatal, hojeISO); return d >= 0 && d <= alertaDias; })
    .sort(byData);

  if (!vencidos.length && !proximos.length) return null;

  const br = (iso: string) => iso.split("-").reverse().join("/");
  const linha = (p: PrazoRow) => `• ${nomeAtiva.get(p.empresaId)} — ${p.sigla} (${br(p.dataFatal)})`;
  const bloco = (titulo: string, itens: PrazoRow[]) => {
    const linhas = [titulo, ...itens.slice(0, MAX_LINHAS).map(linha)];
    if (itens.length > MAX_LINHAS) linhas.push(`…e mais ${itens.length - MAX_LINHAS}.`);
    return linhas;
  };

  const partes: string[] = [`📊 *Contabilidade ZX Control*`, `Resumo de ${br(hojeISO)}`, ""];
  if (vencidos.length) { partes.push(...bloco(`🔴 Vencidos (${vencidos.length}):`, vencidos), ""); }
  if (proximos.length) { partes.push(...bloco(`🟡 Vencem em até ${alertaDias} dias (${proximos.length}):`, proximos)); }
  partes.push("", "⚠ Confira na plataforma antes de agir.");
  return partes.join("\n").trim();
}
