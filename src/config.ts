// ════════════════════════════════════════════════════════════════════════
// "Um valor, um lugar" — TODA constante de configuração do produto vive aqui.
// Painel, agentes, setup e demo IMPORTAM daqui. Literal repetido em 2+ arquivos
// = fix incompleto (CLAUDE.md). Se mudar um valor, muda só aqui.
//
// NÃO duplique o model id do Gemini: ele é interno ao wrapper congelado
// (src/gemini/client.ts) e não deve ser repetido neste arquivo.
// ════════════════════════════════════════════════════════════════════════

/** Timezone fiscal da linha — prazos NUNCA em UTC nem data corrida (spec §7.3). */
export const TIMEZONE = "America/Sao_Paulo" as const;

/**
 * Disclaimer obrigatório em TODO output de IA (spec §7.1). Texto exato — um teste
 * falha se for removido de qualquer saída. Renderizado no painel E embutido na
 * exportação.
 */
export const DISCLAIMER =
  "Conteúdo gerado por IA — a conferência pelo contador responsável é obrigatória.";

/** Regimes tributários suportados (spec §5.2). Fonte única do enum. */
export const REGIMES = ["mei", "simples", "presumido", "real"] as const;
export type Regime = (typeof REGIMES)[number];

export const REGIME_LABEL: Record<Regime, string> = {
  mei: "MEI",
  simples: "Simples Nacional",
  presumido: "Lucro Presumido",
  real: "Lucro Real",
};

/**
 * Feriados nacionais FIXOS (mês-dia). Os móveis (Carnaval, Sexta-feira Santa,
 * Corpus Christi) são derivados da Páscoa em src/prazos.ts — não cabem aqui
 * porque dependem do ano. Inclui Consciência Negra (Lei 14.759/2023, nacional
 * desde 2024). Banco fechado ⇒ não é dia útil para vencimento fiscal.
 */
export const FERIADOS_FIXOS: ReadonlyArray<{ mes: number; dia: number; nome: string }> = [
  { mes: 1, dia: 1, nome: "Confraternização Universal" },
  { mes: 4, dia: 21, nome: "Tiradentes" },
  { mes: 5, dia: 1, nome: "Dia do Trabalho" },
  { mes: 9, dia: 7, nome: "Independência" },
  { mes: 10, dia: 12, nome: "Nossa Senhora Aparecida" },
  { mes: 11, dia: 2, nome: "Finados" },
  { mes: 11, dia: 15, nome: "Proclamação da República" },
  { mes: 11, dia: 20, nome: "Consciência Negra" },
  { mes: 12, dia: 25, nome: "Natal" },
];

/**
 * Catálogo determinístico de obrigações por regime (spec §5.1). É config
 * (NÃO saída de IA): a IA nunca inventa obrigação nem vencimento. `diaVenc` é o
 * dia nominal de vencimento; `mesOffset` = quantos meses após a competência ele
 * cai (1 = mês seguinte). A data fatal final é o dia nominal ANTECIPADO para o
 * dia útil anterior quando cai em fim de semana/feriado (src/prazos.ts).
 *
 * NÃO contém valor (R$) nem alíquota nem nº de norma — proibido afirmar (spec §7.2).
 */
export interface ObrigacaoBase {
  readonly sigla: string;
  readonly descricao: string;
  readonly diaVenc: number;
  readonly mesOffset: number;
}

export const OBRIGACOES_POR_REGIME: Record<Regime, ReadonlyArray<ObrigacaoBase>> = {
  mei: [
    { sigla: "DAS-MEI", descricao: "Documento de Arrecadação do MEI", diaVenc: 20, mesOffset: 1 },
  ],
  simples: [
    { sigla: "DAS", descricao: "Documento de Arrecadação do Simples Nacional", diaVenc: 20, mesOffset: 1 },
    { sigla: "DCTFWeb", descricao: "Declaração de Débitos e Créditos Tributários Federais Previdenciários", diaVenc: 15, mesOffset: 1 },
    { sigla: "eSocial", descricao: "Envio de eventos periódicos do eSocial", diaVenc: 15, mesOffset: 1 },
  ],
  presumido: [
    { sigla: "DCTFWeb", descricao: "Declaração de Débitos e Créditos Tributários Federais", diaVenc: 15, mesOffset: 1 },
    { sigla: "EFD-Contribuições", descricao: "Escrituração Fiscal Digital das Contribuições", diaVenc: 14, mesOffset: 2 },
    { sigla: "eSocial", descricao: "Envio de eventos periódicos do eSocial", diaVenc: 15, mesOffset: 1 },
  ],
  real: [
    { sigla: "DCTFWeb", descricao: "Declaração de Débitos e Créditos Tributários Federais", diaVenc: 15, mesOffset: 1 },
    { sigla: "EFD-Contribuições", descricao: "Escrituração Fiscal Digital das Contribuições", diaVenc: 14, mesOffset: 2 },
    { sigla: "EFD-ICMS/IPI", descricao: "Escrituração Fiscal Digital ICMS/IPI", diaVenc: 20, mesOffset: 1 },
    { sigla: "eSocial", descricao: "Envio de eventos periódicos do eSocial", diaVenc: 15, mesOffset: 1 },
  ],
};

/** Janela de destaque da agenda: prazos vencendo em ≤ N dias acendem (spec §6.3). */
export const PRAZO_ALERTA_DIAS = 5;

/**
 * Precificação white-label da proposta comercial (spec §9 N6). Fonte única —
 * docs/proposta.html e qualquer material comercial leem daqui (sem placeholder).
 */
export const PRECO = {
  setupUnico: 1497,
  mensalidade: 197,
  moeda: "BRL",
} as const;
