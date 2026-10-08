// Marca do aluno: validação de cor/logo, paleta em runtime (painel/marca.js) e gravação (setup/marca.mjs).
// Roda em Node puro (projeto "node" do vitest.config.ts): precisa de disco real, que o workerd não tem.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import { spawnSync } from "node:child_process";
import "../../painel/marca.js";
import { aplicarMarca, MarcaErro } from "../../setup/marca.mjs";

const Z = (globalThis as any).ZXMarca;
const REPO = join(__dirname, "..", "..");

describe("legivelNoClaro (texto da marca no PDF)", () => {
  it("garante contraste >= 4,5 contra branco para qualquer cor, inclusive branco e amarelo", () => {
    for (const c of ["#FFFFFF", "#FFFF00", "#D97706", "#1D4ED8", "#000000", "#F5F5F5"]) {
      expect(Z.contraste(Z.legivelNoClaro(c), "#FFFFFF")).toBeGreaterThanOrEqual(4.5);
    }
  });
  it("cor que já passa não muda", () => {
    expect(Z.legivelNoClaro("#1D4ED8")).toBe("#1D4ED8");
  });
});

describe("normalizarHex", () => {
  it("aceita #RGB e #RRGGBB, normaliza para maiúsculas", () => {
    expect(Z.normalizarHex("#abc")).toBe("#AABBCC");
    expect(Z.normalizarHex(" #1d4ed8 ")).toBe("#1D4ED8");
  });
  it("rejeita todo o resto", () => {
    for (const ruim of ["red", "1D4ED8", "#12345", "#GGGGGG", "#1234567", "", "rgb(1,2,3)", null, undefined, 42]) {
      expect(Z.normalizarHex(ruim)).toBeNull();
    }
  });
});

describe("paleta", () => {
  it("cor padrão ZX mantém o tema atual e texto escuro no botão", () => {
    const p = Z.paleta("#D97706");
    expect(p["--primary"]).toBe("#D97706");
    expect(p["--primary-rgb"]).toBe("217, 119, 6");
    expect(p["--on-primary"]).toBe("#0D0D0D");
    expect(p["--primary-text"]).toBe("#D97706"); // já tem contraste no fundo escuro: não mexe
  });
  it("cor escura: botão com texto branco e cor-como-texto clareada até ficar legível no fundo escuro", () => {
    const p = Z.paleta("#0A2A5E");
    expect(p["--on-primary"]).toBe("#FFFFFF");
    for (const v of ["--primary-text", "--primary-light", "--primary-bright"]) {
      expect(Z.contraste(p[v], "#0D0D0D")).toBeGreaterThanOrEqual(4.5);
    }
  });
  it("cor muito clara: botão com texto escuro (legibilidade)", () => {
    expect(Z.paleta("#FFE066")["--on-primary"]).toBe("#0D0D0D");
  });
  it("secundária informada vira --brand-2 e --primary-dark; ausente, deriva uma versão mais escura", () => {
    const com = Z.paleta("#1D4ED8", "#0B1F4D");
    expect(com["--brand-2"]).toBe("#0B1F4D");
    expect(com["--primary-dark"]).toBe("#0B1F4D");
    const sem = Z.paleta("#1D4ED8");
    expect(Z.luminancia(sem["--brand-2"])).toBeLessThan(Z.luminancia("#1D4ED8"));
  });
  it("cor inválida cai no padrão em vez de gerar CSS quebrado", () => {
    expect(Z.paleta("azul")["--primary"]).toBe("#D97706");
  });
});

describe("logoValido", () => {
  it("aceita https e caminho copiado para marca/", () => {
    expect(Z.logoValido("https://exemplo.com.br/logo.png")).toBe("https://exemplo.com.br/logo.png");
    expect(Z.logoValido("marca/logo.svg")).toBe("marca/logo.svg");
  });
  it("rejeita esquemas perigosos, http e fuga de diretório", () => {
    for (const ruim of ["javascript:alert(1)", "data:image/png;base64,AA", "http://x.com/a.png", "../logo.png", "marca/../a.png", "marca/logo.exe", "", null]) {
      expect(Z.logoValido(ruim)).toBeNull();
    }
  });
});

// Documento falso mínimo: só o que o marca.js usa.
function docFalso() {
  const props: Record<string, string> = {};
  const nomes = [{ textContent: "Contabilidade ZX Control" }, { textContent: "ZX Control · Contabilidade" }];
  const img = (): any => ({ src: "", alt: "", hidden: true, removeAttribute(a: string) { if (a === "src") this.src = ""; } });
  const imgs = [img(), img()];
  return {
    props, nomes, imgs,
    documentElement: { style: { setProperty: (k: string, v: string) => { props[k] = v; } } },
    querySelectorAll: (sel: string) => (sel === "[data-marca-nome]" ? nomes : sel === "img[data-marca-logo]" ? imgs : []),
  };
}

