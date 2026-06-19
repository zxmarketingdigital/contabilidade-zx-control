// Agente 5 — Redator de Respostas ao Fisco (spec §5.5). Texto→texto.
// Input: intimação/notificação COLADA como texto (sem upload). Output: minuta de
// resposta/defesa estruturada, exportável, com disclaimer.
import { z } from "zod";
import { comDisclaimer, gerarComFallback, PROIBICAO_VALOR_LEI, type LLM } from "./base";

export const fiscoInputSchema = z.object({
  empresaId: z.string().min(1).optional(),
  intimacao: z.string().min(20, "Cole o texto da intimação/notificação"),
  observacoes: z.string().optional(),
});
export type FiscoInput = z.infer<typeof fiscoInputSchema>;

export interface FiscoResultado {
  titulo: string;
  conteudo: string;
}

export function montarPromptFisco(input: FiscoInput): string {
  return [
    "Você redige a MINUTA de resposta de um contribuinte a uma intimação/notificação do Fisco.",
    "Produza uma minuta estruturada: identificação, exposição dos fatos, manifestação do",
    "contribuinte e pedido/encaminhamento. Tom formal e respeitoso.",
    "Deixe lacunas com [PREENCHER] onde faltarem dados — não invente fatos nem documentos.",
    "",
    "Texto da intimação/notificação (colado pelo contador):",
    input.intimacao,
    input.observacoes ? `\nObservações do contador: ${input.observacoes}` : "",
    "",
    PROIBICAO_VALOR_LEI,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function gerarRespostaFisco(
  rawInput: unknown,
  deps: { llm: LLM },
): Promise<FiscoResultado> {
  const input = fiscoInputSchema.parse(rawInput);
  const texto = await gerarComFallback(deps.llm, montarPromptFisco(input));
  return { titulo: "Minuta de resposta ao Fisco", conteudo: comDisclaimer(texto) };
}
