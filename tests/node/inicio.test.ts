// Tela Início: na demo ela ficava em "Carregando…" para sempre.
// Causa raiz: o painel pede GET /api/prazos SEM empresaId (o Worker real devolve a agenda completa),
// mas o mock da demo respondia 400 — e o painel não tratava a falha, então o spinner nunca saía.
// Dois testes de comportamento: (1) a demo fala o mesmo contrato do Worker; (2) falha de API vira mensagem, não spinner.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runInNewContext } from "node:vm";

const REPO = join(__dirname, "..", "..");
const TOKEN = "demo-contabil-2026"; // demo/data.mjs
const PORT = 20000 + Math.floor(Math.random() * 20000);
const BASE = `http://127.0.0.1:${PORT}`;
let demo: ChildProcess;

beforeAll(async () => {
  demo = spawn(process.execPath, [join(REPO, "demo", "server.mjs")], { env: { ...process.env, PORT: String(PORT) }, stdio: ["ignore", "pipe", "pipe"] });
  await new Promise<void>((ok, falha) => {
    const t = setTimeout(() => falha(new Error("demo não subiu em 10s")), 10000);
    demo.stdout!.on("data", (b) => { if (String(b).includes("Painel:")) { clearTimeout(t); ok(); } });
    demo.on("exit", (c) => { clearTimeout(t); falha(new Error(`demo saiu com ${c}`)); });
  });
});
afterAll(() => { demo?.kill(); });

const get = (path: string) => fetch(BASE + path, { headers: { Authorization: `Bearer ${TOKEN}` } });

describe("demo: GET /api/prazos tem o mesmo contrato do Worker real (src/app.ts)", () => {
  it("sem empresaId devolve a agenda completa do escritório, ordenada por data", async () => {
    const r = await get("/api/prazos");
    expect(r.status).toBe(200);
    const todos = (await r.json()) as { empresaId: string; dataFatal: string }[];
    expect(todos.length).toBeGreaterThan(1);
    expect(new Set(todos.map((p) => p.empresaId)).size).toBeGreaterThan(1);
    expect(todos.map((p) => p.dataFatal)).toEqual([...todos.map((p) => p.dataFatal)].sort());
  });
  it("com empresaId continua filtrando; empresaId vazio = agenda completa (como no Worker)", async () => {
    const um = (await (await get("/api/prazos?empresaId=emp1")).json()) as { empresaId: string }[];
    expect(um.length).toBeGreaterThan(0);
    expect(um.every((p) => p.empresaId === "emp1")).toBe(true);
    const vazio = (await (await get("/api/prazos?empresaId=")).json()) as unknown[];
    expect(vazio.length).toBeGreaterThan(um.length);
  });
  it("continua fail-closed sem token", async () => {
    expect((await fetch(BASE + "/api/prazos")).status).toBe(401);
  });
});

// DOM de mentira: só o suficiente para o painel/app.js rodar em Node.
function criarPainel(apiFetch: (url: string, init?: any) => Promise<any>) {
  const els = new Map<string, any>();
  const abas = ["inicio", "agentes", "empresas", "crm", "competencias", "agenda", "relatorio", "saidas"].map((t) => {
    const h: Record<string, Function> = {};
    return { dataset: { tab: t }, classList: { toggle() {}, add() {}, remove() {} }, addEventListener(e: string, fn: Function) { h[e] = fn; }, clicar: () => h.click?.() };
  });
  const elemento = (id: string) => {
    if (!els.has(id)) {
      const h: Record<string, Function> = {};
      els.set(id, {
        id, innerHTML: "", textContent: "", value: "", hidden: false, dataset: {}, options: [], style: {},
        classList: { add() {}, remove() {}, toggle() {} },
        addEventListener(t: string, fn: Function) { h[t] = fn; },
        handlers: h,
        querySelector: () => null, querySelectorAll: () => [], appendChild() {}, remove() {},
      });
    }
    return els.get(id);
  };
  elemento("tabs").querySelectorAll = () => abas;
  const ctx: any = {
    ZX: { mode: "demo", apiBase: "/api", token: TOKEN, prazoAlertaDias: 5 },
    document: { addEventListener() {}, getElementById: elemento, querySelectorAll: () => [], createElement: () => elemento("_x"), body: elemento("_body") },
    sessionStorage: { setItem() {}, removeItem() {}, getItem: () => null },
    fetch: apiFetch, setTimeout, clearTimeout, console, Promise,
  };
  ctx.window = ctx;
  runInNewContext(readFileSync(join(REPO, "painel", "app.js"), "utf8"), ctx);
  return { elemento, ctx, aba: (t: string) => abas.find((a) => a.dataset.tab === t)! };
}
const entrar = async (p: ReturnType<typeof criarPainel>) => {
  p.elemento("login-email").value = "a@b.c";
  p.elemento("login-form").handlers.submit({ preventDefault() {} });
  for (let i = 0; i < 30; i++) await new Promise((r) => setTimeout(r, 10));
};

