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

  const AGENTES = [
    { id: "calendario", n: 1, nome: "Calendário de Obrigações", desc: "Regime + competência → obrigações com data fatal em dias úteis, gravadas na agenda." },
    { id: "enquadramento", n: 2, nome: "Triagem / Enquadramento", desc: "Dados da empresa → ficha, regime sugerido, obrigações e parecer preliminar." },
    { id: "comunicado", n: 3, nome: "Comunicado ao Cliente", desc: "Situação do mês → texto simples pro empresário, pronto pra enviar." },
    { id: "consultor", n: 4, nome: "Consultor Tributário", desc: "Dúvida do contador → orientação genérica fundamentada." },
    { id: "fisco", n: 5, nome: "Resposta ao Fisco", desc: "Intimação colada → minuta de resposta estruturada." },
  ];

  // ── Toast ──
  let toastTimer;
  function toast(msg) {
    const t = $("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 2600);
  }

  // ── API ──
  async function api(path, { method = "GET", body } = {}) {
    const res = await fetch(ZX.apiBase + path, {
      method,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 401) { logout(); throw new Error("Sessão expirada"); }
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
      (a) => `<div class="agent-card"><div class="agent-num">AGENTE ${a.n}</div>
        <h3>${esc(a.nome)}</h3><p>${esc(a.desc)}</p>
        <button class="btn btn-primary btn-sm" data-ag="${a.id}">Abrir</button></div>`,
    ).join("");
    $("cards-agentes").querySelectorAll("[data-ag]").forEach((b) => b.addEventListener("click", () => abrirAgente(b.dataset.ag)));
    $("tabs").querySelectorAll("button").forEach((b) => b.addEventListener("click", () => render(b.dataset.tab)));
    $("novo-empresa").addEventListener("click", modalNovaEmpresa);
    $("novo-competencia").addEventListener("click", modalNovaCompetencia);
    $("novo-prazo").addEventListener("click", modalNovoPrazo);
    $("ag-emp").addEventListener("change", loadAgenda);
    render("agentes");
  }

  function render(tab) {
    $("tabs").querySelectorAll("button").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
    document.querySelectorAll("[data-view]").forEach((s) => (s.hidden = s.dataset.view !== tab));
    ({ agentes() {}, empresas: loadEmpresas, competencias: loadCompetencias, agenda: loadAgenda, saidas: loadSaidas })[tab]();
  }

  // ── Agentes ──
  async function abrirAgente(id) {
    await carregarEmpresas();
    const ag = AGENTES.find((a) => a.id === id);
    const empOpts = `<option value="">— selecione —</option>` + empresasCache.map((e) => `<option value="${e.id}" data-regime="${e.regime}">${esc(e.razaoSocial)}</option>`).join("");
    const campos = {
      calendario: `
        <label class="field"><span>Empresa</span><select id="f-empresa">${empOpts}</select></label>
        <label class="field"><span>Regime</span><select id="f-regime">${REGIMES.map(([v, l]) => `<option value="${v}">${l}</option>`).join("")}</select></label>
        <div style="display:flex;gap:10px">
          <label class="field" style="flex:1"><span>Mês</span><input class="mono" id="f-mes" type="number" min="1" max="12" value="1" /></label>
          <label class="field" style="flex:1"><span>Ano</span><input class="mono" id="f-ano" type="number" min="2000" max="2100" value="2026" /></label>
        </div>`,
      enquadramento: `<label class="field"><span>Empresa (opcional)</span><select id="f-empresa">${empOpts}</select></label>
        <label class="field"><span>Dados da empresa</span><textarea id="f-dados" placeholder="Atividade/CNAE, faturamento estimado, nº de sócios, folha..."></textarea></label>`,
      comunicado: `<label class="field"><span>Empresa (opcional)</span><select id="f-empresa">${empOpts}</select></label>
        <label class="field"><span>Situação do mês</span><textarea id="f-situacao" placeholder="Valores a pagar, pendências, observações..."></textarea></label>`,
      consultor: `<label class="field"><span>Sua dúvida</span><textarea id="f-pergunta" placeholder="Ex.: cliente quer migrar de Presumido para Simples, o que considerar?"></textarea></label>`,
      fisco: `<label class="field"><span>Empresa (opcional)</span><select id="f-empresa">${empOpts}</select></label>
        <label class="field"><span>Texto da intimação/notificação</span><textarea id="f-intimacao" placeholder="Cole aqui o texto recebido do Fisco..."></textarea></label>
        <label class="field"><span>Observações (opcional)</span><input id="f-obs" /></label>`,
    }[id];

    openModal(ag.nome, `${campos}<div id="ag-out"></div>`, async () => {
      const out = $("ag-out");
      out.innerHTML = `<div class="output">Gerando…</div>`;
      try {
        const r = await executarAgente(id);
        out.innerHTML = renderOutput(r.texto ?? r.conteudo ?? "");
        toast("Saída gerada e salva no histórico.");
      } catch (err) {
        out.innerHTML = `<div class="output">${esc(err.message)}</div>`;
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
    return `<div class="output">${esc(corpo)}<span class="disclaimer">⚠ ${DISCLAIMER}</span>
      <div class="row-actions" style="margin-top:12px">
        <button class="btn btn-sm" data-copy>Copiar</button>
        <button class="btn btn-sm" data-dl>Baixar .txt</button>
      </div></div>`;
  }
  document.addEventListener("click", (e) => {
    const box = e.target.closest(".output");
    if (!box || (!e.target.matches("[data-copy]") && !e.target.matches("[data-dl]"))) return;
    const texto = box.textContent.replace(/CopiarBaixar \.txt\s*$/, "").trim();
    if (e.target.matches("[data-copy]")) { navigator.clipboard?.writeText(texto); toast("Copiado."); }
    else {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([texto], { type: "text/plain" }));
      a.download = "saida-zxcontrol.txt";
      a.click();
    }
  });

  // ── Empresas ──
  async function carregarEmpresas() { empresasCache = await api("/empresas"); return empresasCache; }
  const regimeLabel = (r) => (REGIMES.find((x) => x[0] === r) || [, r])[1];

  async function loadEmpresas() {
    const emp = await carregarEmpresas();
    $("emp-tbl").innerHTML = emp.length
      ? tabela(["Razão social", "CNPJ", "Regime", "Porte", ""], emp.map((e) => [
          esc(e.razaoSocial),
          `<span class="mono">${esc(e.cnpj || "—")}</span>`,
          `<span class="badge regime">${esc(regimeLabel(e.regime))}</span>`,
          esc(e.porte || "—"),
          `<button class="btn btn-danger btn-sm" data-del="${e.id}">Excluir</button>`,
        ]))
      : vazio("Nenhuma empresa ainda. Clique em “+ Novo cliente”.");
    $("emp-tbl").querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", async () => {
      await api(`/empresas/${b.dataset.del}`, { method: "DELETE" });
      toast("Empresa excluída."); loadEmpresas();
    }));
  }
  function modalNovaEmpresa() {
    openModal("Novo cliente", `
      <label class="field"><span>Razão social *</span><input id="m-razao" /></label>
      <label class="field"><span>CNPJ</span><input class="mono" id="m-cnpj" placeholder="00.000.000/0000-00" /></label>
      <label class="field"><span>Regime *</span><select id="m-regime">${REGIMES.map(([v, l]) => `<option value="${v}">${l}</option>`).join("")}</select></label>
      <label class="field"><span>Porte</span><input id="m-porte" placeholder="ME, EPP, Demais..." /></label>`,
      async () => {
        const razaoSocial = $("m-razao").value.trim();
        if (!razaoSocial) { toast("Informe a razão social."); return false; }
        await api("/empresas", { method: "POST", body: { razaoSocial, cnpj: $("m-cnpj").value || undefined, regime: $("m-regime").value, porte: $("m-porte").value || undefined } });
        toast("Empresa cadastrada."); loadEmpresas(); return true;
      });
  }

  // ── Competências ──
  async function loadCompetencias() {
    await carregarEmpresas();
    const comps = await api("/competencias");
    const nome = (id) => empresasCache.find((e) => e.id === id)?.razaoSocial || "—";
    $("comp-tbl").innerHTML = comps.length
      ? tabela(["Empresa", "Competência", "Status"], comps.map((c) => [
          esc(nome(c.empresaId)),
          `<span class="mono">${MESES[c.mes]}/${c.ano}</span>`,
          `<span class="badge ${c.status}">${c.status}</span>`,
        ]))
      : vazio("Nenhuma competência cadastrada.");
  }
  function modalNovaCompetencia() {
    if (!empresasCache.length) { toast("Cadastre uma empresa primeiro."); return; }
    const opts = empresasCache.map((e) => `<option value="${e.id}">${esc(e.razaoSocial)}</option>`).join("");
    openModal("Novo período de competência", `
      <label class="field"><span>Empresa *</span><select id="m-emp">${opts}</select></label>
      <div style="display:flex;gap:10px">
        <label class="field" style="flex:1"><span>Mês *</span><select id="m-mes" class="mono">${MESES.slice(1).map((m, i) => `<option value="${i + 1}">${m}</option>`).join("")}</select></label>
        <label class="field" style="flex:1"><span>Ano *</span><input class="mono" id="m-ano" type="number" min="2000" max="2100" value="2026" /></label>
      </div>`,
      async () => {
        await api("/competencias", { method: "POST", body: { empresaId: $("m-emp").value, mes: Number($("m-mes").value), ano: Number($("m-ano").value) } });
        toast("Competência criada."); loadCompetencias(); return true;
      });
  }

  // ── Agenda de prazos ──
  function statusPrazo(dataFatal) {
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const dias = Math.round((new Date(dataFatal + "T00:00:00") - hoje) / 86400000);
    if (dias < 0) return ["vencido", "Vencido"];
    if (dias <= ALERTA_DIAS) return ["alerta", `Em ${dias}d`];
    return ["ok", "No prazo"];
  }
  async function loadAgenda() {
    await carregarEmpresas();
    const sel = $("ag-emp");
    if (sel.options.length !== empresasCache.length || !sel.dataset.filled) {
      sel.innerHTML = empresasCache.map((e) => `<option value="${e.id}">${esc(e.razaoSocial)}</option>`).join("") || `<option value="">cadastre uma empresa</option>`;
      sel.dataset.filled = "1";
    }
    if (!sel.value) { $("ag-tbl").innerHTML = vazio("Selecione uma empresa."); return; }
    const prazos = await api(`/prazos?empresaId=${encodeURIComponent(sel.value)}`);
    $("ag-tbl").innerHTML = prazos.length
      ? tabela(["Obrigação", "Vencimento", "Situação", "Status", ""], prazos.map((p) => {
          const [cls, lbl] = statusPrazo(p.dataFatal);
          return [
            `${esc(p.sigla)} <span style="color:var(--muted)">— ${esc(p.descricao)}</span>`,
            `<span class="mono">${p.dataFatal.split("-").reverse().join("/")}</span>`,
            `<span class="badge ${cls}">${lbl}</span>`,
            `<span class="badge ${p.status}">${p.status}</span>`,
            p.status === "pendente" ? `<button class="btn btn-sm" data-done="${p.id}">Marcar cumprido</button>` : "",
          ];
        }))
      : vazio("Sem prazos. Rode o Agente 1 (Calendário) ou adicione manualmente.");
    $("ag-tbl").querySelectorAll("[data-done]").forEach((b) => b.addEventListener("click", async () => {
      await api(`/prazos/${b.dataset.done}/status`, { method: "PUT", body: { status: "cumprido" } });
      toast("Prazo marcado como cumprido."); loadAgenda();
    }));
  }
  function modalNovoPrazo() {
    if (!empresasCache.length) { toast("Cadastre uma empresa primeiro."); return; }
    const opts = empresasCache.map((e) => `<option value="${e.id}" ${e.id === $("ag-emp").value ? "selected" : ""}>${esc(e.razaoSocial)}</option>`).join("");
    openModal("Novo prazo", `
      <label class="field"><span>Empresa *</span><select id="m-emp">${opts}</select></label>
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
    const nome = (id) => empresasCache.find((e) => e.id === id)?.razaoSocial || "—";
    $("sa-tbl").innerHTML = saidas.length
      ? tabela(["Tipo", "Título", "Empresa", "Data", ""], saidas.map((s) => [
          `<span class="badge regime">${esc(s.agente)}</span>`,
          esc(s.titulo),
          esc(nome(s.empresaId)),
          `<span class="mono">${new Date(s.criadoEm).toLocaleDateString("pt-BR")}</span>`,
          `<button class="btn btn-sm" data-ver="${esc(encodeURIComponent(s.conteudo))}">Ver</button>`,
        ]))
      : vazio("Nenhuma saída gerada ainda.");
    $("sa-tbl").querySelectorAll("[data-ver]").forEach((b) => b.addEventListener("click", () => {
      openModal("Saída gerada", `<div id="ag-out">${renderOutput(decodeURIComponent(b.dataset.ver))}</div>`, null, null, "Fechar");
    }));
  }

  // ── Helpers de UI ──
  function tabela(cols, linhas) {
    return `<div class="table-wrap"><table><thead><tr>${cols.map((c) => `<th>${c}</th>`).join("")}</tr></thead>
      <tbody>${linhas.map((l) => `<tr>${l.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  }
  const vazio = (msg) => `<div class="table-wrap"><div class="empty">${esc(msg)}</div></div>`;

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
