// ════════════════════════════════════════════════════════════════════════
// Dados fictícios da DEMO local do Contabilidade ZX Control (carteira realista
// de um escritório de SP). Zero credencial, zero placeholder. Datas relativas a
// "agora" (helpers) pra demo parecer viva em qualquer dia que rodar.
// ≥10 registros por entidade principal (DoD item 4 — o CI conta).
// ════════════════════════════════════════════════════════════════════════

const DISCLAIMER = "Conteúdo gerado por IA — a conferência pelo contador responsável é obrigatória.";
export const TOKEN = "demo-contabil-2026"; // mesmo valor no /config.js servido pela demo

const D = 86400000;
const now = Date.now();
const iso = (ms) => new Date(ms).toISOString();
const dateOnly = (offsetDias) => new Date(now + offsetDias * D).toISOString().slice(0, 10);

// ── Empresas-cliente (regimes variados: MEI, Simples, Presumido, Real) ──────
export const empresas = [
  { id: "emp1", razaoSocial: "Padaria Pão Quente LTDA", cnpj: "12.345.678/0001-90", regime: "simples", porte: "EPP", criadoEm: iso(now - 120 * D) },
  { id: "emp2", razaoSocial: "Marcos Andrade Reparos ME", cnpj: "23.456.789/0001-01", regime: "mei", porte: "MEI", criadoEm: iso(now - 90 * D) },
  { id: "emp3", razaoSocial: "Studio Bella Estética LTDA", cnpj: "34.567.890/0001-12", regime: "simples", porte: "ME", criadoEm: iso(now - 200 * D) },
  { id: "emp4", razaoSocial: "Transportes Vale Verde S/A", cnpj: "45.678.901/0001-23", regime: "real", porte: "Demais", criadoEm: iso(now - 320 * D) },
  { id: "emp5", razaoSocial: "Clínica Odontológica Sorriso LTDA", cnpj: "56.789.012/0001-34", regime: "presumido", porte: "EPP", criadoEm: iso(now - 150 * D) },
  { id: "emp6", razaoSocial: "Mercadinho Família Unida LTDA", cnpj: "67.890.123/0001-45", regime: "simples", porte: "ME", criadoEm: iso(now - 60 * D) },
  { id: "emp7", razaoSocial: "Construtora Horizonte EIRELI", cnpj: "78.901.234/0001-56", regime: "presumido", porte: "Demais", criadoEm: iso(now - 410 * D) },
  { id: "emp8", razaoSocial: "Ana Beatriz Confeitaria ME", cnpj: "89.012.345/0001-67", regime: "mei", porte: "MEI", criadoEm: iso(now - 30 * D) },
  { id: "emp9", razaoSocial: "TechNova Software LTDA", cnpj: "90.123.456/0001-78", regime: "presumido", porte: "EPP", criadoEm: iso(now - 75 * D) },
  { id: "emp10", razaoSocial: "Distribuidora Sul Bebidas S/A", cnpj: "01.234.567/0001-89", regime: "real", porte: "Demais", criadoEm: iso(now - 500 * D) },
  { id: "emp11", razaoSocial: "Oficina do Zé Mecânica ME", cnpj: "11.222.333/0001-44", regime: "simples", porte: "ME", criadoEm: iso(now - 18 * D) },
  { id: "emp12", razaoSocial: "Verde Vida Hortifruti LTDA", cnpj: "22.333.444/0001-55", regime: "simples", porte: "EPP", criadoEm: iso(now - 220 * D) },
];

