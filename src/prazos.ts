// ════════════════════════════════════════════════════════════════════════
// Cálculo de prazos fiscais em DIAS ÚTEIS (spec §7.3) — função pura, testada.
//
// Regra da linha: data fatal em America/Sao_Paulo, considerando feriados
// nacionais (fixos + móveis) e ANTECIPAÇÃO de vencimento — quando o dia nominal
// cai em fim de semana/feriado, o vencimento ANTECIPA para o dia útil anterior.
//
// Timezone sem dependência externa: trabalhamos com a DATA CIVIL ({ano,mes,dia})
// e usamos Date.UTC apenas para aritmética de calendário e dia-da-semana. UTC não
// tem horário de verão e o getUTCDay da meia-noite UTC é o mesmo dia-da-semana da
// data civil — então o resultado é a data civil de São Paulo, nunca deslocada
// pelo fuso do servidor. Jamais convertemos para horário local.
// ════════════════════════════════════════════════════════════════════════

import { FERIADOS_FIXOS, OBRIGACOES_POR_REGIME, type Regime } from "./config";

export interface DataCivil {
  ano: number;
  mes: number; // 1-12
  dia: number; // 1-31
}

export interface Competencia {
  ano: number;
  mes: number; // 1-12
}

const DIA_MS = 86_400_000;

function toEpoch(c: DataCivil): number {
  return Date.UTC(c.ano, c.mes - 1, c.dia);
}

function fromEpoch(ms: number): DataCivil {
  const d = new Date(ms);
  return { ano: d.getUTCFullYear(), mes: d.getUTCMonth() + 1, dia: d.getUTCDate() };
}

/** ISO YYYY-MM-DD (data civil, sem hora) — formato gravado na agenda. */
export function toISO(c: DataCivil): string {
  const mm = String(c.mes).padStart(2, "0");
  const dd = String(c.dia).padStart(2, "0");
  return `${c.ano}-${mm}-${dd}`;
}

/** 0 = domingo … 6 = sábado, na data civil. */
export function diaSemana(c: DataCivil): number {
  return new Date(toEpoch(c)).getUTCDay();
}

export function somaDias(c: DataCivil, n: number): DataCivil {
  return fromEpoch(toEpoch(c) + n * DIA_MS);
}

/**
 * Domingo de Páscoa do ano (algoritmo de Meeus/Jones/Butcher) — base dos
 * feriados móveis com banco fechado (Carnaval, Sexta-feira Santa, Corpus Christi).
 */
export function pascoa(ano: number): DataCivil {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return { ano, mes, dia };
}

/** Feriados móveis com banco fechado (não úteis para vencimento fiscal). */
function feriadosMoveis(ano: number): DataCivil[] {
  const p = pascoa(ano);
  return [
    somaDias(p, -48), // Carnaval (segunda)
    somaDias(p, -47), // Carnaval (terça)
    somaDias(p, -2), // Sexta-feira Santa
    somaDias(p, 60), // Corpus Christi
  ];
}

export function isFeriado(c: DataCivil): boolean {
  if (FERIADOS_FIXOS.some((f) => f.mes === c.mes && f.dia === c.dia)) return true;
  return feriadosMoveis(c.ano).some((m) => m.mes === c.mes && m.dia === c.dia);
}

export function isFimDeSemana(c: DataCivil): boolean {
  const w = diaSemana(c);
  return w === 0 || w === 6;
}

export function isDiaUtil(c: DataCivil): boolean {
  return !isFimDeSemana(c) && !isFeriado(c);
}

/**
 * ANTECIPAÇÃO: retorna o dia útil ≤ data. Se a data já é dia útil, devolve ela;
 * senão recua até o primeiro dia útil anterior.
 */
export function antecipaParaDiaUtil(c: DataCivil): DataCivil {
  let cur = c;
  while (!isDiaUtil(cur)) cur = somaDias(cur, -1);
  return cur;
}

export interface ObrigacaoCalculada {
  sigla: string;
  descricao: string;
  /** dia nominal de vencimento antes da antecipação (referência) */
  diaNominal: number;
  /** data fatal em dias úteis (ISO YYYY-MM-DD) */
  dataFatal: string;
}

/**
 * Data fatal de uma obrigação para uma competência, já antecipada para dia útil.
 * O mês de vencimento é competência + mesOffset; o dia é o nominal da obrigação.
 */
export function dataFatalObrigacao(
  competencia: Competencia,
  base: { diaVenc: number; mesOffset: number },
): DataCivil {
  // Date.UTC normaliza meses fora de 1-12 (ex.: dez + offset 2).
  const venc = fromEpoch(Date.UTC(competencia.ano, competencia.mes - 1 + base.mesOffset, base.diaVenc));
  return antecipaParaDiaUtil(venc);
}

/**
 * Calendário determinístico de obrigações de um regime numa competência.
 * NÃO usa IA: datas e siglas vêm do catálogo (config). Ordenado por data fatal.
 */
export function calendarioObrigacoes(
  regime: Regime,
  competencia: Competencia,
): ObrigacaoCalculada[] {
  return OBRIGACOES_POR_REGIME[regime]
    .map((o) => ({
      sigla: o.sigla,
      descricao: o.descricao,
      diaNominal: o.diaVenc,
      dataFatal: toISO(dataFatalObrigacao(competencia, o)),
    }))
    .sort((a, b) => a.dataFatal.localeCompare(b.dataFatal));
}
