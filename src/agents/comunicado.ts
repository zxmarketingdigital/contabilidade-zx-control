// Agente 3 — Gerador de Comunicado ao Cliente (spec §5.3). Texto→texto.
// Input: situação do mês digitada pelo contador. Output: texto simples pro
// empresário (o que pagar, prazos, pendências, próximos passos), exportável.
import { z } from "zod";
import { comDisclaimer, gerarComFallback, PROIBICAO_VALOR_LEI, type LLM } from "./base";

export const comunicadoInputSchema = z.object({
  empresaId: z.string().min(1).optional(),
  empresaNome: z.string().min(1).optional(),
  situacao: z.string().min(10, "Descreva a situação do mês (valores a pagar, pendências...)"),
});
export type ComunicadoInput = z.infer<typeof comunicadoInputSchema>;

export interface ComunicadoResultado {
  titulo: string;
  conteudo: string;
}

export function montarPromptComunicado(input: ComunicadoInput): string {
  return [
    "Você redige um comunicado de um escritório de contabilidade para o EMPRESÁRIO cliente.",
    "Linguagem simples e cordial (o cliente não é contador). Estruture em: o que pagar,",
    "prazos, pendências e próximos passos. Não use jargão técnico desnecessário.",
    input.empresaNome ? `Empresa: ${input.empresaNome}.` : "",
    "",
    "Situação do mês (escrita pelo contador):",
    input.situacao,
    "",
    "Repita apenas os valores que o contador informou acima — não calcule nem invente novos.",
    PROIBICAO_VALOR_LEI,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function gerarComunicado(
  rawInput: unknown,
  deps: { llm: LLM },
): Promise<ComunicadoResultado> {
  const input = comunicadoInputSchema.parse(rawInput);
  const texto = await gerarComFallback(deps.llm, montarPromptComunicado(input));
  const alvo = input.empresaNome ? ` — ${input.empresaNome}` : "";
  return { titulo: `Comunicado ao cliente${alvo}`, conteudo: comDisclaimer(texto) };
}
