// ════════════════════════════════════════════════════════════════════════
// Base compartilhada dos 5 agentes (spec §7). Tudo que TODO agente precisa
// repetir mora aqui — "um valor, um lugar" também vale para texto de invariante.
// ════════════════════════════════════════════════════════════════════════

import { DISCLAIMER } from "../config";

/** Função de IA injetável (default: wrapper Gemini congelado). */
export type LLM = (prompt: string) => Promise<string>;

/**
 * Bloco de PROIBIÇÃO embutido em TODO prompt de agente (spec §7.2): a IA não
 * pode afirmar valor/alíquota nem citar nº de norma/artigo. Fonte única — um
 * teste por agente garante que está presente.
 */
export const PROIBICAO_VALOR_LEI = [
  "REGRAS OBRIGATÓRIAS (não viole em hipótese alguma):",
  "- NÃO afirme valores de imposto, alíquotas, bases de cálculo ou multas em reais.",
  "- NÃO cite número de artigo, lei, decreto ou norma específica; remeta sempre à 'legislação vigente'.",
  "- Oriente de forma genérica; o cálculo e a conferência oficial são do contador responsável.",
].join("\n");

/** Garante o disclaimer no fim do texto (idempotente — não duplica). */
export function comDisclaimer(texto: string): string {
  const t = (texto ?? "").trimEnd();
  if (t.includes(DISCLAIMER)) return t;
  return `${t}\n\n${DISCLAIMER}`;
}

/** Texto padrão quando a IA falha — a saída ainda sai com disclaimer. */
export const IA_INDISPONIVEL =
  "Não foi possível gerar o texto automático agora. Tente novamente em instantes.";

/**
 * Executa um prompt no LLM com fallback seguro. Nunca lança: se a IA falha,
 * devolve IA_INDISPONIVEL (o chamador embute o disclaimer mesmo assim).
 */
export async function gerarComFallback(llm: LLM, prompt: string): Promise<string> {
  try {
    const out = await llm(prompt);
    return out && out.trim() ? out : IA_INDISPONIVEL;
  } catch {
    return IA_INDISPONIVEL;
  }
}
