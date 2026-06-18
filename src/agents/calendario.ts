// ════════════════════════════════════════════════════════════════════════
// Agente 1 — Calendário de Obrigações Fiscais (spec §5.1). Texto→texto.
//
// Fluxo: regime + competência → obrigações aplicáveis com DATA FATAL em dias
// úteis (determinístico, src/prazos.ts) → grava na agenda (tabela `prazos`) →
// orientação em linguagem natural pelo Gemini → saída com DISCLAIMER embutido.
//
// Invariantes (spec §7):
//  · As DATAS são determinísticas (catálogo + cálculo puro). A IA NÃO inventa
//    obrigação nem vencimento — só redige a orientação.
//  · O prompt PROÍBE afirmar valor/alíquota e citar nº de norma/artigo (§7.2).
//  · O DISCLAIMER é sempre embutido na saída, independentemente do que a IA
//    devolver (§7.1) — testado, falha se removido.
//  · LGPD: nada de dado de empresa em log (§7.4) — este módulo não loga.
// ════════════════════════════════════════════════════════════════════════

import { z } from "zod";
import { DISCLAIMER, REGIME_LABEL, REGIMES } from "../config";
import { calendarioObrigacoes, type ObrigacaoCalculada } from "../prazos";
import type { AgendaRepo, PrazoRow } from "../agenda";

export const calendarioInputSchema = z.object({
  empresaId: z.string().min(1),
  regime: z.enum(REGIMES),
  competencia: z.object({
    ano: z.number().int().min(2000).max(2100),
    mes: z.number().int().min(1).max(12),
  }),
});
export type CalendarioInput = z.infer<typeof calendarioInputSchema>;

export interface CalendarioResultado {
  titulo: string;
  obrigacoes: ObrigacaoCalculada[];
  prazosGravados: PrazoRow[];
  /** texto final exibido/exportado — SEMPRE contém o disclaimer */
  texto: string;
}

/** Função de IA injetável (default: wrapper Gemini congelado). Facilita teste. */
export type LLM = (prompt: string) => Promise<string>;

/**
 * Monta o prompt da orientação. Exposto para teste do invariante "não afirma
 * valor/lei": o texto de proibição TEM que estar aqui.
 */
export function montarPromptCalendario(
  input: CalendarioInput,
  obrigacoes: ObrigacaoCalculada[],
): string {
  const lista = obrigacoes.map((o) => `- ${o.sigla} (${o.descricao}) — vence ${o.dataFatal}`).join("\n");
  return [
    "Você é um assistente de um escritório de contabilidade brasileiro.",
    `Regime: ${REGIME_LABEL[input.regime]}. Competência: ${input.competencia.mes}/${input.competencia.ano}.`,
    "Obrigações já apuradas (datas e siglas FIXAS, não altere nem invente outras):",
    lista,
    "",
    "Escreva uma orientação curta e clara para o contador organizar o mês.",
    "REGRAS OBRIGATÓRIAS:",
    "- NÃO afirme valores de imposto, alíquotas ou bases de cálculo.",
    "- NÃO cite número de artigo, lei ou norma específica; remeta à 'legislação vigente'.",
    "- Não invente obrigações além das listadas. Linguagem objetiva, em português.",
  ].join("\n");
}

/** Garante o disclaimer no fim do texto (idempotente — não duplica). */
export function comDisclaimer(texto: string): string {
  const t = texto.trimEnd();
  if (t.includes(DISCLAIMER)) return t;
  return `${t}\n\n${DISCLAIMER}`;
}

/**
 * Executa o Agente 1. Calcula obrigações, grava na agenda e devolve a saída com
 * orientação da IA + disclaimer. `deps.llm` injetável para teste.
 */
export async function gerarCalendario(
  rawInput: unknown,
  deps: { agenda: AgendaRepo; llm: LLM },
): Promise<CalendarioResultado> {
  const input = calendarioInputSchema.parse(rawInput);

  // 1. Datas determinísticas (sem IA).
  const obrigacoes = calendarioObrigacoes(input.regime, input.competencia);

  // 2. Grava na agenda (mesmo campo data_fatal que o painel lê).
  const prazosGravados = obrigacoes.length
    ? await deps.agenda.inserirPrazos(
        obrigacoes.map((o) => ({
          empresaId: input.empresaId,
          sigla: o.sigla,
          descricao: o.descricao,
          dataFatal: o.dataFatal,
        })),
      )
    : [];

  // 3. Orientação em linguagem natural (IA só redige).
  let orientacao = "";
  try {
    orientacao = await deps.llm(montarPromptCalendario(input, obrigacoes));
  } catch {
    // Falha da IA não derruba o calendário: as datas (o que importa) já estão gravadas.
    orientacao = "Não foi possível gerar a orientação automática agora. Confira as obrigações acima.";
  }

  const titulo = `Calendário ${REGIME_LABEL[input.regime]} — ${String(input.competencia.mes).padStart(2, "0")}/${input.competencia.ano}`;
  return {
    titulo,
    obrigacoes,
    prazosGravados,
    texto: comDisclaimer(orientacao),
  };
}
