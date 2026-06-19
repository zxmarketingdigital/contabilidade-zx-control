// Agente 2 — Triagem / Enquadramento de Empresa (spec §5.2). Texto→texto.
// Input: dados da empresa em texto livre. Output: ficha + regime sugerido +
// obrigações + documentos a pedir + parecer preliminar (com ressalva).
import { z } from "zod";
import { comDisclaimer, gerarComFallback, PROIBICAO_VALOR_LEI, type LLM } from "./base";

export const enquadramentoInputSchema = z.object({
  empresaId: z.string().min(1).optional(),
  dados: z.string().min(10, "Descreva a empresa (atividade, faturamento, sócios...)"),
});
export type EnquadramentoInput = z.infer<typeof enquadramentoInputSchema>;

export interface EnquadramentoResultado {
  titulo: string;
  conteudo: string; // SEMPRE com disclaimer
}

export function montarPromptEnquadramento(dados: string): string {
  return [
    "Você é um assistente de enquadramento tributário de um escritório contábil brasileiro.",
    "A partir dos dados da empresa abaixo, produza, em português e em seções claras:",
    "1) FICHA DA EMPRESA (resumo dos dados).",
    "2) REGIME SUGERIDO (Simples Nacional, Lucro Presumido ou Lucro Real) com justificativa qualitativa.",
    "3) OBRIGAÇÕES aplicáveis ao regime sugerido.",
    "4) DOCUMENTOS A SOLICITAR ao cliente.",
    "5) PARECER PRELIMINAR, deixando claro que é preliminar e depende de conferência.",
    "",
    "Dados da empresa:",
    dados,
    "",
    PROIBICAO_VALOR_LEI,
  ].join("\n");
}

export async function gerarEnquadramento(
  rawInput: unknown,
  deps: { llm: LLM },
): Promise<EnquadramentoResultado> {
  const input = enquadramentoInputSchema.parse(rawInput);
  const texto = await gerarComFallback(deps.llm, montarPromptEnquadramento(input.dados));
  return { titulo: "Enquadramento preliminar de empresa", conteudo: comDisclaimer(texto) };
}
