// Mock estático da API da Contabilidade para a DEMO pública (CD Tech).
// Faz monkeypatch de window.fetch e espelha o contrato de demo/server.mjs:
// empresas, competências, prazos/agenda, saídas, agentes (texto→texto), CRM e
// financeiro. Estado mutável em memória. Carregar APÓS data.js e ANTES de app.js.

(function () {
  const origFetch = window.fetch.bind(window);
  const DB = window.__DEMO__;
  const DISCLAIMER = "Conteúdo gerado por IA — a conferência pelo contador responsável é obrigatória.";
  const comDisc = (t) => `${t}\n\n${DISCLAIMER}`;

  const state = {
    empresas: DB.empresas.map((x) => ({ ...x })),
    competencias: DB.competencias.map((x) => ({ ...x })),
    prazos: DB.prazos.map((x) => ({ ...x })),
    saidas: DB.saidas.map((x) => ({ ...x })),
    leads: DB.leads.map((x) => ({ ...x })),
    receitas: DB.receitas.map((x) => ({ ...x })),
    custos: DB.custos.map((x) => ({ ...x })),
  };
  let seq = 1000;
  const novoId = (p) => `${p}${++seq}`;
  const agora = () => new Date().toISOString();

  const MOCK_AGENTE = {
    enquadramento: () => comDisc("FICHA: empresa de serviços, porte compatível com ME/EPP.\nREGIME SUGERIDO: Simples Nacional (análise preliminar).\nOBRIGAÇÕES: DAS, DCTFWeb, eSocial.\nDOCUMENTOS A SOLICITAR: contrato social, faturamento dos últimos 12 meses, folha.\nPARECER: enquadramento preliminar; confira a apuração efetiva e a legislação vigente."),
    comunicado: () => comDisc("Olá! Segue o resumo do mês: há tributos a pagar conforme as guias que enviaremos e algumas pendências de documentos. Próximos passos: nos envie o que falta para fecharmos a competência no prazo. Qualquer dúvida, estamos à disposição."),
    consultor: () => comDisc("Orientação geral: avalie o porte, a atividade e a projeção de faturamento antes de decidir. Cada regime tem obrigações e impactos diferentes. Recomendo simular os cenários e conferir a legislação vigente para a situação concreta da empresa."),
    fisco: () => comDisc("Ao órgão competente.\nAssunto: resposta à intimação/notificação nº [PREENCHER].\nA empresa vem, respeitosamente, apresentar os esclarecimentos solicitados, anexando os documentos pertinentes e colocando-se à disposição para eventuais diligências."),
  };

  function mockCalendario(empresaId) {
    const D = 86400000, n = Date.now();
    const d = (off) => new Date(n + off * D).toISOString().slice(0, 10);
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
    return { obrigacoes: obrig, prazosGravados: gravados, texto: comDisc("Obrigações da competência gravadas na agenda. Priorize as de vencimento mais próximo; as datas já estão ajustadas para dias úteis.") };
  }

  function jsonResp(data, status = 200) {
    return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
  }

  window.fetch = async function (input, init = {}) {
    const urlStr = typeof input === "string" ? input : (input && input.url) || "";
    let url;
    try { url = new URL(urlStr, location.origin); } catch { return origFetch(input, init); }
    if (!url.pathname.startsWith("/api")) return origFetch(input, init);

    const m = (init.method || "GET").toUpperCase();
    if (m === "OPTIONS") return new Response(null, { status: 204 });
    const path = url.pathname.replace(/^\/api/, "");
    const reg = (s) => s.exec(path);
    let b = {};
    try { b = init.body ? JSON.parse(init.body) : {}; } catch { b = {}; }

    // Empresas
    if (path === "/empresas" && m === "GET") return jsonResp(state.empresas);
    if (path === "/empresas" && m === "POST") {
      if (!b.razaoSocial || !b.regime) return jsonResp({ error: "Empresa inválida" }, 400);
      const row = { id: novoId("emp"), razaoSocial: b.razaoSocial, cnpj: b.cnpj, regime: b.regime, porte: b.porte, criadoEm: agora() };
      state.empresas.push(row);
      return jsonResp(row, 201);
    }
    const delEmp = reg(/^\/empresas\/([^/]+)$/);
    if (delEmp && m === "DELETE") { state.empresas = state.empresas.filter((e) => e.id !== delEmp[1]); return jsonResp({ ok: true }); }

    // Competências
    if (path === "/competencias" && m === "GET") {
      const eid = url.searchParams.get("empresaId");
      return jsonResp(state.competencias.filter((c) => !eid || c.empresaId === eid));
    }
    if (path === "/competencias" && m === "POST") {
      const row = { id: novoId("comp"), empresaId: b.empresaId, ano: Number(b.ano), mes: Number(b.mes), status: b.status ?? "aberta", criadoEm: agora() };
      state.competencias.push(row);
      return jsonResp(row, 201);
    }

    // Prazos / agenda
    if (path === "/prazos" && m === "GET") {
      const eid = url.searchParams.get("empresaId");
      const lista = eid ? state.prazos.filter((p) => p.empresaId === eid) : state.prazos;
      return jsonResp([...lista].sort((a, c) => a.dataFatal.localeCompare(c.dataFatal)));
    }
    if (path === "/prazos" && m === "POST") {
      if (!b.empresaId || !b.sigla || !b.descricao || !/^\d{4}-\d{2}-\d{2}$/.test(b.dataFatal || "")) return jsonResp({ error: "Prazo inválido" }, 400);
      const row = { id: novoId("prz"), empresaId: b.empresaId, sigla: b.sigla, descricao: b.descricao, dataFatal: b.dataFatal, status: "pendente" };
      state.prazos.push(row);
      return jsonResp(row, 201);
    }
    const prazoStatus = reg(/^\/prazos\/([^/]+)\/status$/);
    if (prazoStatus && m === "PUT") {
      if (b.status !== "pendente" && b.status !== "cumprido") return jsonResp({ error: "status inválido" }, 400);
      const row = state.prazos.find((p) => p.id === prazoStatus[1]);
      if (row) row.status = b.status;
      return jsonResp({ ok: true });
    }

    // Saídas
    if (path === "/saidas" && m === "GET") {
      const eid = url.searchParams.get("empresaId");
      const rows = eid ? state.saidas.filter((s) => s.empresaId === eid) : state.saidas;
      return jsonResp([...rows].sort((a, c) => new Date(c.criadoEm) - new Date(a.criadoEm)));
    }

    // Agentes
    if (path === "/agentes/calendario" && m === "POST") {
      const r = mockCalendario(b.empresaId || "sem-empresa");
      state.saidas.push({ id: novoId("sai"), empresaId: b.empresaId, agente: "calendario", titulo: "Calendário de obrigações", conteudo: r.texto, criadoEm: agora() });
      return jsonResp({ titulo: "Calendário de obrigações", ...r }, 201);
    }
    const agMatch = reg(/^\/agentes\/(enquadramento|comunicado|consultor|fisco)$/);
    if (agMatch && m === "POST") {
      const tipo = agMatch[1];
      const titulos = { enquadramento: "Enquadramento preliminar de empresa", comunicado: "Comunicado ao cliente", consultor: "Orientação tributária", fisco: "Minuta de resposta ao Fisco" };
      const row = { id: novoId("sai"), empresaId: b.empresaId ?? null, agente: tipo, titulo: titulos[tipo], conteudo: MOCK_AGENTE[tipo](), criadoEm: agora() };
      state.saidas.push(row);
      return jsonResp(row, 201);
    }

    // CRM: leads
    if (path === "/leads" && m === "GET") return jsonResp([...state.leads].sort((a, c) => new Date(c.criadoEm) - new Date(a.criadoEm)));
    if (path === "/leads" && m === "POST") {
      if (!b.nome) return jsonResp({ error: "Lead inválido" }, 400);
      const row = { id: novoId("lead"), nome: b.nome, contato: b.contato || null, origem: b.origem || null, status: b.status || "novo", empresaId: null, proximaAcao: b.proximaAcao || null, dataAcao: b.dataAcao || null, observacao: b.observacao || null, criadoEm: agora() };
      state.leads.push(row);
      return jsonResp(row, 201);
    }
    const leadConv = reg(/^\/leads\/([^/]+)\/converter$/);
    if (leadConv && m === "POST") {
      const lead = state.leads.find((l) => l.id === leadConv[1]);
      if (!lead) return jsonResp({ error: "Lead não encontrado" }, 404);
      if (lead.empresaId) return jsonResp({ error: "Lead já convertido" }, 409);
      const empresa = { id: novoId("emp"), razaoSocial: lead.nome, cnpj: null, regime: "simples", porte: null, observacao: null, inativo: false, criadoEm: agora() };
      state.empresas.push(empresa);
      lead.status = "convertido";
      lead.empresaId = empresa.id;
      return jsonResp({ lead, empresa }, 201);
    }
    const leadId = reg(/^\/leads\/([^/]+)$/);
    if (leadId && m === "PUT") {
      const r = state.leads.find((l) => l.id === leadId[1]);
      if (r) ["nome", "contato", "origem", "status", "proximaAcao", "dataAcao", "observacao"].forEach((k) => { if (b[k] !== undefined) r[k] = b[k]; });
      return jsonResp(r || {});
    }
    if (leadId && m === "DELETE") { state.leads = state.leads.filter((l) => l.id !== leadId[1]); return jsonResp({ ok: true }); }

    // Financeiro
    if (path === "/receitas" && m === "GET") return jsonResp([...state.receitas].sort((a, c) => new Date(c.criadoEm) - new Date(a.criadoEm)));
    if (path === "/receitas" && m === "POST") {
      const row = { id: novoId("rec"), empresaId: b.empresaId || null, descricao: b.descricao || null, valor: Number(b.valor), tipo: b.tipo, data: b.data || null, criadoEm: agora() };
      state.receitas.push(row);
      return jsonResp(row, 201);
    }
    const recId = reg(/^\/receitas\/([^/]+)$/);
    if (recId && m === "DELETE") { state.receitas = state.receitas.filter((r) => r.id !== recId[1]); return jsonResp({ ok: true }); }

    if (path === "/custos" && m === "GET") return jsonResp([...state.custos].sort((a, c) => new Date(c.criadoEm) - new Date(a.criadoEm)));
    if (path === "/custos" && m === "POST") {
      const row = { id: novoId("cus"), descricao: b.descricao, valor: Number(b.valor), tipo: b.tipo, data: b.data || null, criadoEm: agora() };
      state.custos.push(row);
      return jsonResp(row, 201);
    }
    const cusId = reg(/^\/custos\/([^/]+)$/);
    if (cusId && m === "DELETE") { state.custos = state.custos.filter((c) => c.id !== cusId[1]); return jsonResp({ ok: true }); }

    if (path === "/financeiro" && m === "GET") {
      const round2 = (n) => Math.round(n * 100) / 100;
      const somaT = (arr, t) => round2(arr.filter((x) => x.tipo === t).reduce((a, x) => a + Number(x.valor || 0), 0));
      const mrr = somaT(state.receitas, "recorrente"), fixo = somaT(state.custos, "fixo_mensal"), ads = somaT(state.custos, "anuncios");
      const custoMensalTotal = round2(fixo + ads);
      const convertidos = state.leads.filter((l) => l.empresaId).length;
      return jsonResp({ mrr, receitaUnica: somaT(state.receitas, "unica"), custoFixoMensal: fixo, custoUnico: somaT(state.custos, "unico"), investimentoAnuncios: ads, custoMensalTotal, lucroMensal: round2(mrr - custoMensalTotal), cac: convertidos > 0 ? round2(ads / convertidos) : null, leadsConvertidos: convertidos });
    }

    return jsonResp({ error: "Not Found" }, 404);
  };
})();
