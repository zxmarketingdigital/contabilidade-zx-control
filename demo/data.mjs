// ════════════════════════════════════════════════════════════════════════
// TEMPLATE — dados fictícios da DEMO local (demo/data.mjs).
// Padrão-ouro: demo/data.mjs do Contabilidade ZX Control (carteira realista de SP).
//
// INSTRUÇÕES PRO DEV (apague este bloco ao preencher):
//  1. Renomeie `itens`/`eventos` pros nomes REAIS das entidades do nicho
//     (Contabilidade: imoveis/visitas · Clínica: procedimentos/consultas...) — o
//     server e o painel devem usar os mesmos nomes.
//  2. Gere dados fictícios REALISTAS do nicho, em pt-BR: nomes plausíveis,
//     valores de mercado, cidades/bairros reais. NADA de "Teste 1", "Foo".
//  3. MÍNIMO 10 registros por entidade principal (DoD item 4 — o CI conta).
//  4. Misture estados de propósito (ativo, desatualizado >7d, fechado,
//     perdido, opt-out, no-show, falhou...) pra demo exibir todos os badges
//     do painel — inclusive os de erro/bloqueio do log anti-ban.
//  5. Datas SEMPRE relativas a "agora" (helpers ago/ahead) pra demo parecer
//     viva em qualquer dia que rodar.
//  6. Zero credencial real e zero placeholder Jinja ("chave-dupla") sobrando.
// ════════════════════════════════════════════════════════════════════════

const now = Date.now();
const H = 3600_000;
const D = 86400_000;
export const ago = (ms) => new Date(now - ms).toISOString();
export const ahead = (ms) => new Date(now + ms).toISOString();

// ── Entidade principal 1 — o "estoque/oferta" do nicho ─────────────────────
// (Contabilidade: imoveis · Clínica: procedimentos/pacotes). Renomear + ≥10 itens.
export const itens = [
  { id: "i1", titulo: "Exemplo — substitua por item real do nicho", status: "ativo", origem: "manual", atualizado_em: ago(1 * D) },
  { id: "i2", titulo: "Exemplo desatualizado (>7d → ⚠ no painel)", status: "ativo", origem: "csv", atualizado_em: ago(12 * D) },
];

// ── Entidade principal 2 — clientes / carteira ──────────────────────────────
// `estado` é o estado do funil (o painel lê pro badge). Renomear campos
// de qualificação pros critérios do nicho. ≥10 registros.
export const clientes = [
  { id: "c1", nome: "Nome Realista", telefone: "5511988000001", estado: "novo", elegivel_proativo: false, opt_out: false, origem: "whatsapp", consentimento: false },
  { id: "c2", nome: "Outro Nome Realista", telefone: "5511988000002", estado: "qualificado", elegivel_proativo: true, opt_out: false, origem: "link_qr", consentimento: true },
];

// ── Conversas + mensagens ───────────────────────────────────────────────────
// Conversas espelham clientes; mensagens mostram o Agente 1 QUALIFICANDO de
// verdade (perguntas do nicho + match + agendamento), não small talk.
export const conversas = [
  { id: "cv1", cliente_id: "c1", cliente_nome: "Nome Realista", estado: "novo", ultima_interacao: ago(2 * H) },
];

export const mensagens = {
  cv1: [
    { direcao: "entrada", conteudo: "oi, vi o anúncio" },
    { direcao: "saida", conteudo: "Oi! Aqui é o assistente 🙂 Me conta o que você procura que eu te ajudo." },
  ],
};

// ── Eventos / agenda — visitas, consultas, agendamentos do nicho ────────────
// Misture futuros (agendada/confirmada) e passados (realizada/no_show).
export const eventos = [
  { id: "v1", cliente_id: "c2", cliente_nome: "Outro Nome Realista", item_id: "i1", local: "Endereço plausível", agendada_para: ahead(1 * D), status: "agendada" },
];

// ── Disparos (audit log dos crons / anti-ban) ───────────────────────────────
// Inclua de propósito: "enviado", "bloqueado" (opt-out e rate-cap) e "falhou".
export const disparos = [
  { id: "d1", cliente_id: "c2", agente: "followup", numero: "5511970000001", status: "enviado", criado_em: ago(4 * H) },
  { id: "d2", cliente_id: "c1", agente: "reativador", numero: "5511970000001", status: "bloqueado", criado_em: ago(10 * H) },
];

// ── Config (estado mutável da aba Config) + status do adapter ───────────────
export const config = {
  whatsapp_provider: "evolution",
  evolution_url: "https://evo.exemplo.com.br",
  evolution_instance: "demo",
  followup_dias: 1,
};

export const adapterStatus = "connected";