describe("aplicar (runtime do painel)", () => {
  it("cor, nome e logo chegam no documento", () => {
    const d: any = docFalso();
    const marca = Z.lerMarca({ marca: { nome: "Escritório Silva", corPrimaria: "#1d4ed8", corSecundaria: "", logo: "marca/logo.png" } });
    Z.aplicar(marca, d);
    expect(d.props["--brand"]).toBe("#1D4ED8"); // a var que o painel lê muda
    expect(d.props["--primary"]).toBe("#1D4ED8");
    expect(d.nomes.map((n: any) => n.textContent)).toEqual(["Escritório Silva", "Escritório Silva"]);
    expect(d.imgs[0]).toMatchObject({ src: "marca/logo.png", alt: "Escritório Silva", hidden: false });
  });
  it("sem logo esconde a imagem (nunca o logo ZX) e fica só o nome em texto", () => {
    const d: any = docFalso();
    Z.aplicar(Z.lerMarca({ marca: { nome: "Escritório Silva", corPrimaria: "#1D4ED8" } }), d);
    expect(d.imgs[0].hidden).toBe(true);
    expect(d.imgs[0].src).toBe("");
  });
  it("sem marca configurada não toca em nada (tema ZX padrão)", () => {
    const d: any = docFalso();
    Z.aplicar(Z.lerMarca(undefined), d);
    expect(d.props).toEqual({});
    expect(d.nomes[0].textContent).toBe("Contabilidade ZX Control");
  });
  it("logo com esquema perigoso na config é descartado", () => {
    const d: any = docFalso();
    Z.aplicar(Z.lerMarca({ marca: { nome: "X", corPrimaria: "#123456", logo: "javascript:alert(1)" } }), d);
    expect(d.imgs[0].hidden).toBe(true);
  });
});