// ── Competências (mês/ano de referência por empresa) ────────────────────────
const M = new Date(now);
const mesAtual = M.getMonth() + 1;
const anoAtual = M.getFullYear();
const mesAnt = mesAtual === 1 ? 12 : mesAtual - 1;
const anoAnt = mesAtual === 1 ? anoAtual - 1 : anoAtual;
export const competencias = [
  { id: "comp1", empresaId: "emp1", ano: anoAtual, mes: mesAtual, status: "aberta", criadoEm: iso(now - 5 * D) },
  { id: "comp2", empresaId: "emp1", ano: anoAnt, mes: mesAnt, status: "fechada", criadoEm: iso(now - 35 * D) },
  { id: "comp3", empresaId: "emp3", ano: anoAtual, mes: mesAtual, status: "aberta", criadoEm: iso(now - 4 * D) },
  { id: "comp4", empresaId: "emp4", ano: anoAtual, mes: mesAtual, status: "aberta", criadoEm: iso(now - 6 * D) },
  { id: "comp5", empresaId: "emp5", ano: anoAnt, mes: mesAnt, status: "fechada", criadoEm: iso(now - 33 * D) },
  { id: "comp6", empresaId: "emp6", ano: anoAtual, mes: mesAtual, status: "aberta", criadoEm: iso(now - 7 * D) },
  { id: "comp7", empresaId: "emp7", ano: anoAtual, mes: mesAtual, status: "aberta", criadoEm: iso(now - 3 * D) },
  { id: "comp8", empresaId: "emp9", ano: anoAnt, mes: mesAnt, status: "fechada", criadoEm: iso(now - 31 * D) },
  { id: "comp9", empresaId: "emp10", ano: anoAtual, mes: mesAtual, status: "aberta", criadoEm: iso(now - 2 * D) },
  { id: "comp10", empresaId: "emp12", ano: anoAtual, mes: mesAtual, status: "aberta", criadoEm: iso(now - 8 * D) },
  { id: "comp11", empresaId: "emp4", ano: anoAnt, mes: mesAnt, status: "fechada", criadoEm: iso(now - 36 * D) },
];

// ── Prazos / agenda (1 vencido, alguns vencendo ≤5d, restante no prazo) ──────
export const prazos = [
  { id: "prz1", empresaId: "emp1", sigla: "DAS", descricao: "Documento de Arrecadação do Simples Nacional", dataFatal: dateOnly(-3), status: "pendente" }, // VENCIDO
  { id: "prz2", empresaId: "emp1", sigla: "DCTFWeb", descricao: "Declaração de Débitos e Créditos Previdenciários", dataFatal: dateOnly(2), status: "pendente" }, // alerta
  { id: "prz3", empresaId: "emp1", sigla: "eSocial", descricao: "Eventos periódicos do eSocial", dataFatal: dateOnly(2), status: "cumprido" },
  { id: "prz4", empresaId: "emp4", sigla: "EFD-ICMS/IPI", descricao: "Escrituração Fiscal Digital ICMS/IPI", dataFatal: dateOnly(4), status: "pendente" }, // alerta
  { id: "prz5", empresaId: "emp4", sigla: "DCTFWeb", descricao: "Declaração de Débitos e Créditos Federais", dataFatal: dateOnly(12), status: "pendente" },
  { id: "prz6", empresaId: "emp5", sigla: "DCTFWeb", descricao: "Declaração de Débitos e Créditos Federais", dataFatal: dateOnly(1), status: "pendente" }, // alerta
  { id: "prz7", empresaId: "emp5", sigla: "EFD-Contribuições", descricao: "Escrituração das Contribuições", dataFatal: dateOnly(20), status: "pendente" },
  { id: "prz8", empresaId: "emp6", sigla: "DAS", descricao: "Documento de Arrecadação do Simples Nacional", dataFatal: dateOnly(9), status: "pendente" },
  { id: "prz9", empresaId: "emp7", sigla: "EFD-Contribuições", descricao: "Escrituração das Contribuições", dataFatal: dateOnly(-1), status: "pendente" }, // VENCIDO
  { id: "prz10", empresaId: "emp9", sigla: "DCTFWeb", descricao: "Declaração de Débitos e Créditos Federais", dataFatal: dateOnly(5), status: "pendente" }, // alerta
  { id: "prz11", empresaId: "emp10", sigla: "EFD-ICMS/IPI", descricao: "Escrituração Fiscal Digital ICMS/IPI", dataFatal: dateOnly(15), status: "pendente" },
  { id: "prz12", empresaId: "emp12", sigla: "DAS", descricao: "Documento de Arrecadação do Simples Nacional", dataFatal: dateOnly(7), status: "pendente" },
];

