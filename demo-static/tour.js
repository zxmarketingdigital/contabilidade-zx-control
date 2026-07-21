// DEMO (CD Tech): auto-login (sem tela de senha) + balões explicativos por aba,
// em linguagem simples pra leigos. Não toca em app.js — usa os mesmos elementos.

(function () {
  const TOUR = {
    inicio: { title: "Início", text: "A tela inicial mostra o que precisa de atenção hoje: os próximos vencimentos e as pendências do escritório, num resumo rápido." },
    agentes: { title: "Assistentes de IA", text: "Os 5 assistentes. Você digita ou cola a informação e eles devolvem pronto: montar o calendário de impostos, analisar uma empresa nova, escrever um aviso pro cliente, tirar uma dúvida tributária e responder o Fisco." },
    empresas: { title: "Clientes", text: "A carteira de empresas-cliente do escritório, com o regime de cada uma (MEI, Simples, Presumido, Real)." },
    crm: { title: "CRM — funil de clientes", text: "Cada possível cliente (lead), em que etapa está e qual a próxima ação. Um clique converte o lead em cliente." },
    competencias: { title: "Meses de trabalho", text: "O mês de referência (competência) de cada cliente — aberto ou fechado. É o controle do que já foi concluído no período." },
    agenda: { title: "Agenda de prazos", text: "Todos os prazos fiscais com a data fatal. Vermelho = vencido, amarelo = vence em poucos dias. As datas já vêm ajustadas para dia útil — e dá para exportar pro Google Agenda (.ics)." },
    relatorio: { title: "Relatório", text: "A visão do escritório: quais clientes têm mais atrasos e os números financeiros — faturamento recorrente, custos, lucro e quanto custa conquistar cada cliente." },
    saidas: { title: "O que já gerei", text: "O histórico de tudo que os assistentes já produziram (calendários, comunicados, respostas) para você consultar e reaproveitar." },
  };

  function init() {
    const main = document.querySelector("#app main");
    if (!main) return;

    const balloon = document.createElement("div");
    balloon.className = "tour-balloon";
    balloon.style.display = "none";
    balloon.innerHTML =
      '<button class="tour-balloon__close" aria-label="Fechar">&times;</button>' +
      '<div class="tour-balloon__title"></div><div class="tour-balloon__text"></div>';
    main.insertBefore(balloon, main.firstChild);
    const elTitle = balloon.querySelector(".tour-balloon__title");
    const elText = balloon.querySelector(".tour-balloon__text");

    function show(tab) {
      const info = TOUR[tab];
      if (!info) { balloon.style.display = "none"; return; }
      elTitle.textContent = info.title;
      elText.textContent = info.text;
      balloon.style.display = "block";
      balloon.classList.remove("tour-balloon--in");
      void balloon.offsetWidth;
      balloon.classList.add("tour-balloon--in");
    }
    balloon.querySelector(".tour-balloon__close").addEventListener("click", () => { balloon.style.display = "none"; });
    document.querySelectorAll("#tabs button[data-tab]").forEach((b) => b.addEventListener("click", () => show(b.dataset.tab)));

    if (window.ZX && window.ZX.mode === "demo") {
      const f = document.getElementById("login-form");
      const lv = document.getElementById("login");
      if (f && lv && !lv.classList.contains("hidden")) {
        document.getElementById("login-email").value = "demo@escritorio.local";
        document.getElementById("login-pass").value = "demo";
        if (f.requestSubmit) f.requestSubmit(); else f.dispatchEvent(new Event("submit", { cancelable: true }));
      }
      setTimeout(() => show("inicio"), 450);
    }
  }

  if (document.readyState !== "loading") init();
  else document.addEventListener("DOMContentLoaded", init);
})();
