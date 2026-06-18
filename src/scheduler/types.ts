// ⚓ Sincronizado de zxmarketingdigital/contabilidade-zx-control (engine anti-ban) em 13/Jun/2026.
// Se a engine do Contabilidade evoluir, re-sincronizar esta casca e rodar os testes.
// CASCA CATÁLOGO (congelada) — contrato do scheduler anti-ban. Niche-neutro: o nicho
// define seus próprios nomes de agente (string) e escolhe a estratégia de dedup.
// NÃO acople isto ao seu nicho — é a engine que protege a linha emissora de ban.

// Estratégia de deduplicação do disparo (substitui o antigo hardcode por agente):
//  - entity: dedup 1x por (cliente, agente, entidade) — ex.: avisar do mesmo imóvel/processo só 1x.
//  - month:  dedup por mês civil + toque — ex.: pós-venda D+3 (toque 1) e D+30 (toque 2) no mesmo mês.
//  - week:   dedup semanal (ISO) — default p/ follow-up / reativador.
export type DedupScope =
  | { tipo: "entity"; entityId: string }
  | { tipo: "month"; toque?: number }
  | { tipo: "week" };

export interface DispatchOptions {
  clienteId: string;
  numero: string;
  agente: string; // o nicho define seus nomes de agente
  dedup: DedupScope; // estratégia de dedup desta mensagem
  mensagem: string;
  window: { start: number; end: number }; // horas em America/Sao_Paulo (BRT) 0-23
  rateCap?: { hora: number; dia: number }; // GLOBAL da instância emissora; default 20/h · 80/dia
  now?: Date; // injetável para testes
  delayMs?: number; // anti-ban: espera após envio (jitter); 0/omisso = sem espera
  sleep?: (ms: number) => Promise<void>; // injetável para testes
}

// Interface mínima do banco que o scheduler precisa (mockável em testes).
// A implementação do nicho pode gravar colunas extras (entidade etc.) — a engine
// só exige estes métodos.
export interface DbLike {
  existeDisparo(clienteId: string, agente: string, chave: string): Promise<boolean>;
  // Rate-cap GLOBAL da instância (1 cliente = 1 linha emissora), NUNCA por destinatário.
  contarEnviosHora(desde: Date): Promise<number>;
  contarEnviosDia(desde: Date): Promise<number>;
  clienteOptOut(clienteId: string): Promise<boolean>;
  registrarDisparo(params: {
    clienteId: string;
    numero: string;
    agente: string;
    chave: string;
    status: "enviado" | "bloqueado";
  }): Promise<void>;
}

// Interface mínima do adapter de WhatsApp (mockável em testes).
export interface AdapterLike {
  send(numero: string, mensagem: string): Promise<void>;
}