describe("painel: tela Início", () => {
  it("carrega os cartões quando fala com a demo de verdade", async () => {
    const p = criarPainel((url, init) => fetch(BASE + url, init));
    await entrar(p);
    const html = p.elemento("dash-cards").innerHTML;
    expect(html).not.toContain("Carregando");
    expect(html).toContain("Prazos vencidos");
    expect(html).toContain("Clientes ativos");
  });

  it("se a API recusar, mostra mensagem de erro e NÃO deixa o 'Carregando…' (nem spinner eterno)", async () => {
    const resp = (status: number, corpo: unknown) => Promise.resolve({ status, ok: status < 400, json: () => Promise.resolve(corpo) });
    const p = criarPainel((url) => {
      if (url.startsWith("/api/prazos")) return resp(400, { error: "empresaId obrigatório" });
      return resp(200, []);
    });
    await entrar(p);
    const html = p.elemento("dash-cards").innerHTML;
    expect(html).not.toContain("Carregando");
    expect(html).not.toContain("spinner");
    expect(html).toContain("empresaId obrigatório");
    expect(html).toContain("Tentar de novo");
  });

  it("falha de rede (fetch rejeita) também sai do 'Carregando…'", async () => {
    const p = criarPainel((url) =>
      url.startsWith("/api/competencias") ? Promise.reject(new TypeError("Failed to fetch")) : Promise.resolve({ status: 200, ok: true, json: () => Promise.resolve([]) }));
    await entrar(p);
    const html = p.elemento("dash-cards").innerHTML;
    expect(html).not.toContain("Carregando");
    expect(html).toContain("Failed to fetch");
  });

  it("falha no Relatório não deixa lançamentos financeiros antigos na tela", async () => {
    const resp = (status: number, corpo: unknown) => Promise.resolve({ status, ok: status < 400, json: () => Promise.resolve(corpo) });
    const p = criarPainel((url) => (url.startsWith("/api/competencias") && quebrar ? resp(500, { error: "banco fora do ar" }) : resp(200, url.startsWith("/api/financeiro") ? {} : [])));
    let quebrar = false;
    await entrar(p);
    p.elemento("fin-cards").innerHTML = "<b>ANTIGO</b>";
    p.elemento("rec-tbl").innerHTML = "<b>ANTIGO</b>";
    quebrar = true;
    p.aba("relatorio").clicar();
    await new Promise((r) => setTimeout(r, 100));
    expect(p.elemento("rel-cards").innerHTML).toContain("banco fora do ar");
    for (const id of ["fin-cards", "rec-tbl", "cus-tbl"]) expect(p.elemento(id).innerHTML).not.toContain("ANTIGO");
  });

  it("falha atrasada de uma consulta antiga não apaga o resultado da mais nova", async () => {
    const ok = (corpo: unknown) => Promise.resolve({ status: 200, ok: true, json: () => Promise.resolve(corpo) });
    let n = 0;
    const p = criarPainel((url) => {
      if (!url.startsWith("/api/competencias")) return ok([]);
      return ++n === 2 ? new Promise((_, rej) => setTimeout(() => rej(new TypeError("antiga falhou")), 80)) : ok([]);
    });
    await entrar(p); // 1ª chamada de competencias (n=1) ok
    p.aba("inicio").clicar(); // n=2: lenta e vai falhar
    await new Promise((r) => setTimeout(r, 10));
    p.aba("inicio").clicar(); // n=3: ok, mais nova
    await new Promise((r) => setTimeout(r, 200));
    const html = p.elemento("dash-cards").innerHTML;
    expect(html).toContain("Prazos vencidos");
    expect(html).not.toContain("antiga falhou");
  });
});