// ── Saídas geradas (histórico dos 5 agentes) — conteúdo plausível + disclaimer ─
const comDisc = (txt) => `${txt}\n\n${DISCLAIMER}`;
export const saidas = [
  { id: "sai1", empresaId: "emp1", agente: "calendario", titulo: "Calendário Simples Nacional — competência atual", conteudo: comDisc("Para a Padaria Pão Quente neste mês: priorize o DAS (já vencido — regularize com urgência), depois DCTFWeb e o envio do eSocial. Organize os pagamentos pela ordem de vencimento listada na agenda."), criadoEm: iso(now - 1 * D) },
  { id: "sai2", empresaId: "emp2", agente: "enquadramento", titulo: "Enquadramento preliminar de empresa", conteudo: comDisc("FICHA: prestador de serviços de reparos, faturamento dentro do teto do MEI, sem empregados.\nREGIME SUGERIDO: MEI, pela natureza da atividade e do faturamento.\nDOCUMENTOS A SOLICITAR: comprovante de endereço, atividade desejada, estimativa de faturamento.\nPARECER PRELIMINAR: enquadramento como MEI parece adequado; confirme a atividade na tabela vigente."), criadoEm: iso(now - 2 * D) },
  { id: "sai3", empresaId: "emp3", agente: "comunicado", titulo: "Comunicado ao cliente — Studio Bella Estética", conteudo: comDisc("Olá! Segue o resumo do mês: há tributos a pagar conforme as guias que enviaremos, e está pendente o envio das notas de serviço. Próximos passos: nos encaminhe as notas até o fim da semana para fecharmos a competência no prazo."), criadoEm: iso(now - 3 * D) },
  { id: "sai4", empresaId: "emp4", agente: "fisco", titulo: "Minuta de resposta ao Fisco", conteudo: comDisc("À Delegacia da Receita Federal.\nAssunto: resposta à intimação nº [PREENCHER].\nA empresa Transportes Vale Verde, vem, respeitosamente, apresentar os esclarecimentos solicitados, anexando os documentos pertinentes e colocando-se à disposição para diligências."), criadoEm: iso(now - 4 * D) },
  { id: "sai5", empresaId: null, agente: "consultor", titulo: "Orientação tributária", conteudo: comDisc("Sobre a migração de Lucro Presumido para Simples: avalie o porte, a atividade (anexos aplicáveis), a folha de pagamento e a projeção de faturamento. Em muitos casos a carga muda conforme o fator R. Verifique a legislação vigente e simule os cenários antes de optar."), criadoEm: iso(now - 5 * D) },
  { id: "sai6", empresaId: "emp5", agente: "calendario", titulo: "Calendário Lucro Presumido — competência atual", conteudo: comDisc("Clínica Sorriso: organize DCTFWeb (vence em poucos dias) e a EFD-Contribuições mais à frente. Confira a agenda para as datas exatas já ajustadas para dias úteis."), criadoEm: iso(now - 6 * D) },
  { id: "sai7", empresaId: "emp6", agente: "comunicado", titulo: "Comunicado ao cliente — Mercadinho Família Unida", conteudo: comDisc("Olá! Neste mês há o DAS a pagar dentro do prazo e nenhuma pendência de documentos. Assim que a guia for emitida, enviaremos para pagamento."), criadoEm: iso(now - 7 * D) },
  { id: "sai8", empresaId: "emp7", agente: "enquadramento", titulo: "Enquadramento preliminar de empresa", conteudo: comDisc("FICHA: construção civil, faturamento elevado, com empregados.\nREGIME SUGERIDO: Lucro Presumido como ponto de partida; avaliar Real conforme margem.\nOBRIGAÇÕES: DCTFWeb, EFD-Contribuições, eSocial.\nPARECER: análise preliminar; confirmar com a apuração efetiva."), criadoEm: iso(now - 8 * D) },
  { id: "sai9", empresaId: "emp9", agente: "consultor", titulo: "Orientação tributária", conteudo: comDisc("Sobre o fator R para empresas de software: quando a folha representa parcela relevante da receita, a atividade pode ser tributada por anexo mais favorável. Levante a relação folha/receita dos últimos meses e confira a legislação vigente."), criadoEm: iso(now - 9 * D) },
  { id: "sai10", empresaId: "emp10", agente: "calendario", titulo: "Calendário Lucro Real — competência atual", conteudo: comDisc("Distribuidora Sul: mês com EFD-ICMS/IPI e DCTFWeb. As datas na agenda já estão antecipadas para dia útil quando caíam em fim de semana ou feriado."), criadoEm: iso(now - 10 * D) },
  { id: "sai11", empresaId: "emp12", agente: "comunicado", titulo: "Comunicado ao cliente — Verde Vida Hortifruti", conteudo: comDisc("Olá! Resumo do mês: DAS a pagar no prazo e tudo em dia com a documentação. Seguimos cuidando das obrigações da empresa."), criadoEm: iso(now - 11 * D) },
];
