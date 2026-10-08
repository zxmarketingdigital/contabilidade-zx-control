// ════════════════════════════════════════════════════════════════════════
// Marca do aluno — aplica nome, cores e logo do escritório sem tocar no resto.
//
// Lê window.ZX.marca ({ nome, corPrimaria, corSecundaria, logo }), gravado no
// painel/config.js pelo utilitário setup/marca.mjs, e escreve CSS custom properties
// em :root. Sem marca configurada, nada muda: vale o tema padrão do style.css.
//
// Script clássico (sem import/export) para rodar direto no navegador; o mesmo
// arquivo é importado pelo setup/marca.mjs e pelos testes (globalThis.ZXMarca).
// "Um valor, um lugar": a validação de cor existe SÓ aqui.
// ════════════════════════════════════════════════════════════════════════
(() => {
  const COR_PADRAO = "#D97706"; // âmbar ZX Control — fallback documentado
  const FUNDO = "#0D0D0D"; // fundo do painel (style.css --bg)
  const ESCURO = "#0D0D0D"; // texto sobre cor clara
  const BRANCO = "#FFFFFF";
  const CONTRASTE_TEXTO = 4.5; // WCAG AA para texto normal

  /** "#RGB" ou "#RRGGBB" → "#RRGGBB" maiúsculo. Qualquer outra coisa → null. */
  function normalizarHex(v) {
    if (typeof v !== "string") return null;
    const s = v.trim();
    let m = /^#([0-9a-fA-F]{3})$/.exec(s);
    if (m) return "#" + m[1].split("").map((c) => c + c).join("").toUpperCase();
    m = /^#([0-9a-fA-F]{6})$/.exec(s);
    return m ? "#" + m[1].toUpperCase() : null;
  }

  const paraRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const paraHex = (rgb) => "#" + rgb.map((n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0")).join("").toUpperCase();

  /** Mistura `hex` com `alvo` (0 = hex puro, 1 = alvo puro). */
  function misturar(hex, alvo, t) {
    const a = paraRgb(hex), b = paraRgb(alvo);
    return paraHex(a.map((c, i) => c + (b[i] - c) * t));
  }

  /** Luminância relativa WCAG 2.x. */
  function luminancia(hex) {
    const [r, g, b] = paraRgb(hex).map((c) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  function contraste(a, b) {
    const la = luminancia(a), lb = luminancia(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }

  /** Cor do texto sobre um fundo `hex` (botão primário): a de maior contraste. */
  function corSobre(hex) {
    return contraste(hex, ESCURO) >= contraste(hex, BRANCO) ? ESCURO : BRANCO;
  }

  /** Clareia `hex` até ficar legível como TEXTO sobre o fundo escuro do painel. */
  function legivelNoEscuro(hex) {
    let cor = hex;
    for (let t = 0; contraste(cor, FUNDO) < CONTRASTE_TEXTO && t < 20; t++) cor = misturar(cor, BRANCO, 0.12);
    return cor;
  }

  /** Paleta completa (todas as CSS vars) a partir da primária e da secundária opcional. */
  function paleta(corPrimaria, corSecundaria) {
    const p = normalizarHex(corPrimaria) || COR_PADRAO;
    const s = normalizarHex(corSecundaria);
    const dark = s || misturar(p, "#000000", 0.4);
    return {
      "--brand": p,
      "--brand-2": dark,
      "--primary": p,
      "--primary-light": legivelNoEscuro(misturar(p, BRANCO, 0.22)),
      "--primary-bright": legivelNoEscuro(misturar(p, BRANCO, 0.5)),
      "--primary-dark": dark,
      "--primary-text": legivelNoEscuro(p),
      "--primary-rgb": paraRgb(p).join(", "),
      "--on-primary": corSobre(p),
    };
  }

  /** Logo aceito: URL https ou caminho relativo copiado para marca/ (nada de javascript:/data:). */
  function logoValido(v) {
    if (typeof v !== "string") return null;
    const s = v.trim();
    if (/^https:\/\/[^\s"'<>]+$/i.test(s)) return s;
    if (/^marca\/[A-Za-z0-9._-]+\.(png|jpe?g|svg|webp)$/i.test(s)) return s;
    return null;
  }

  /** Lê e valida window.ZX.marca; campo inválido vira vazio (cai no padrão). */
  function lerMarca(zx) {
    const m = (zx && zx.marca) || {};
    return {
      nome: typeof m.nome === "string" ? m.nome.trim() : "",
      corPrimaria: normalizarHex(m.corPrimaria),
      corSecundaria: normalizarHex(m.corSecundaria),
      logo: logoValido(m.logo),
    };
  }

  /** Cores: só mexe em :root, pode rodar com o <head> ainda aberto (evita piscar o âmbar). */
  function aplicarCores(marca, doc) {
    if (!marca.corPrimaria) return;
    const vars = paleta(marca.corPrimaria, marca.corSecundaria);
    for (const k of Object.keys(vars)) doc.documentElement.style.setProperty(k, vars[k]);
  }

  /** Nome e logo: precisa do <body> pronto. */
  function aplicarTextos(marca, doc) {
    if (marca.nome) {
      doc.querySelectorAll("[data-marca-nome]").forEach((el) => { el.textContent = marca.nome; });
    }
    doc.querySelectorAll("img[data-marca-logo]").forEach((img) => {
      if (marca.logo) {
        img.src = marca.logo;
        img.alt = marca.nome;
        img.hidden = false;
      } else {
        img.removeAttribute("src");
        img.hidden = true; // sem logo: só o nome em texto, nunca o logo ZX
      }
    });
  }

  function aplicar(marca, doc) {
    aplicarCores(marca, doc);
    aplicarTextos(marca, doc);
  }

  const api = { COR_PADRAO, normalizarHex, misturar, luminancia, contraste, corSobre, legivelNoEscuro, paleta, logoValido, lerMarca, aplicar, aplicarCores, aplicarTextos };
  globalThis.ZXMarca = api;
  if (typeof document !== "undefined") {
    const marca = lerMarca(globalThis.ZX);
    aplicarCores(marca, document);
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => aplicarTextos(marca, document));
    else aplicarTextos(marca, document);
  }
})();
