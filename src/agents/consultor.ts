// Agente 4 — Consultor Tributário / Tira-dúvidas (spec §5.4). Texto→texto.
// Input: pergunta do contador. Output: orientação genérica fundamentada, SEM
// afirmar valor/alíquota como definitivo e SEM citar artigo de lei específico.
import { z } from "zod";
import { comDisclaimer, gerarComFallback, PROIBICAO_VALOR_LEI, type LLM } from "./base";

export const consultorInputSchema = z.object({
  pergunta: z.string().min(5, "Escreva a dúvida tributária"),
});
export type ConsultorInput = z.infer<typeof consultorInputSchema>;

export interface ConsultorResultado {
  titulo: string;
  conteudo: string;
}

export function montarPromptConsultor(pergunta: string): string {
  return [
    "Você é um consultor tributário de apoio a contadores no Brasil.",
    "Responda à dúvida de forma fundamentada, porém GENÉRICA e conceitual.",
    "Explique o raciocínio e os pontos a verificar; termine sempre orientando a",
    "conferir a legislação vigente e a situação concreta da empresa.",
    "",
    "Pergunta do contador:",
    pergunta,
    "",
    PROIBICAO_VALOR_LEI,
  ].join("\n");
}

export async function gerarConsultoria(
  rawInput: unknown,
  deps: { llm: LLM },
): Promise<ConsultorResultado> {
  const input = consultorInputSchema.parse(rawInput);
  const texto = await gerarComFallback(deps.llm, montarPromptConsultor(input.pergunta));
  return { titulo: "Orientação tributária", conteudo: comDisclaimer(texto) };
}
