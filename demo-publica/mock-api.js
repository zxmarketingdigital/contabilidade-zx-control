// ════════════════════════════════════════════════════════════════════════
// Mock API client-side — Contabilidade ZX Control (demo pública estática).
//
// Porta a lógica de demo/server.mjs + demo/data.mjs do repo para rodar 100% no
// browser, SEM servidor Node, SEM credencial. Faz monkey-patch de window.fetch:
// intercepta chamadas para ZX.apiBase ("/api/...") e resolve a partir de um
// store em memória semeado com dados fictícios. Mutações vivem só na sessão do
// browser (recarregar a página restaura o seed). Qualquer outra URL (ex.:
// BrasilAPI pública) passa pro fetch real intacta.
//
// Os 5 agentes texto→texto devolvem os textos MOCK pré-gravados (sem IA real).
// ════════════════════════════════════════════════════════════════════════
(() => {
  const DISCLAIMER = "Conteúdo gerado por IA — a conferência pelo contador responsável é obrigatória.";
  const TOKEN = (window.ZX && window.ZX.token) || "demo-contabil-2026";
  const API_BASE = (window.ZX && window.ZX.apiBase) || "/api";

  const D = 86400000;
  const now = Date.now();
  const iso = (ms) => new Date(ms).toISOString();
  const dateOnly = (offsetDias) => new Date(now + offsetDias * D).toISOString().slice(0, 10);
  const comDisc = (txt) => `${txt}\n\n${DISCLAIMER}`;

  // ── Seed: cópia embutida de demo/data.mjs (NÃO importa módulo Node) ──
  const M = new Date(now);
  const mesAtual = M.getMonth() + 1;
  const anoAtual = M.getFullYear();
  const mesAnt = mesAtual === 1 ? 12 : mesAtual - 1;
  const anoAnt = mesAtual === 1 ? anoAtual - 1 : anoAtual;

  const SEED = {
    empresas: [
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
    ],
    competencias: [
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
    ],
    prazos: [
      { id: "prz1", empresaId: "emp1", sigla: "DAS", descricao: "Documento de Arrecadação do Simples Nacional", dataFatal: dateOnly(-3), status: "pendente" },
      { id: "prz2", empresaId: "emp1", sigla: "DCTFWeb", descricao: "Declaração de Débitos e Créditos Previdenciários", dataFatal: dateOnly(2), status: "pendente" },
      { id: "prz3", empresaId: "emp1", sigla: "eSocial", descricao: "Eventos periódicos do eSocial", dataFatal: dateOnly(2), status: "cumprido" },
      { id: "prz4", empresaId: "emp4", sigla: "EFD-ICMS/IPI", descricao: "Escrituração Fiscal Digital ICMS/IPI", dataFatal: dateOnly(4), status: "pendente" },
      { id: "prz5", empresaId: "emp4", sigla: "DCTFWeb", descricao: "Declaração de Débitos e Créditos Federais", dataFatal: dateOnly(12), status: "pendente" },
      { id: "prz6", empresaId: "emp5", sigla: "DCTFWeb", descricao: "Declaração de Débitos e Créditos Federais", dataFatal: dateOnly(1), status: "pendente" },
      { id: "prz7", empresaId: "emp5", sigla: "EFD-Contribuições", descricao: "Escrituração das Contribuições", dataFatal: dateOnly(20), status: "pendente" },
      { id: "prz8", empresaId: "emp6", sigla: "DAS", descricao: "Documento de Arrecadação do Simples Nacional", dataFatal: dateOnly(9), status: "pendente" },
      { id: "prz9", empresaId: "emp7", sigla: "EFD-Contribuições", descricao: "Escrituração das Contribuições", dataFatal: dateOnly(-1), status: "pendente" },
      { id: "prz10", empresaId: "emp9", sigla: "DCTFWeb", descricao: "Declaração de Débitos e Créditos Federais", dataFatal: dateOnly(5), status: "pendente" },
      { id: "prz11", empresaId: "emp10", sigla: "EFD-ICMS/IPI", descricao: "Escrituração Fiscal Digital ICMS/IPI", dataFatal: dateOnly(15), status: "pendente" },
      { id: "prz12", empresaId: "emp12", sigla: "DAS", descricao: "Documento de Arrecadação do Simples Nacional", dataFatal: dateOnly(7), status: "pendente" },
    ],
    saidas: [
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
    ],
    leads: [
      { id: "lead1", nome: "Restaurante Sabor & Cia", contato: "(11) 98888-1111", origem: "Indicação", status: "novo", empresaId: null, proximaAcao: "Ligar para apresentar a proposta", dataAcao: dateOnly(1), observacao: "", criadoEm: iso(now - 2 * D) },
      { id: "lead2", nome: "Pet Shop Amigo Fiel", contato: "contato@petfiel.com", origem: "Instagram", status: "contatado", empresaId: null, proximaAcao: "Enviar proposta por e-mail", dataAcao: dateOnly(2), observacao: "Tem 4 funcionários.", criadoEm: iso(now - 5 * D) },
      { id: "lead3", nome: "Academia Corpo em Forma", contato: "(11) 97777-2222", origem: "Google", status: "reuniao_agendada", empresaId: null, proximaAcao: "Reunião terça 14h", dataAcao: dateOnly(3), observacao: "", criadoEm: iso(now - 7 * D) },
      { id: "lead4", nome: "Loja Variedades da Praça", contato: "(11) 96666-3333", origem: "Indicação", status: "desqualificado", empresaId: null, proximaAcao: "", dataAcao: null, observacao: "Já tem contador.", criadoEm: iso(now - 10 * D) },
      { id: "lead5", nome: "E-commerce ModaShop", contato: "financeiro@modashop.com", origem: "Anúncio", status: "contatado", empresaId: null, proximaAcao: "Follow-up por e-mail", dataAcao: dateOnly(1), observacao: "", criadoEm: iso(now - 4 * D) },
      { id: "lead6", nome: "Barbearia Navalha de Ouro", contato: "(11) 95555-4444", origem: "Indicação", status: "novo", empresaId: null, proximaAcao: "Primeiro contato", dataAcao: dateOnly(2), observacao: "", criadoEm: iso(now - 1 * D) },
      { id: "lead7", nome: "Consultório Dr. Almeida", contato: "(11) 94444-5555", origem: "Google", status: "reuniao_agendada", empresaId: null, proximaAcao: "Apresentar diagnóstico", dataAcao: dateOnly(4), observacao: "Migrando de outro escritório.", criadoEm: iso(now - 6 * D) },
      { id: "lead8", nome: "Marcenaria Bom Corte", contato: "(11) 93333-6666", origem: "Anúncio", status: "contatado", empresaId: null, proximaAcao: "Enviar tabela de honorários", dataAcao: dateOnly(3), observacao: "", criadoEm: iso(now - 8 * D) },
      { id: "lead9", nome: "Padaria Pão Quente LTDA", contato: "(11) 92222-7777", origem: "Indicação", status: "convertido", empresaId: "emp1", proximaAcao: "", dataAcao: null, observacao: "Virou cliente — abertura concluída.", criadoEm: iso(now - 130 * D) },
      { id: "lead10", nome: "Oficina do Zé Mecânica ME", contato: "(11) 91111-8888", origem: "Anúncio", status: "convertido", empresaId: "emp11", proximaAcao: "", dataAcao: null, observacao: "Veio de campanha paga.", criadoEm: iso(now - 25 * D) },
    ],
    receitas: [
      { id: "rec1", empresaId: "emp1", descricao: "Honorários mensais", valor: 650, tipo: "recorrente", data: dateOnly(-2), criadoEm: iso(now - 2 * D) },
      { id: "rec2", empresaId: "emp3", descricao: "Honorários mensais", valor: 550, tipo: "recorrente", data: dateOnly(-2), criadoEm: iso(now - 2 * D) },
      { id: "rec3", empresaId: "emp4", descricao: "Honorários mensais", valor: 1200, tipo: "recorrente", data: dateOnly(-2), criadoEm: iso(now - 2 * D) },
      { id: "rec4", empresaId: "emp5", descricao: "Honorários mensais", valor: 900, tipo: "recorrente", data: dateOnly(-2), criadoEm: iso(now - 2 * D) },
      { id: "rec5", empresaId: "emp6", descricao: "Honorários mensais", valor: 480, tipo: "recorrente", data: dateOnly(-2), criadoEm: iso(now - 2 * D) },
      { id: "rec6", empresaId: "emp9", descricao: "Honorários mensais", valor: 800, tipo: "recorrente", data: dateOnly(-2), criadoEm: iso(now - 2 * D) },
      { id: "rec7", empresaId: "emp10", descricao: "Honorários mensais", valor: 1500, tipo: "recorrente", data: dateOnly(-2), criadoEm: iso(now - 2 * D) },
      { id: "rec8", empresaId: "emp12", descricao: "Honorários mensais", valor: 600, tipo: "recorrente", data: dateOnly(-2), criadoEm: iso(now - 2 * D) },
      { id: "rec9", empresaId: "emp1", descricao: "Abertura de filial (avulso)", valor: 1500, tipo: "unica", data: dateOnly(-12), criadoEm: iso(now - 12 * D) },
      { id: "rec10", empresaId: "emp7", descricao: "Parcelamento de débitos (avulso)", valor: 2200, tipo: "unica", data: dateOnly(-20), criadoEm: iso(now - 20 * D) },
    ],
    custos: [
      { id: "cus1", descricao: "Aluguel do escritório", valor: 1800, tipo: "fixo_mensal", data: dateOnly(-3), criadoEm: iso(now - 3 * D) },
      { id: "cus2", descricao: "Sistema contábil + nuvem", valor: 450, tipo: "fixo_mensal", data: dateOnly(-3), criadoEm: iso(now - 3 * D) },
      { id: "cus3", descricao: "Folha — assistente fiscal", valor: 2600, tipo: "fixo_mensal", data: dateOnly(-3), criadoEm: iso(now - 3 * D) },
      { id: "cus4", descricao: "Energia e internet", valor: 380, tipo: "fixo_mensal", data: dateOnly(-3), criadoEm: iso(now - 3 * D) },
      { id: "cus5", descricao: "Anúncios Google Ads", valor: 600, tipo: "anuncios", data: dateOnly(-3), criadoEm: iso(now - 3 * D) },
      { id: "cus6", descricao: "Anúncios Meta (Instagram)", valor: 500, tipo: "anuncios", data: dateOnly(-3), criadoEm: iso(now - 3 * D) },
      { id: "cus7", descricao: "Compra de impressora", valor: 1200, tipo: "unico", data: dateOnly(-20), criadoEm: iso(now - 20 * D) },
      { id: "cus8", descricao: "Curso de atualização tributária", valor: 890, tipo: "unico", data: dateOnly(-30), criadoEm: iso(now - 30 * D) },
      { id: "cus9", descricao: "Contador parceiro (terceirizado)", valor: 700, tipo: "fixo_mensal", data: dateOnly(-3), criadoEm: iso(now - 3 * D) },
      { id: "cus10", descricao: "Material de escritório", valor: 220, tipo: "unico", data: dateOnly(-15), criadoEm: iso(now - 15 * D) },
    ],
  };

  // Estado mutável (cópias rasas — nunca muta o seed).
  const state = {
    empresas: SEED.empresas.map((x) => ({ ...x })),
    competencias: SEED.competencias.map((x) => ({ ...x })),
    prazos: SEED.prazos.map((x) => ({ ...x })),
    saidas: SEED.saidas.map((x) => ({ ...x })),
    leads: SEED.leads.map((x) => ({ ...x })),
    receitas: SEED.receitas.map((x) => ({ ...x })),
    custos: SEED.custos.map((x) => ({ ...x })),
  };
  let seq = 1000;
  const novoId = (p) => `${p}${++seq}`;
  const agora = () => new Date().toISOString();

  // Outputs mock dos agentes texto→texto (sem IA real).
  const MOCK_AGENTE = {
    enquadramento: () => comDisc("FICHA: empresa de serviços, porte compatível com ME/EPP.\nREGIME SUGERIDO: Simples Nacional (análise preliminar).\nOBRIGAÇÕES: DAS, DCTFWeb, eSocial.\nDOCUMENTOS A SOLICITAR: contrato social, faturamento dos últimos 12 meses, folha.\nPARECER: enquadramento preliminar; confira a apuração efetiva e a legislação vigente."),
    comunicado: () => comDisc("Olá! Segue o resumo do mês: há tributos a pagar conforme as guias que enviaremos e algumas pendências de documentos. Próximos passos: nos envie o que falta para fecharmos a competência no prazo. Qualquer dúvida, estamos à disposição."),
    consultor: () => comDisc("Orientação geral: avalie o porte, a atividade e a projeção de faturamento antes de decidir. Cada regime tem obrigações e impactos diferentes. Recomendo simular os cenários e conferir a legislação vigente para a situação concreta da empresa."),
    fisco: () => comDisc("Ao órgão competente.\nAssunto: resposta à intimação/notificação nº [PREENCHER].\nA empresa vem, respeitosamente, apresentar os esclarecimentos solicitados, anexando os documentos pertinentes e colocando-se à disposição para eventuais diligências."),
  };

  function mockCalendario(empresaId) {
    const d = (off) => new Date(now + off * D).toISOString().slice(0, 10);
    const obrig = [
      { sigla: "DAS", descricao: "Documento de Arrecadação do Simples Nacional", diaNominal: 20, dataFatal: d(8) },
      { sigla: "DCTFWeb", descricao: "Declaração de Débitos e Créditos Previdenciários", diaNominal: 15, dataFatal: d(3) },
      { sigla: "eSocial", descricao: "Eventos periódicos do eSocial", diaNominal: 15, dataFatal: d(3) },
    ];
    const gravados = obrig.map((o) => {
      const row = { id: novoId("prz"), empresaId, sigla: o.sigla, descricao: o.descricao, dataFatal: o.dataFatal, status: "pendente" };
      state.prazos.push(row);
      return row;
    });
    return { obrigacoes: obrig, prazosGravados: gravados,
      texto: comDisc("Obrigações da competência gravadas na agenda. Priorize as de vencimento mais próximo; as datas já estão ajustadas para dias úteis.") };
  }

  // Resposta JSON imitando a interface do fetch (Response).
  function jsonResponse(data, status = 200) {
    const body = JSON.stringify(data);
    return new Response(body, { status, headers: { "Content-Type": "application/json" } });
  }

  // Resolve uma chamada /api → Response. Espelha o router de demo/server.mjs.
  function route(method, pathWithQuery, bodyObj, authHeader) {
    // Bearer auth fail-closed (igual ao router real).
    if ((authHeader || "") !== `Bearer ${TOKEN}`) return jsonResponse({ error: "Unauthorized" }, 401);

    const [rawPath, qs] = pathWithQuery.split("?");
    const params = new URLSearchParams(qs || "");
    const path = rawPath; // já sem o prefixo /api
    const m = method.toUpperCase();
    const reg = (s) => s.exec(path);
    const b = bodyObj || {};

    // ── Empresas ──
    if (path === "/empresas" && m === "GET") return jsonResponse(state.empresas);
    if (path === "/empresas" && m === "POST") {
      if (!b.razaoSocial || !b.regime) return jsonResponse({ error: "Empresa inválida" }, 400);
      const row = { id: novoId("emp"), razaoSocial: b.razaoSocial, cnpj: b.cnpj, regime: b.regime, porte: b.porte, criadoEm: agora() };
      state.empresas.push(row);
      return jsonResponse(row, 201);
    }
    const delEmp = reg(/^\/empresas\/([^/]+)$/);
    if (delEmp && m === "DELETE") {
      state.empresas = state.empresas.filter((e) => e.id !== delEmp[1]);
      return jsonResponse({ ok: true });
    }

    // ── Competências ──
    if (path === "/competencias" && m === "GET") {
      const eid = params.get("empresaId");
      return jsonResponse(state.competencias.filter((c) => !eid || c.empresaId === eid));
    }
    if (path === "/competencias" && m === "POST") {
      const row = { id: novoId("comp"), empresaId: b.empresaId, ano: Number(b.ano), mes: Number(b.mes), status: b.status ?? "aberta", criadoEm: agora() };
      state.competencias.push(row);
      return jsonResponse(row, 201);
    }

    // ── Prazos / agenda ──
    if (path === "/prazos" && m === "GET") {
      const eid = params.get("empresaId");
      // Sem empresaId → agenda completa do escritório (painel-início / aviso de login).
      // Espelha src/app.ts (rota real do Worker). O 400 que existia aqui era uma
      // divergência do mock: travava o dashboard "Início" num spinner eterno.
      const lista = eid ? state.prazos.filter((p) => p.empresaId === eid) : state.prazos.slice();
      return jsonResponse(lista.sort((a, c) => a.dataFatal.localeCompare(c.dataFatal)));
    }
    if (path === "/prazos" && m === "POST") {
      if (!b.empresaId || !b.sigla || !b.descricao || !/^\d{4}-\d{2}-\d{2}$/.test(b.dataFatal || "")) return jsonResponse({ error: "Prazo inválido" }, 400);
      const row = { id: novoId("prz"), empresaId: b.empresaId, sigla: b.sigla, descricao: b.descricao, dataFatal: b.dataFatal, status: "pendente" };
      state.prazos.push(row);
      return jsonResponse(row, 201);
    }
    const prazoStatus = reg(/^\/prazos\/([^/]+)\/status$/);
    if (prazoStatus && m === "PUT") {
      if (b.status !== "pendente" && b.status !== "cumprido") return jsonResponse({ error: "status inválido" }, 400);
      const row = state.prazos.find((p) => p.id === prazoStatus[1]);
      if (row) row.status = b.status;
      return jsonResponse({ ok: true });
    }

    // ── Saídas ──
    if (path === "/saidas" && m === "GET") {
      const eid = params.get("empresaId");
      const rows = eid ? state.saidas.filter((s) => s.empresaId === eid) : state.saidas;
      return jsonResponse([...rows].sort((a, c) => new Date(c.criadoEm) - new Date(a.criadoEm)));
    }

    // ── Agentes ──
    if (path === "/agentes/calendario" && m === "POST") {
      const r = mockCalendario(b.empresaId || "sem-empresa");
      state.saidas.push({ id: novoId("sai"), empresaId: b.empresaId, agente: "calendario", titulo: "Calendário de obrigações", conteudo: r.texto, criadoEm: agora() });
      return jsonResponse({ titulo: "Calendário de obrigações", ...r }, 201);
    }
    const agMatch = reg(/^\/agentes\/(enquadramento|comunicado|consultor|fisco)$/);
    if (agMatch && m === "POST") {
      const tipo = agMatch[1];
      const titulos = { enquadramento: "Enquadramento preliminar de empresa", comunicado: "Comunicado ao cliente", consultor: "Orientação tributária", fisco: "Minuta de resposta ao Fisco" };
      const row = { id: novoId("sai"), empresaId: b.empresaId ?? null, agente: tipo, titulo: titulos[tipo], conteudo: MOCK_AGENTE[tipo](), criadoEm: agora() };
      state.saidas.push(row);
      return jsonResponse(row, 201);
    }

    // ── CRM: leads ──
    if (path === "/leads" && m === "GET") return jsonResponse([...state.leads].sort((a, c) => new Date(c.criadoEm) - new Date(a.criadoEm)));
    if (path === "/leads" && m === "POST") {
      if (!b.nome) return jsonResponse({ error: "Lead inválido" }, 400);
      const row = { id: novoId("lead"), nome: b.nome, contato: b.contato || null, origem: b.origem || null, status: b.status || "novo", empresaId: null, proximaAcao: b.proximaAcao || null, dataAcao: b.dataAcao || null, observacao: b.observacao || null, criadoEm: agora() };
      state.leads.push(row);
      return jsonResponse(row, 201);
    }
    const leadConv = reg(/^\/leads\/([^/]+)\/converter$/);
    if (leadConv && m === "POST") {
      const lead = state.leads.find((l) => l.id === leadConv[1]);
      if (!lead) return jsonResponse({ error: "Lead não encontrado" }, 404);
      if (lead.empresaId) return jsonResponse({ error: "Lead já convertido" }, 409);
      const empresa = { id: novoId("emp"), razaoSocial: lead.nome, cnpj: null, regime: "simples", porte: null, observacao: null, inativo: false, criadoEm: agora() };
      state.empresas.push(empresa);
      lead.status = "convertido";
      lead.empresaId = empresa.id;
      return jsonResponse({ lead, empresa }, 201);
    }
    const leadId = reg(/^\/leads\/([^/]+)$/);
    if (leadId && m === "PUT") {
      const r = state.leads.find((l) => l.id === leadId[1]);
      if (r) ["nome", "contato", "origem", "status", "proximaAcao", "dataAcao", "observacao"].forEach((k) => { if (b[k] !== undefined) r[k] = b[k]; });
      return jsonResponse(r || {});
    }
    if (leadId && m === "DELETE") { state.leads = state.leads.filter((l) => l.id !== leadId[1]); return jsonResponse({ ok: true }); }

    // ── Financeiro: receitas / custos / métricas ──
    if (path === "/receitas" && m === "GET") return jsonResponse([...state.receitas].sort((a, c) => new Date(c.criadoEm) - new Date(a.criadoEm)));
    if (path === "/receitas" && m === "POST") {
      const row = { id: novoId("rec"), empresaId: b.empresaId || null, descricao: b.descricao || null, valor: Number(b.valor), tipo: b.tipo, data: b.data || null, criadoEm: agora() };
      state.receitas.push(row);
      return jsonResponse(row, 201);
    }
    const recId = reg(/^\/receitas\/([^/]+)$/);
    if (recId && m === "DELETE") { state.receitas = state.receitas.filter((r) => r.id !== recId[1]); return jsonResponse({ ok: true }); }

    if (path === "/custos" && m === "GET") return jsonResponse([...state.custos].sort((a, c) => new Date(c.criadoEm) - new Date(a.criadoEm)));
    if (path === "/custos" && m === "POST") {
      const row = { id: novoId("cus"), descricao: b.descricao, valor: Number(b.valor), tipo: b.tipo, data: b.data || null, criadoEm: agora() };
      state.custos.push(row);
      return jsonResponse(row, 201);
    }
    const cusId = reg(/^\/custos\/([^/]+)$/);
    if (cusId && m === "DELETE") { state.custos = state.custos.filter((c) => c.id !== cusId[1]); return jsonResponse({ ok: true }); }

    if (path === "/financeiro" && m === "GET") {
      const round2 = (n) => Math.round(n * 100) / 100;
      const somaT = (arr, t) => round2(arr.filter((x) => x.tipo === t).reduce((a, x) => a + Number(x.valor || 0), 0));
      const mrr = somaT(state.receitas, "recorrente"), fixo = somaT(state.custos, "fixo_mensal"), ads = somaT(state.custos, "anuncios");
      const custoMensalTotal = round2(fixo + ads);
      const convertidos = state.leads.filter((l) => l.empresaId).length;
      return jsonResponse({
        mrr, receitaUnica: somaT(state.receitas, "unica"), custoFixoMensal: fixo, custoUnico: somaT(state.custos, "unico"),
        investimentoAnuncios: ads, custoMensalTotal, lucroMensal: round2(mrr - custoMensalTotal),
        cac: convertidos > 0 ? round2(ads / convertidos) : null, leadsConvertidos: convertidos,
      });
    }

    return jsonResponse({ error: "Not Found" }, 404);
  }

  // ── Monkey-patch de window.fetch ──
  const realFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    const url = typeof input === "string" ? input : (input && input.url) || "";
    // Só intercepta chamadas SAME-ORIGIN para a API mock (ZX.apiBase). URLs
    // cross-origin (ex.: BrasilAPI pública em https://brasilapi.com.br/api/...)
    // passam direto pro fetch real — mesmo que o path delas comece com /api.
    let pathname = url, sameOrigin = true;
    try {
      const u = new URL(url, window.location.origin);
      pathname = u.pathname + (u.search || "");
      sameOrigin = u.origin === window.location.origin;
    } catch (_) { /* url relativa simples → same-origin */ }
    if (!sameOrigin || !pathname.startsWith(API_BASE)) return realFetch(input, init);

    const opts = init || (typeof input === "object" ? input : {}) || {};
    const method = (opts.method || "GET");
    const headers = opts.headers || {};
    const authHeader = (typeof headers.get === "function" ? headers.get("Authorization") : (headers.Authorization || headers.authorization)) || "";
    let bodyObj = null;
    if (opts.body) { try { bodyObj = JSON.parse(opts.body); } catch (_) { bodyObj = null; } }

    const apiPath = pathname.slice(API_BASE.length); // remove "/api"
    // Pequena latência pra demo parecer viva (não bloqueia).
    return new Promise((resolve) => {
      setTimeout(() => resolve(route(method, apiPath, bodyObj, authHeader)), 120);
    });
  };
})();
