// ════════════════════════════════════════════════════════════════════════
// Painel Contabilidade ZX Control — SPA sem framework (plain JS).
// Auth: demo → login fake (qualquer credencial); prod → Supabase Auth (REST).
// Toda chamada à API leva Bearer token; 401 derruba a sessão (fail-closed).
// Shell estático em index.html; este script preenche os dados e trata eventos.
// ════════════════════════════════════════════════════════════════════════
(() => {
  const ZX = window.ZX || { mode: "prod", apiBase: "/api" };
  const ALERTA_DIAS = ZX.prazoAlertaDias ?? 5; // espelha PRAZO_ALERTA_DIAS (config.ts)
  let token = null;
  let empresasCache = [];
  let agendaPrazos = []; // últimos prazos carregados na aba Agenda (p/ exportar .ics)

  const $ = (id) => document.getElementById(id);
  const esc = (s) =>
    String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  const REGIMES = [
    ["mei", "MEI"],
    ["simples", "Simples Nacional"],
    ["presumido", "Lucro Presumido"],
    ["real", "Lucro Real"],
  ];
  const MESES = ["", "Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const DISCLAIMER = "Conteúdo gerado por IA — a conferência pelo contador responsável é obrigatória.";

  // Enums espelham src/config.ts (LEAD_STATUS, RECEITA_TIPO, CUSTO_TIPO).
  const LEAD_STATUS = [
    ["novo", "Novo"], ["contatado", "Contatado"], ["reuniao_agendada", "Reunião agendada"],
    ["convertido", "Convertido"], ["desqualificado", "Desqualificado"],
  ];
  const RECEITA_TIPO = [["recorrente", "Recorrente (mensal)"], ["unica", "Única"]];
  const CUSTO_TIPO = [["fixo_mensal", "Fixo mensal"], ["unico", "Único"], ["anuncios", "Anúncios"]];
  const fmtBRL = (v) => {
    const n = Number(v || 0).toFixed(2), [i, d] = n.split(".");
    return `R$ ${i.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${d}`;
  };
  const rotulo = (lista, v) => (lista.find((x) => x[0] === v) || [, v])[1];

  const AGENTES = [
    { id: "calendario", n: 1, nome: "Montar o calendário de impostos", desc: "Diga o regime e o mês; eu calculo todas as obrigações com a data certa (já em dia útil) e jogo na sua agenda." },
    { id: "enquadramento", n: 2, nome: "Analisar uma empresa nova", desc: "Me conte sobre a empresa e eu sugiro o regime, as obrigações e quais documentos pedir." },
    { id: "comunicado", n: 3, nome: "Escrever um aviso pro cliente", desc: "Resuma o mês e eu transformo num texto simples e gentil pra você mandar pro empresário." },
    { id: "consultor", n: 4, nome: "Tirar uma dúvida tributária", desc: "Pergunte o que quiser — eu dou uma orientação geral pra te ajudar a pensar." },
    { id: "fisco", n: 5, nome: "Responder o Fisco", desc: "Cole a carta que chegou do governo e eu monto uma minuta de resposta pra você revisar." },
  ];

  // ── Toast ──
  let toastTimer;
  function toast(msg) {
    const t = $("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 3200);
  }

  const SPINNER = `<span class="spinner" aria-hidden="true"></span>`;

  // ── API ──
  async function api(path, { method = "GET", body } = {}) {
    const res = await fetch(ZX.apiBase + path, {
      method,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 401) { logout(); throw new Error("Sua sessão expirou — entre de novo."); }
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `Erro ${res.status}`);
    return res.status === 204 ? null : res.json();
  }

  // ── Auth ──
  async function login(email, senha) {
    if (ZX.mode === "demo") { token = ZX.token; return { email: email || "demo@escritorio.local" }; }
    const res = await fetch(`${ZX.supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: ZX.supabaseAnonKey },
      body: JSON.stringify({ email, password: senha }),
    });
    if (!res.ok) throw new Error("E-mail ou senha inválidos");
    token = (await res.json()).access_token;
    return { email };
  }
  function logout() {
    token = null;
    sessionStorage.removeItem("zx_tok");
    $("app").classList.add("hidden");
    $("login").classList.remove("hidden");
  }

  $("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    $("login-err").textContent = "";
    try {
      const user = await login($("login-email").value.trim(), $("login-pass").value);
      sessionStorage.setItem("zx_tok", token);
      startApp(user.email);
    } catch (err) {
      $("login-err").textContent = err.message;
    }
  });
  $("logout").addEventListener("click", logout);
  if (ZX.mode === "demo") $("login-sub").textContent = "Demo: qualquer e-mail e senha entram.";

  // ── Shell ──
  function startApp(email) {
    $("login").classList.add("hidden");
    $("app").classList.remove("hidden");
    $("userbox").textContent = email;
    $("cards-agentes").innerHTML = AGENTES.map(
      (a) => `<div class="agent-card"><div class="agent-num">ASSISTENTE ${a.n}</div>
        <h3>${esc(a.nome)}</h3><p>${esc(a.desc)}</p>
        <button class="btn btn-primary btn-sm" data-ag="${a.id}">Usar</button></div>`,
    ).join("");
    $("cards-agentes").querySelectorAll("[data-ag]").forEach((b) => b.addEventListener("click", () => abrirAgente(b.dataset.ag)));
    $("tabs").querySelectorAll("button").forEach((b) => b.addEventListener("click", () => render(b.dataset.tab)));
    $("novo-empresa").addEventListener("click", modalNovaEmpresa);
    $("novo-competencia").addEventListener("click", modalNovaCompetencia);
    $("novo-prazo").addEventListener("click", modalNovoPrazo);
    $("ag-emp").addEventListener("change", loadAgenda);
    $("export-ics").addEventListener("click", () =>
      exportarIcs(agendaPrazos.filter((p) => p.status === "pendente"), nomeEmpresa($("ag-emp").value)));
    $("emp-filtro").innerHTML = `<option value="">Todos os regimes</option>` + REGIMES.map(([v, l]) => `<option value="${v}">${l}</option>`).join("");
    $("emp-filtro").addEventListener("change", loadEmpresas);
    $("emp-inativos").addEventListener("change", loadEmpresas);
    $("novo-lead").addEventListener("click", modalNovoLead);
    $("nova-receita").addEventListener("click", modalNovaReceita);
    $("novo-custo").addEventListener("click", modalNovoCusto);
    $("crm-filtro").innerHTML = `<option value="">Todos os status</option>` + LEAD_STATUS.map(([v, l]) => `<option value="${v}">${l}</option>`).join("");
    $("crm-filtro").addEventListener("change", loadCrm);
    render("inicio");
    avisoPrazosLogin();
  }

  function irPara(tab) { render(tab); $("tabs").querySelectorAll("button").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab)); }

  function render(tab) {
    $("tabs").querySelectorAll("button").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
    document.querySelectorAll("[data-view]").forEach((s) => (s.hidden = s.dataset.view !== tab));
    ({ inicio: loadInicio, agentes() {}, empresas: loadEmpresas, crm: loadCrm, competencias: loadCompetencias, agenda: loadAgenda, relatorio: loadRelatorio, saidas: loadSaidas })[tab]();
  }

  // ── Início (painel de situação) ──
  function diasAte(dataFatal) {
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    return Math.round((new Date(dataFatal + "T00:00:00") - hoje) / 86400000);
  }
  function classePrazo(dataFatal) {
    const d = diasAte(dataFatal);
    if (d < 0) return ["vencido", "Vencido"];
    if (d <= ALERTA_DIAS) return ["alerta", d === 0 ? "Vence hoje" : `Em ${d}d`];
    return ["ok", "No prazo"];
  }
  const nomeEmpresa = (id) => empresasCache.find((e) => e.id === id)?.razaoSocial || "—";

  async function avisoPrazosLogin() {
    try {
      const prazos = await api("/prazos");
      const pend = prazos.filter((p) => p.status === "pendente");
      const venc = pend.filter((p) => diasAte(p.dataFatal) < 0).length;
      const perto = pend.filter((p) => { const d = diasAte(p.dataFatal); return d >= 0 && d <= ALERTA_DIAS; }).length;
      if (venc || perto) {
        const partes = [];
        if (venc) partes.push(`${venc} já vencido${venc > 1 ? "s" : ""}`);
        if (perto) partes.push(`${perto} vencendo em até ${ALERTA_DIAS} dias`);
        toast(`⚠ Atenção: ${partes.join(" e ")}. Confira a agenda.`);
      }
    } catch { /* silencioso — o aviso é cortesia, não bloqueia */ }
  }

  async function loadInicio() {
    await carregarEmpresas(true);
    $("dash-cards").innerHTML = `<div class="empty">${SPINNER} Carregando…</div>`;
    const [prazos, comps] = await Promise.all([api("/prazos"), api("/competencias")]);
    const pend = prazos.filter((p) => p.status === "pendente");
    const venc = pend.filter((p) => diasAte(p.dataFatal) < 0);
    const perto = pend.filter((p) => { const d = diasAte(p.dataFatal); return d >= 0 && d <= ALERTA_DIAS; });
    const ativos = empresasCache.filter((e) => !e.inativo).length;
    const abertos = comps.filter((c) => c.status === "aberta").length;

    const card = (cls, num, lbl, tab) =>
      `<button class="stat-card ${cls}" data-go="${tab}"><div class="stat-num">${num}</div><div class="stat-lbl">${lbl}</div></button>`;
    $("dash-cards").innerHTML =
      card("c-red", venc.length, "Prazos vencidos", "agenda") +
      card("c-amber", perto.length, `Vencem em até ${ALERTA_DIAS} dias`, "agenda") +
      card("c-green", ativos, "Clientes ativos", "empresas") +
      card("c-indigo", abertos, "Meses em aberto", "competencias");
    $("dash-cards").querySelectorAll("[data-go]").forEach((b) => b.addEventListener("click", () => irPara(b.dataset.go)));

    const prox = [...venc, ...perto].sort((a, b) => a.dataFatal.localeCompare(b.dataFatal)).slice(0, 6);
    $("dash-prox").innerHTML = prox.length
      ? tabela(["Cliente", "Obrigação", "Vencimento", "Situação"], prox.map((p) => {
          const [cls, lbl] = classePrazo(p.dataFatal);
          return [esc(nomeEmpresa(p.empresaId)), esc(p.sigla), `<span class="mono">${p.dataFatal.split("-").reverse().join("/")}</span>`, `<span class="badge ${cls}">${lbl}</span>`];
        }), prox.map((p) => classePrazo(p.dataFatal)[0]))
      : `<div class="table-wrap"><div class="empty">🎉 Tudo em dia! Nenhum prazo vencido ou próximo.</div></div>`;
  }

  // ── Assistentes ──
  async function abrirAgente(id) {
    await carregarEmpresas();
    const ag = AGENTES.find((a) => a.id === id);
    const ativas = empresasCache.filter((e) => !e.inativo);
    const empOpts = `<option value="">— selecione —</option>` + ativas.map((e) => `<option value="${e.id}" data-regime="${e.regime}">${esc(e.razaoSocial)}</option>`).join("");
    const campos = {
      calendario: `
        <label class="field"><span>Cliente</span><select id="f-empresa">${empOpts}</select></label>
        <label class="field"><span>Regime tributário</span><select id="f-regime">${REGIMES.map(([v, l]) => `<option value="${v}">${l}</option>`).join("")}</select></label>
        <div style="display:flex;gap:10px">
          <label class="field" style="flex:1"><span>Mês</span><input class="mono" id="f-mes" type="number" min="1" max="12" value="1" /></label>
          <label class="field" style="flex:1"><span>Ano</span><input class="mono" id="f-ano" type="number" min="2000" max="2100" value="2026" /></label>
        </div>`,
      enquadramento: `<label class="field"><span>Cliente (opcional)</span><select id="f-empresa">${empOpts}</select></label>
        <label class="field"><span>O que você sabe sobre a empresa</span><textarea id="f-dados" placeholder="Ex.: loja de roupas, fatura uns R$ 30 mil por mês, 2 sócios, 3 funcionários registrados..."></textarea></label>`,
      comunicado: `<label class="field"><span>Cliente (opcional)</span><select id="f-empresa">${empOpts}</select></label>
        <label class="field"><span>O que aconteceu neste mês com este cliente?</span><textarea id="f-situacao" placeholder="Ex.: tem o DAS pra pagar dia 20, faltou enviar 2 notas, e o eSocial já foi entregue..."></textarea></label>`,
      consultor: `<label class="field"><span>Qual é a sua dúvida?</span><textarea id="f-pergunta" placeholder="Ex.: meu cliente quer sair do Lucro Presumido pro Simples, o que eu preciso considerar?"></textarea></label>`,
      fisco: `<label class="field"><span>Cliente (opcional)</span><select id="f-empresa">${empOpts}</select></label>
        <label class="field"><span>Cole aqui a carta ou e-mail que chegou do governo</span><textarea id="f-intimacao" placeholder="Cole o texto da intimação ou notificação recebida do Fisco..."></textarea></label>
        <label class="field"><span>Quer acrescentar alguma observação? (opcional)</span><input id="f-obs" /></label>`,
    }[id];

    openModal(ag.nome, `${campos}<div id="ag-out"></div>`, async () => {
      const out = $("ag-out");
      out.innerHTML = `<div class="output">${SPINNER} Gerando, só um instante…</div>`;
      try {
        const r = await executarAgente(id);
        out.innerHTML = renderOutput(r.texto ?? r.conteudo ?? "");
        toast("Pronto! Salvei em “O que já gerei”.");
      } catch (err) {
        out.innerHTML = `<div class="output">Não consegui gerar agora: ${esc(err.message)}</div>`;
      }
      return false; // mantém aberto pra ler/copiar
    }, "Gerar");
    const sel = $("f-empresa"), reg = $("f-regime");
    if (sel && reg) sel.addEventListener("change", () => {
      const o = sel.selectedOptions[0];
      if (o && o.dataset.regime) reg.value = o.dataset.regime;
    });
  }

  async function executarAgente(id) {
    if (id === "calendario") {
      return api("/agentes/calendario", { method: "POST", body: {
        empresaId: $("f-empresa").value || "sem-empresa",
        regime: $("f-regime").value,
        competencia: { ano: Number($("f-ano").value), mes: Number($("f-mes").value) },
      }});
    }
    const empresaId = $("f-empresa")?.value || undefined;
    if (id === "enquadramento") return api("/agentes/enquadramento", { method: "POST", body: { empresaId, dados: $("f-dados").value } });
    if (id === "comunicado") {
      const nome = $("f-empresa")?.selectedOptions[0]?.textContent;
      return api("/agentes/comunicado", { method: "POST", body: { empresaId, empresaNome: empresaId ? nome : undefined, situacao: $("f-situacao").value } });
    }
    if (id === "consultor") return api("/agentes/consultor", { method: "POST", body: { pergunta: $("f-pergunta").value } });
    return api("/agentes/fisco", { method: "POST", body: { empresaId, intimacao: $("f-intimacao").value, observacoes: $("f-obs").value || undefined } });
  }

  function renderOutput(texto) {
    const corpo = texto.replace(DISCLAIMER, "").trimEnd();
    return `<div class="output" data-texto="${esc(encodeURIComponent(texto))}">${esc(corpo)}<span class="disclaimer">⚠ ${DISCLAIMER}</span>
      <div class="row-actions" style="margin-top:12px">
        <button class="btn btn-sm" data-copy>Copiar</button>
        <button class="btn btn-sm" data-dl>Baixar .txt</button>
        <button class="btn btn-sm" data-pdf>Salvar PDF</button>
      </div></div>`;
  }
  document.addEventListener("click", (e) => {
    const box = e.target.closest(".output");
    if (!box) return;
    const texto = decodeURIComponent(box.dataset.texto || "");
    if (e.target.matches("[data-copy]")) { navigator.clipboard?.writeText(texto); toast("Copiado."); }
    else if (e.target.matches("[data-dl]")) {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([texto], { type: "text/plain" }));
      a.download = "contabilidade-zx.txt";
      a.click();
    } else if (e.target.matches("[data-pdf]")) {
      imprimirPDF(texto);
    }
  });

  // Exporta a saída como PDF via janela de impressão limpa (sem dependência externa).
  function imprimirPDF(texto) {
    const w = window.open("", "_blank", "width=720,height=900");
    if (!w) { toast("Permita pop-ups para salvar o PDF."); return; }
    const esq = texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    w.document.write(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8">
      <title>Contabilidade ZX Control</title><style>
      body{font-family:Georgia,'Times New Roman',serif;color:#111;line-height:1.6;max-width:680px;margin:48px auto;padding:0 24px;white-space:pre-wrap}
      .top{font-family:Arial,sans-serif;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#92400e;border-bottom:2px solid #D97706;padding-bottom:8px;margin-bottom:24px}
      </style></head><body><div class="top">Contabilidade ZX Control</div>${esq}</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); }, 250);
  }

  // ── Clientes ──
  async function carregarEmpresas(force) { if (force || !empresasCache.length) empresasCache = await api("/empresas"); return empresasCache; }
  const regimeLabel = (r) => (REGIMES.find((x) => x[0] === r) || [, r])[1];

  async function loadEmpresas() {
    empresasCache = await api("/empresas");
    const filtro = $("emp-filtro").value;
    const incInativos = $("emp-inativos").checked;
    const emp = empresasCache.filter((e) => (incInativos || !e.inativo) && (!filtro || e.regime === filtro));
    $("emp-tbl").innerHTML = emp.length
      ? tabela(["Cliente", "CNPJ", "Regime", "Porte", "Observação", ""], emp.map((e) => [
          `${esc(e.razaoSocial)}${e.inativo ? ` <span class="badge fechada">inativo</span>` : ""}`,
          `<span class="mono">${esc(e.cnpj || "—")}</span>`,
          `<span class="badge regime">${esc(regimeLabel(e.regime))}</span>`,
          esc(e.porte || "—"),
          `<span class="obs">${esc(e.observacao || "—")}</span>`,
          `<div class="row-actions">
             <button class="btn btn-sm" data-edit="${e.id}">Editar</button>
             <button class="btn btn-sm" data-toggle="${e.id}">${e.inativo ? "Reativar" : "Arquivar"}</button>
           </div>`,
        ]), emp.map((e) => (e.inativo ? "inativo" : "")))
      : vazioAcao(filtro || incInativos ? "Nenhum cliente com esse filtro." : "Você ainda não tem clientes. Que tal cadastrar o primeiro?", "+ Novo cliente", modalNovaEmpresa);
    $("emp-tbl").querySelectorAll("[data-edit]").forEach((b) => b.addEventListener("click", () => modalEditarEmpresa(b.dataset.edit)));
    $("emp-tbl").querySelectorAll("[data-toggle]").forEach((b) => b.addEventListener("click", async () => {
      const e = empresasCache.find((x) => x.id === b.dataset.toggle);
      await api(`/empresas/${b.dataset.toggle}`, { method: "PUT", body: { inativo: !e.inativo } });
      toast(e.inativo ? "Cliente reativado." : "Cliente arquivado (histórico preservado).");
      loadEmpresas();
    }));
  }

  function camposEmpresa(e = {}) {
    return `
      <label class="field"><span>Nome do cliente *</span><input id="m-razao" value="${esc(e.razaoSocial || "")}" placeholder="Razão social" /></label>
      <label class="field"><span>CNPJ <span style="text-transform:none;font-weight:400;color:var(--muted)">— digite e clique em buscar para preencher sozinho</span></span>
        <div style="display:flex;gap:8px">
          <input class="mono" id="m-cnpj" value="${esc(e.cnpj || "")}" placeholder="00.000.000/0000-00" style="flex:1" />
          <button type="button" class="btn btn-sm" id="m-cnpj-go" style="white-space:nowrap">Buscar dados</button>
        </div>
      </label>
      <label class="field"><span>Regime *</span><select id="m-regime">${REGIMES.map(([v, l]) => `<option value="${v}" ${e.regime === v ? "selected" : ""}>${l}</option>`).join("")}</select></label>
      <label class="field"><span>Porte</span><input id="m-porte" value="${esc(e.porte || "")}" placeholder="ME, EPP, Demais..." /></label>
      <label class="field"><span>Anotações sobre o cliente</span><textarea id="m-obs" placeholder="Ex.: paga sempre atrasado, aguardando abertura de filial, sócio saindo...">${esc(e.observacao || "")}</textarea></label>`;
  }
  function modalNovaEmpresa() {
    openModal("Novo cliente", camposEmpresa(), async () => {
      const razaoSocial = $("m-razao").value.trim();
      if (!razaoSocial) { toast("Informe o nome do cliente."); return false; }
      await api("/empresas", { method: "POST", body: { razaoSocial, cnpj: $("m-cnpj").value || undefined, regime: $("m-regime").value, porte: $("m-porte").value || undefined, observacao: $("m-obs").value || undefined } });
      toast("Cliente cadastrado."); loadEmpresas(); return true;
    });
    wireCnpj();
  }
  function modalEditarEmpresa(id) {
    const e = empresasCache.find((x) => x.id === id);
    if (!e) return;
    openModal("Editar cliente", camposEmpresa(e), async () => {
      const razaoSocial = $("m-razao").value.trim();
      if (!razaoSocial) { toast("Informe o nome do cliente."); return false; }
      await api(`/empresas/${id}`, { method: "PUT", body: { razaoSocial, cnpj: $("m-cnpj").value || undefined, regime: $("m-regime").value, porte: $("m-porte").value || undefined, observacao: $("m-obs").value || undefined } });
      toast("Cliente atualizado."); loadEmpresas(); return true;
    });
    wireCnpj();
  }

  // ── Consulta de CNPJ (BrasilAPI, pública) ──
  function wireCnpj() { const b = $("m-cnpj-go"); if (b) b.onclick = buscarCnpj; }
  async function buscarCnpj() {
    const raw = ($("m-cnpj").value || "").replace(/\D/g, "");
    if (raw.length !== 14) { toast("Digite os 14 dígitos do CNPJ."); return; }
    const btn = $("m-cnpj-go"), label = btn.textContent;
    btn.innerHTML = SPINNER; btn.disabled = true;
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${raw}`);
      if (!res.ok) throw new Error("CNPJ não encontrado na Receita.");
      const d = await res.json();
      if (d.razao_social) $("m-razao").value = d.razao_social;
      const porteMap = { "MICRO EMPRESA": "ME", "EMPRESA DE PEQUENO PORTE": "EPP", "DEMAIS": "Demais" };
      if (d.porte && porteMap[d.porte]) $("m-porte").value = porteMap[d.porte];
      if (d.opcao_pelo_mei) $("m-regime").value = "mei";
      else if (d.opcao_pelo_simples) $("m-regime").value = "simples";
      if (!$("m-obs").value && d.cnae_fiscal_descricao) $("m-obs").value = `Atividade principal: ${d.cnae_fiscal_descricao}.`;
      const sit = d.descricao_situacao_cadastral;
      toast(sit && sit !== "ATIVA" ? `Preenchido. Atenção: situação cadastral ${sit}.` : "Dados do CNPJ preenchidos. Confira o regime.");
    } catch (err) {
      toast(err.message || "Não consegui consultar o CNPJ agora.");
    } finally {
      btn.textContent = label; btn.disabled = false;
    }
  }

  // ── Exportar agenda (.ics) ──
  function exportarIcs(prazos, nomeEmp) {
    if (!prazos.length) { toast("Nada para exportar nesta agenda."); return; }
    const pad = (n) => String(n).padStart(2, "0");
    const sane = (t) => String(t || "").replace(/[\\,;]/g, " ").replace(/\n/g, " ");
    const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//ZX Control//Contabilidade//PT-BR", "CALSCALE:GREGORIAN"];
    prazos.forEach((p) => {
      const ini = p.dataFatal.replace(/-/g, "");
      const fim = new Date(p.dataFatal + "T00:00:00"); fim.setDate(fim.getDate() + 1);
      const fimStr = `${fim.getFullYear()}${pad(fim.getMonth() + 1)}${pad(fim.getDate())}`;
      lines.push(
        "BEGIN:VEVENT",
        `UID:${p.id}@contabilidade-zxcontrol`,
        `DTSTART;VALUE=DATE:${ini}`,
        `DTEND;VALUE=DATE:${fimStr}`,
        `SUMMARY:${sane(p.sigla)} — ${sane(nomeEmp)}`,
        `DESCRIPTION:${sane(p.descricao)}`,
        "BEGIN:VALARM", "TRIGGER:-P1D", "ACTION:DISPLAY", "DESCRIPTION:Prazo fiscal vence amanhã", "END:VALARM",
        "END:VEVENT",
      );
    });
    lines.push("END:VCALENDAR");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([lines.join("\r\n")], { type: "text/calendar" }));
    a.download = `agenda-${String(nomeEmp || "zx").replace(/\W+/g, "-").toLowerCase()}.ics`;
    a.click();
    toast(`Agenda exportada (${prazos.length} prazo${prazos.length > 1 ? "s" : ""}).`);
  }

  // ── Roll-forward: gera o mês seguinte com os prazos ──
  async function rollForward(c) {
    const emp = empresasCache.find((e) => e.id === c.empresaId);
    if (!emp) { toast("Cliente não encontrado."); return; }
    const mes = c.mes === 12 ? 1 : c.mes + 1;
    const ano = c.mes === 12 ? c.ano + 1 : c.ano;
    const comps = await api(`/competencias?empresaId=${encodeURIComponent(c.empresaId)}`);
    if (comps.some((x) => x.ano === ano && x.mes === mes)) { toast(`${MESES[mes]}/${ano} já existe para este cliente.`); return; }
    toast(`Gerando ${MESES[mes]}/${ano}…`);
    await api("/competencias", { method: "POST", body: { empresaId: c.empresaId, ano, mes } });
    await api("/agentes/calendario", { method: "POST", body: { empresaId: c.empresaId, regime: emp.regime, competencia: { ano, mes } } });
    toast(`${MESES[mes]}/${ano} criado com os prazos. ✅`);
    loadCompetencias();
  }

  // ── Meses de trabalho ──
  async function loadCompetencias() {
    await carregarEmpresas();
    const comps = await api("/competencias");
    $("comp-tbl").innerHTML = comps.length
      ? tabela(["Cliente", "Período", "Situação", ""], comps.map((c) => [
          esc(nomeEmpresa(c.empresaId)),
          `<span class="mono">${MESES[c.mes]}/${c.ano}</span>`,
          `<span class="badge ${c.status}">${c.status === "aberta" ? "em aberto" : "concluído"}</span>`,
          `<div class="row-actions">${
            c.status === "aberta"
              ? `<button class="btn btn-sm" data-fechar="${c.id}">Concluir mês</button>`
              : `<button class="btn btn-sm" data-reabrir="${c.id}">Reabrir</button>`
          }<button class="btn btn-sm" data-roll="${c.id}">Gerar próximo mês →</button></div>`,
        ]))
      : vazioAcao("Nenhum mês de trabalho cadastrado ainda.", "+ Novo período", modalNovaCompetencia);
    $("comp-tbl").querySelectorAll("[data-roll]").forEach((b) => b.addEventListener("click", () => {
      const c = comps.find((x) => x.id === b.dataset.roll);
      if (c) rollForward(c);
    }));
    $("comp-tbl").querySelectorAll("[data-fechar]").forEach((b) => b.addEventListener("click", async () => {
      await api(`/competencias/${b.dataset.fechar}/status`, { method: "PUT", body: { status: "fechada" } });
      toast("Mês concluído. 👍"); loadCompetencias();
    }));
    $("comp-tbl").querySelectorAll("[data-reabrir]").forEach((b) => b.addEventListener("click", async () => {
      await api(`/competencias/${b.dataset.reabrir}/status`, { method: "PUT", body: { status: "aberta" } });
      toast("Mês reaberto."); loadCompetencias();
    }));
  }
  function modalNovaCompetencia() {
    if (!empresasCache.filter((e) => !e.inativo).length) { toast("Cadastre um cliente primeiro."); return; }
    const opts = empresasCache.filter((e) => !e.inativo).map((e) => `<option value="${e.id}">${esc(e.razaoSocial)}</option>`).join("");
    openModal("Novo mês de trabalho", `
      <label class="field"><span>Cliente *</span><select id="m-emp">${opts}</select></label>
      <div style="display:flex;gap:10px">
        <label class="field" style="flex:1"><span>Mês *</span><select id="m-mes" class="mono">${MESES.slice(1).map((m, i) => `<option value="${i + 1}">${m}</option>`).join("")}</select></label>
        <label class="field" style="flex:1"><span>Ano *</span><input class="mono" id="m-ano" type="number" min="2000" max="2100" value="2026" /></label>
      </div>`,
      async () => {
        await api("/competencias", { method: "POST", body: { empresaId: $("m-emp").value, mes: Number($("m-mes").value), ano: Number($("m-ano").value) } });
        toast("Período criado."); loadCompetencias(); return true;
      });
  }

  // ── Agenda de prazos ──
  async function loadAgenda() {
    await carregarEmpresas();
    const ativas = empresasCache.filter((e) => !e.inativo);
    const sel = $("ag-emp");
    if (sel.options.length !== ativas.length || !sel.dataset.filled) {
      sel.innerHTML = ativas.map((e) => `<option value="${e.id}">${esc(e.razaoSocial)}</option>`).join("") || `<option value="">cadastre um cliente</option>`;
      sel.dataset.filled = "1";
    }
    if (!sel.value) { agendaPrazos = []; $("ag-tbl").innerHTML = vazio("Selecione um cliente para ver os prazos."); return; }
    const prazos = await api(`/prazos?empresaId=${encodeURIComponent(sel.value)}`);
    agendaPrazos = prazos;
    $("ag-tbl").innerHTML = prazos.length
      ? tabela(["Obrigação", "Vencimento", "Situação", "Status", ""], prazos.map((p) => {
          const [cls, lbl] = classePrazo(p.dataFatal);
          return [
            `${esc(p.sigla)} <span style="color:var(--muted)">— ${esc(p.descricao)}</span>`,
            `<span class="mono">${p.dataFatal.split("-").reverse().join("/")}</span>`,
            `<span class="badge ${cls}">${lbl}</span>`,
            `<span class="badge ${p.status}">${p.status === "pendente" ? "a fazer" : "feito"}</span>`,
            p.status === "pendente" ? `<button class="btn btn-sm" data-done="${p.id}">Já paguei / entreguei</button>` : "",
          ];
        }), prazos.map((p) => (p.status === "cumprido" ? "" : classePrazo(p.dataFatal)[0])))
      : vazioAcao("Sem prazos pra este cliente ainda.", "Montar calendário de impostos", () => abrirAgente("calendario"));
    $("ag-tbl").querySelectorAll("[data-done]").forEach((b) => b.addEventListener("click", async () => {
      await api(`/prazos/${b.dataset.done}/status`, { method: "PUT", body: { status: "cumprido" } });
      toast("Boa! Marquei como feito."); loadAgenda();
    }));
  }
  function modalNovoPrazo() {
    const ativas = empresasCache.filter((e) => !e.inativo);
    if (!ativas.length) { toast("Cadastre um cliente primeiro."); return; }
    const opts = ativas.map((e) => `<option value="${e.id}" ${e.id === $("ag-emp").value ? "selected" : ""}>${esc(e.razaoSocial)}</option>`).join("");
    openModal("Novo prazo", `
      <label class="field"><span>Cliente *</span><select id="m-emp">${opts}</select></label>
      <label class="field"><span>Obrigação (sigla) *</span><input id="m-sigla" placeholder="DAS, DCTFWeb, ISS..." /></label>
      <label class="field"><span>Descrição *</span><input id="m-desc" /></label>
      <label class="field"><span>Vencimento *</span><input class="mono" id="m-data" type="date" /></label>`,
      async () => {
        const sigla = $("m-sigla").value.trim(), descricao = $("m-desc").value.trim(), dataFatal = $("m-data").value;
        if (!sigla || !descricao || !dataFatal) { toast("Preencha sigla, descrição e vencimento."); return false; }
        await api("/prazos", { method: "POST", body: { empresaId: $("m-emp").value, sigla, descricao, dataFatal } });
        toast("Prazo adicionado.");
        $("ag-emp").value = $("m-emp").value; loadAgenda(); return true;
      });
  }

  // ── Histórico ──
  async function loadSaidas() {
    await carregarEmpresas();
    const saidas = await api("/saidas");
    const TIPO = { calendario: "Calendário", enquadramento: "Análise de empresa", comunicado: "Aviso ao cliente", consultor: "Dúvida tributária", fisco: "Resposta ao Fisco" };
    $("sa-tbl").innerHTML = saidas.length
      ? tabela(["Tipo", "Título", "Cliente", "Quando", ""], saidas.map((s) => [
          `<span class="badge regime">${esc(TIPO[s.agente] || s.agente)}</span>`,
          esc(s.titulo),
          esc(nomeEmpresa(s.empresaId)),
          `<span class="mono">${new Date(s.criadoEm).toLocaleDateString("pt-BR")}</span>`,
          `<button class="btn btn-sm" data-ver="${esc(encodeURIComponent(s.conteudo))}">Ver</button>`,
        ]))
      : vazioAcao("Você ainda não gerou nada. Comece por um assistente.", "Ver assistentes", () => irPara("agentes"));
    $("sa-tbl").querySelectorAll("[data-ver]").forEach((b) => b.addEventListener("click", () => {
      openModal("O que eu gerei", `<div id="ag-out">${renderOutput(decodeURIComponent(b.dataset.ver))}</div>`, null, null, "Fechar");
    }));
  }

  // ── Relatório do escritório ──
  const statBox = (cls, num, lbl) => `<div class="stat-card static ${cls}"><div class="stat-num">${num}</div><div class="stat-lbl">${lbl}</div></div>`;
  async function loadRelatorio() {
    await carregarEmpresas(true);
    $("rel-cards").innerHTML = `<div class="empty">${SPINNER} Calculando…</div>`;
    $("rel-rank").innerHTML = "";
    const [prazos, comps] = await Promise.all([api("/prazos"), api("/competencias")]);
    const total = prazos.length;
    const cumpridos = prazos.filter((p) => p.status === "cumprido").length;
    const atrasados = prazos.filter((p) => p.status === "pendente" && diasAte(p.dataFatal) < 0);
    const pctConcl = total ? Math.round((cumpridos / total) * 100) : 0;
    const ativos = empresasCache.filter((e) => !e.inativo);
    const idsAtraso = new Set(atrasados.map((p) => p.empresaId));
    const comAtraso = ativos.filter((e) => idsAtraso.has(e.id)).length;
    const emDia = ativos.length - comAtraso;
    const abertos = comps.filter((c) => c.status === "aberta").length;

    $("rel-cards").innerHTML =
      statBox("c-green", `${pctConcl}%`, `Obrigações concluídas (${cumpridos}/${total})`) +
      statBox("c-red", atrasados.length, "Prazos atrasados") +
      statBox("c-green", emDia, "Clientes em dia") +
      statBox("c-amber", comAtraso, "Clientes com atraso") +
      statBox("c-indigo", abertos, "Meses em aberto");

    const cont = {};
    atrasados.forEach((p) => (cont[p.empresaId] = (cont[p.empresaId] || 0) + 1));
    const ranking = Object.entries(cont).sort((a, b) => b[1] - a[1]).slice(0, 8);
    $("rel-rank").innerHTML = ranking.length
      ? tabela(["Cliente", "Prazos atrasados"], ranking.map(([id, n]) => [esc(nomeEmpresa(id)), `<span class="mono">${n}</span>`]), ranking.map(() => "vencido"))
      : `<div class="table-wrap"><div class="empty">🎉 Nenhum cliente com atraso. Operação em dia!</div></div>`;
    loadFinanceiro();
  }

  // ── CRM (leads) ──
  async function loadCrm() {
    await carregarEmpresas();
    const leads = await api("/leads");
    const cont = {}; LEAD_STATUS.forEach(([v]) => (cont[v] = 0));
    leads.forEach((l) => (cont[l.status] = (cont[l.status] || 0) + 1));
    $("crm-funil").innerHTML = LEAD_STATUS.map(([v, l]) =>
      `<div class="stat-card static"><div class="stat-num" style="font-size:1.6rem">${cont[v] || 0}</div><div class="stat-lbl">${l}</div></div>`).join("");

    const filtro = $("crm-filtro").value;
    const lista = filtro ? leads.filter((l) => l.status === filtro) : leads;
    $("crm-tbl").innerHTML = lista.length
      ? tabela(["Nome", "Contato", "Origem", "Status", "Próxima ação", ""], lista.map((l) => [
          esc(l.nome),
          esc(l.contato || "—"),
          esc(l.origem || "—"),
          l.status === "convertido"
            ? `<span class="badge ok">convertido</span>`
            : `<select class="lead-status" data-lead="${l.id}" style="padding:5px 8px;font-size:12px;width:auto">${
                LEAD_STATUS.filter(([v]) => v !== "convertido").map(([v, lab]) => `<option value="${v}" ${v === l.status ? "selected" : ""}>${lab}</option>`).join("")
              }</select>`,
          l.proximaAcao ? `${esc(l.proximaAcao)}${l.dataAcao ? ` <span class="mono" style="color:var(--muted)">(${l.dataAcao.split("-").reverse().join("/")})</span>` : ""}` : "—",
          `<div class="row-actions">${l.status !== "convertido" ? `<button class="btn btn-sm btn-primary" data-conv="${l.id}">Converter</button>` : ""}<button class="btn btn-sm" data-edlead="${l.id}">Editar</button><button class="btn btn-sm btn-danger" data-dellead="${l.id}">Excluir</button></div>`,
        ]))
      : vazioAcao("Nenhum lead ainda. Cadastre o primeiro contato.", "+ Novo lead", modalNovoLead);

    $("crm-tbl").querySelectorAll(".lead-status").forEach((s) => s.addEventListener("change", async () => {
      await api(`/leads/${s.dataset.lead}`, { method: "PUT", body: { status: s.value } });
      toast("Status atualizado."); loadCrm();
    }));
    $("crm-tbl").querySelectorAll("[data-conv]").forEach((b) => b.addEventListener("click", async () => {
      await api(`/leads/${b.dataset.conv}/converter`, { method: "POST" });
      toast("Lead convertido em cliente! 🎉"); await carregarEmpresas(true); loadCrm();
    }));
    $("crm-tbl").querySelectorAll("[data-edlead]").forEach((b) => b.addEventListener("click", () => modalEditarLead(leads.find((l) => l.id === b.dataset.edlead))));
    $("crm-tbl").querySelectorAll("[data-dellead]").forEach((b) => b.addEventListener("click", async () => {
      await api(`/leads/${b.dataset.dellead}`, { method: "DELETE" }); toast("Lead excluído."); loadCrm();
    }));
  }
  function camposLead(l = {}) {
    return `
      <label class="field"><span>Nome *</span><input id="l-nome" value="${esc(l.nome || "")}" /></label>
      <label class="field"><span>Contato</span><input id="l-contato" value="${esc(l.contato || "")}" placeholder="telefone, e-mail..." /></label>
      <label class="field"><span>Origem</span><input id="l-origem" value="${esc(l.origem || "")}" placeholder="indicação, Instagram, Google..." /></label>
      <label class="field"><span>Status</span><select id="l-status">${LEAD_STATUS.filter(([v]) => v !== "convertido").map(([v, lab]) => `<option value="${v}" ${v === (l.status || "novo") ? "selected" : ""}>${lab}</option>`).join("")}</select></label>
      <div style="display:flex;gap:10px">
        <label class="field" style="flex:2"><span>Próxima ação</span><input id="l-acao" value="${esc(l.proximaAcao || "")}" placeholder="ligar, enviar proposta..." /></label>
        <label class="field" style="flex:1"><span>Quando</span><input class="mono" id="l-dataacao" type="date" value="${esc(l.dataAcao || "")}" /></label>
      </div>
      <label class="field"><span>Observação</span><textarea id="l-obs">${esc(l.observacao || "")}</textarea></label>`;
  }
  const corpoLead = () => ({
    nome: $("l-nome").value.trim(), contato: $("l-contato").value || undefined, origem: $("l-origem").value || undefined,
    status: $("l-status").value, proximaAcao: $("l-acao").value || undefined, dataAcao: $("l-dataacao").value || undefined,
    observacao: $("l-obs").value || undefined,
  });
  function modalNovoLead() {
    openModal("Novo lead", camposLead(), async () => {
      if (!$("l-nome").value.trim()) { toast("Informe o nome."); return false; }
      await api("/leads", { method: "POST", body: corpoLead() });
      toast("Lead cadastrado."); loadCrm(); return true;
    });
  }
  function modalEditarLead(l) {
    if (!l) return;
    openModal("Editar lead", camposLead(l), async () => {
      if (!$("l-nome").value.trim()) { toast("Informe o nome."); return false; }
      await api(`/leads/${l.id}`, { method: "PUT", body: corpoLead() });
      toast("Lead atualizado."); loadCrm(); return true;
    });
  }

  // ── Relatórios Financeiros (receitas/custos + métricas) ──
  async function loadFinanceiro() {
    await carregarEmpresas();
    const [fin, receitas, custos] = await Promise.all([api("/financeiro"), api("/receitas"), api("/custos")]);
    $("fin-cards").innerHTML =
      statBox("c-green", fmtBRL(fin.mrr), "Receita recorrente (MRR)") +
      statBox("c-amber", fmtBRL(fin.custoMensalTotal), "Custo mensal (fixo + ads)") +
      statBox(fin.lucroMensal >= 0 ? "c-green" : "c-red", fmtBRL(fin.lucroMensal), "Lucro mensal estimado") +
      statBox("c-indigo", fin.cac != null ? fmtBRL(fin.cac) : "—", `CAC · ${fin.leadsConvertidos} convertidos`);

    $("rec-tbl").innerHTML = receitas.length
      ? tabela(["Descrição", "Cliente", "Valor", "Tipo", ""], receitas.map((r) => [
          esc(r.descricao || "—"), esc(nomeEmpresa(r.empresaId)), `<span class="mono">${fmtBRL(r.valor)}</span>`,
          `<span class="badge ${r.tipo === "recorrente" ? "ok" : "regime"}">${r.tipo === "recorrente" ? "recorrente" : "única"}</span>`,
          `<button class="btn btn-sm btn-danger" data-delrec="${r.id}">Excluir</button>`,
        ]))
      : vazioAcao("Nenhuma receita lançada.", "+ Nova receita", modalNovaReceita);
    $("cus-tbl").innerHTML = custos.length
      ? tabela(["Descrição", "Valor", "Tipo", ""], custos.map((c) => [
          esc(c.descricao), `<span class="mono">${fmtBRL(c.valor)}</span>`,
          `<span class="badge ${c.tipo === "anuncios" ? "alerta" : "fechada"}">${esc(rotulo(CUSTO_TIPO, c.tipo))}</span>`,
          `<button class="btn btn-sm btn-danger" data-delcus="${c.id}">Excluir</button>`,
        ]))
      : vazioAcao("Nenhum custo lançado.", "+ Novo custo", modalNovoCusto);

    $("rec-tbl").querySelectorAll("[data-delrec]").forEach((b) => b.addEventListener("click", async () => {
      await api(`/receitas/${b.dataset.delrec}`, { method: "DELETE" }); toast("Receita excluída."); loadFinanceiro();
    }));
    $("cus-tbl").querySelectorAll("[data-delcus]").forEach((b) => b.addEventListener("click", async () => {
      await api(`/custos/${b.dataset.delcus}`, { method: "DELETE" }); toast("Custo excluído."); loadFinanceiro();
    }));
  }
  function modalNovaReceita() {
    const opts = `<option value="">— sem cliente —</option>` + empresasCache.map((e) => `<option value="${e.id}">${esc(e.razaoSocial)}</option>`).join("");
    openModal("Nova receita", `
      <label class="field"><span>Descrição</span><input id="r-desc" placeholder="Honorários mensais, consultoria..." /></label>
      <label class="field"><span>Cliente (opcional)</span><select id="r-emp">${opts}</select></label>
      <div style="display:flex;gap:10px">
        <label class="field" style="flex:1"><span>Valor (R$) *</span><input class="mono" id="r-valor" type="number" min="0" step="0.01" /></label>
        <label class="field" style="flex:1"><span>Tipo *</span><select id="r-tipo">${RECEITA_TIPO.map(([v, l]) => `<option value="${v}">${l}</option>`).join("")}</select></label>
      </div>
      <label class="field"><span>Data</span><input class="mono" id="r-data" type="date" /></label>`,
      async () => {
        if (!$("r-valor").value) { toast("Informe o valor."); return false; }
        await api("/receitas", { method: "POST", body: { descricao: $("r-desc").value || undefined, empresaId: $("r-emp").value || undefined, valor: Number($("r-valor").value), tipo: $("r-tipo").value, data: $("r-data").value || undefined } });
        toast("Receita lançada."); loadFinanceiro(); return true;
      });
  }
  function modalNovoCusto() {
    openModal("Novo custo", `
      <label class="field"><span>Descrição *</span><input id="c-desc" placeholder="Aluguel, software, anúncios..." /></label>
      <div style="display:flex;gap:10px">
        <label class="field" style="flex:1"><span>Valor (R$) *</span><input class="mono" id="c-valor" type="number" min="0" step="0.01" /></label>
        <label class="field" style="flex:1"><span>Tipo *</span><select id="c-tipo">${CUSTO_TIPO.map(([v, l]) => `<option value="${v}">${l}</option>`).join("")}</select></label>
      </div>
      <label class="field"><span>Data</span><input class="mono" id="c-data" type="date" /></label>`,
      async () => {
        if (!$("c-desc").value.trim()) { toast("Informe a descrição."); return false; }
        if (!$("c-valor").value) { toast("Informe o valor."); return false; }
        await api("/custos", { method: "POST", body: { descricao: $("c-desc").value.trim(), valor: Number($("c-valor").value), tipo: $("c-tipo").value, data: $("c-data").value || undefined } });
        toast("Custo lançado."); loadFinanceiro(); return true;
      });
  }

  // ── Helpers de UI ──
  function tabela(cols, linhas, rowCls) {
    return `<div class="table-wrap"><table><thead><tr>${cols.map((c) => `<th>${c}</th>`).join("")}</tr></thead>
      <tbody>${linhas.map((l, i) => `<tr${rowCls && rowCls[i] ? ` class="row-${rowCls[i]}"` : ""}>${l.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  }
  const vazio = (msg) => `<div class="table-wrap"><div class="empty">${esc(msg)}</div></div>`;
  function vazioAcao(msg, btnLabel, onClick) {
    const id = "v" + Math.abs(msg.length * 31 + btnLabel.length);
    setTimeout(() => { const b = document.getElementById(id); if (b) b.onclick = onClick; }, 0);
    return `<div class="table-wrap"><div class="empty">${esc(msg)}<div style="margin-top:14px"><button class="btn btn-primary btn-sm" id="${id}">${esc(btnLabel)}</button></div></div></div>`;
  }

  function openModal(titulo, html, onConfirm, _x, okLabel = "Salvar") {
    const back = document.createElement("div");
    back.className = "modal-backdrop";
    back.innerHTML = `<div class="modal"><h3>${esc(titulo)}</h3>${html}
      <div class="modal-actions">
        <button class="btn" data-cancel>${onConfirm ? "Cancelar" : "Fechar"}</button>
        ${onConfirm ? `<button class="btn btn-primary" data-ok>${esc(okLabel)}</button>` : ""}
      </div></div>`;
    document.body.appendChild(back);
    const close = () => back.remove();
    back.querySelector("[data-cancel]").addEventListener("click", close);
    back.addEventListener("click", (e) => { if (e.target === back) close(); });
    const ok = back.querySelector("[data-ok]");
    if (ok) ok.addEventListener("click", async () => { if ((await onConfirm()) !== false) close(); });
  }
})();