describe("setup/marca.mjs (aplicarMarca)", () => {
  let raiz: string;
  beforeEach(() => {
    raiz = mkdtempSync(join(tmpdir(), "marca-test-"));
    mkdirSync(join(raiz, "painel"), { recursive: true });
    mkdirSync(join(raiz, "docs"), { recursive: true });
    for (const f of ["config.example.js", "marca.js"]) copyFileSync(join(REPO, "painel", f), join(raiz, "painel", f));
    writeFileSync(join(raiz, "logo-teste.png"), "PNG-FALSO");
  });
  afterEach(() => rmSync(raiz, { recursive: true, force: true }));

  // Lê o painel/config.js como o navegador lê.
  const lerConfig = () => {
    const sb: any = { window: {} };
    runInNewContext(readFileSync(join(raiz, "painel", "config.js"), "utf8"), sb);
    return sb.window.ZX;
  };

  it("grava os 4 campos no config.js que o painel lê, copia o logo e publica nos docs (config → painel, ponta a ponta)", () => {
    const r = aplicarMarca({ raiz, nome: "Escritório Silva", cor: "#1d4ed8", cor2: "#0b1f4d", logo: join(raiz, "logo-teste.png") });
    expect(r.avisos.join()).not.toMatch(/cor padrão/);
    const zx = lerConfig();
    expect(zx.marca).toEqual({ nome: "Escritório Silva", corPrimaria: "#1D4ED8", corSecundaria: "#0B1F4D", logo: "marca/logo.png" });
    expect(zx.prazoAlertaDias).toBe(5); // o resto da config sobrevive
    expect(Z.lerMarca(zx)).toEqual(zx.marca); // o que o setup grava é exatamente o que o painel aceita
    expect(readFileSync(join(raiz, "painel", "marca", "logo.png"), "utf8")).toBe("PNG-FALSO");
    expect(existsSync(join(raiz, "docs", "marca", "logo.png"))).toBe(true);
    expect(existsSync(join(raiz, "docs", "marca.js"))).toBe(true);
    const docsCfg = readFileSync(join(raiz, "docs", "marca.config.js"), "utf8");
    const sb: any = { window: {} };
    runInNewContext(docsCfg, sb);
    expect(sb.window.ZX.marca.corPrimaria).toBe("#1D4ED8");
  });

  it("sem cor: grava o padrão ZX COM aviso explícito", () => {
    const r = aplicarMarca({ raiz, nome: "Escritório Silva" });
    expect(r.marca.corPrimaria).toBe("#D97706");
    expect(r.avisos.join("\n")).toContain("Usando a cor padrão ZX (âmbar). Troque depois em");
    expect(lerConfig().marca.logo).toBe("");
  });

  it("rodar de novo troca a marca sem duplicar o bloco nem deixar logo antigo", () => {
    aplicarMarca({ raiz, nome: "A", cor: "#111111", logo: join(raiz, "logo-teste.png") });
    aplicarMarca({ raiz, nome: "B", cor: "#222222" });
    const texto = readFileSync(join(raiz, "painel", "config.js"), "utf8");
    expect(texto.match(/>>> marca/g)).toHaveLength(1);
    expect(lerConfig().marca).toMatchObject({ nome: "B", corPrimaria: "#222222", logo: "" });
    expect(existsSync(join(raiz, "painel", "marca", "logo.png"))).toBe(false);
  });

  it("campo inválido lança erro e não grava nada", () => {
    const casos = [
      { nome: "", cor: "#123456" },
      { nome: "X", cor: "vermelho" },
      { nome: "X", cor: "#123456", cor2: "abc" },
      { nome: "X", logo: join(raiz, "nao-existe.png") },
      { nome: "X", logo: "javascript:alert(1)" },
      { nome: "X", logo: "http://inseguro.com/a.png" },
    ];
    for (const c of casos) {
      expect(() => aplicarMarca({ raiz, ...c })).toThrow(MarcaErro);
      expect(existsSync(join(raiz, "painel", "config.js"))).toBe(false);
      expect(existsSync(join(raiz, "docs", "marca.config.js"))).toBe(false);
    }
    writeFileSync(join(raiz, "arquivo.exe"), "x");
    expect(() => aplicarMarca({ raiz, nome: "X", logo: join(raiz, "arquivo.exe") })).toThrow(MarcaErro);
  });

  it("logo por URL https é guardada como está, sem cópia", () => {
    aplicarMarca({ raiz, nome: "X", cor: "#123456", logo: "https://exemplo.com.br/logo.svg" });
    expect(lerConfig().marca.logo).toBe("https://exemplo.com.br/logo.svg");
    expect(existsSync(join(raiz, "painel", "marca"))).toBe(false);
  });

  it("nome hostil (aspas, </script>, $(...), crases, quebras) é gravado como TEXTO e sobrevive à leitura", () => {
    const nome = 'Silva "&" <script>alert(1)</script> $(touch /tmp/x) `id` \\ \u2028 fim';
    aplicarMarca({ raiz, nome, cor: "#123456" });
    expect(lerConfig().marca.nome).toBe(nome);
    const docs: any = { window: {} };
    runInNewContext(readFileSync(join(raiz, "docs", "marca.config.js"), "utf8"), docs);
    expect(docs.window.ZX.marca.nome).toBe(nome);
  });

  it("logo com espaço no caminho e caminho absoluto funcionam e viram marca/logo.<ext>", () => {
    mkdirSync(join(raiz, "minha pasta"), { recursive: true });
    const origem = join(raiz, "minha pasta", "Logo Escritório.PNG");
    writeFileSync(origem, "PNG-ESPACO");
    aplicarMarca({ raiz, nome: "X", cor: "#123456", logo: origem });
    expect(lerConfig().marca.logo).toBe("marca/logo.png");
    expect(readFileSync(join(raiz, "painel", "marca", "logo.png"), "utf8")).toBe("PNG-ESPACO");
  });

  it("CLI --json - lê da entrada padrão: valor com $(...) não executa nada e invalido sai 2", () => {
    const marcador = join(raiz, "EXECUTOU");
    const nome = `Teste $(touch ${marcador}) \`touch ${marcador}\``;
    const ok = spawnSync("node", [join(REPO, "setup", "marca.mjs"), "--raiz", raiz, "--json", "-"], {
      input: JSON.stringify({ nome, cor: "#1D4ED8", logo: join(raiz, "logo-teste.png") }), encoding: "utf8",
    });
    expect(ok.status).toBe(0);
    expect(existsSync(marcador)).toBe(false);
    expect(lerConfig().marca.nome).toBe(nome);
    const ruim = spawnSync("node", [join(REPO, "setup", "marca.mjs"), "--raiz", raiz, "--json", "-"], { input: JSON.stringify({ nome: "X", cor: "azul" }), encoding: "utf8" });
    expect(ruim.status).toBe(2);
    const lixo = spawnSync("node", [join(REPO, "setup", "marca.mjs"), "--raiz", raiz, "--json", "-"], { input: "{nao-json", encoding: "utf8" });
    expect(lixo.status).toBe(2);
  });
});
