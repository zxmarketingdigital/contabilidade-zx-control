// Financeiro (cálculo puro) + CRM/Financeiro via HTTP: auth fail-closed +
// converter lead→empresa + métricas grava-vs-lê. Se a auth furar ou o cálculo
// regredir, estes testes quebram.
import { describe, expect, it } from "vitest";
import { handleRequest, type AppDeps } from "../src/app";
import { AgendaMemoria } from "../src/agenda";
import { SaidasMemoria } from "../src/saidas";
import { CompetenciasMemoria, EmpresasMemoria } from "../src/entidades";
import { LeadsMemoria } from "../src/crm";
import { ReceitasMemoria, CustosMemoria, calcularFinanceiro } from "../src/financeiro";
import type { AuthEnv } from "../src/auth";

const ENV: AuthEnv = { SUPABASE_URL: "https://x.supabase.co", SUPABASE_SERVICE_KEY: "svc" };
const AUTH = { Authorization: "Bearer ok", "Content-Type": "application/json" };
function deps(over: Partial<AppDeps> = {}): AppDeps {
  return {
    agenda: new AgendaMemoria(), saidas: new SaidasMemoria(), empresas: new EmpresasMemoria(),
    competencias: new CompetenciasMemoria(), leads: new LeadsMemoria(),
    receitas: new ReceitasMemoria(), custos: new CustosMemoria(),
    llm: async () => "x", verify: async () => ({ id: "u1" }), ...over,
  };
}
const req = (path: string, method = "GET", body?: unknown, auth = true) =>
  new Request(`https://w${path}`, {
    method,
    headers: auth ? AUTH : { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });

describe("calcularFinanceiro (puro)", () => {
  it("MRR, custo mensal, lucro e CAC", () => {
    const f = calcularFinanceiro({
      receitas: [{ valor: 1000, tipo: "recorrente" }, { valor: 500, tipo: "recorrente" }, { valor: 300, tipo: "unica" }],
      custos: [{ valor: 400, tipo: "fixo_mensal" }, { valor: 200, tipo: "anuncios" }, { valor: 1000, tipo: "unico" }],
      leadsConvertidos: 4,
    });
    expect(f.mrr).toBe(1500);
    expect(f.custoMensalTotal).toBe(600); // 400 fixo + 200 anúncios
    expect(f.lucroMensal).toBe(900); // 1500 − 600
    expect(f.cac).toBe(50); // 200 ÷ 4
  });
  it("CAC null sem leads convertidos", () => {
    expect(calcularFinanceiro({ receitas: [], custos: [{ valor: 100, tipo: "anuncios" }], leadsConvertidos: 0 }).cac).toBeNull();
  });
});

describe("auth fail-closed nas rotas novas", () => {
  for (const [m, p] of [["GET", "/api/leads"], ["GET", "/api/receitas"], ["GET", "/api/custos"], ["GET", "/api/financeiro"]] as const) {
    it(`${m} ${p} sem token → 401`, async () => {
      expect((await handleRequest(req(p, m, undefined, false), ENV, deps())).status).toBe(401);
    });
  }
});

describe("CRM converter + financeiro grava-vs-lê", () => {
  it("converter lead cria empresa, marca convertido e entra no CAC", async () => {
    const d = deps();
    const lead = await (await handleRequest(req("/api/leads", "POST", { nome: "Loja XYZ", origem: "indicação" }), ENV, d)).json() as { id: string };
    await handleRequest(req("/api/custos", "POST", { descricao: "Ads", valor: 600, tipo: "anuncios" }), ENV, d);

    const conv = await handleRequest(req(`/api/leads/${lead.id}/converter`, "POST"), ENV, d);
    expect(conv.status).toBe(201);
    const { empresa } = await conv.json() as { empresa: { id: string; razaoSocial: string } };
    expect(empresa.razaoSocial).toBe("Loja XYZ");

    // a empresa convertida aparece na carteira
    const empresas = await (await handleRequest(req("/api/empresas"), ENV, d)).json() as unknown[];
    expect(empresas).toHaveLength(1);

    // CAC = 600 anúncios ÷ 1 lead convertido
    const fin = await (await handleRequest(req("/api/financeiro"), ENV, d)).json() as { cac: number; leadsConvertidos: number };
    expect(fin.leadsConvertidos).toBe(1);
    expect(fin.cac).toBe(600);
  });

  it("PUT status=convertido cru NÃO infla o CAC (só /converter, que cria empresa, conta)", async () => {
    const d = deps();
    const lead = await (await handleRequest(req("/api/leads", "POST", { nome: "Fake" }), ENV, d)).json() as { id: string };
    await handleRequest(req("/api/custos", "POST", { descricao: "Ads", valor: 300, tipo: "anuncios" }), ENV, d);
    await handleRequest(req(`/api/leads/${lead.id}`, "PUT", { status: "convertido" }), ENV, d);
    const fin = await (await handleRequest(req("/api/financeiro"), ENV, d)).json() as { leadsConvertidos: number; cac: number | null };
    expect(fin.leadsConvertidos).toBe(0); // sem empresaId não conta
    expect(fin.cac).toBeNull();
  });

  it("converter lead já convertido → 409", async () => {
    const d = deps();
    const lead = await (await handleRequest(req("/api/leads", "POST", { nome: "Dup" }), ENV, d)).json() as { id: string };
    await handleRequest(req(`/api/leads/${lead.id}/converter`, "POST"), ENV, d);
    const again = await handleRequest(req(`/api/leads/${lead.id}/converter`, "POST"), ENV, d);
    expect(again.status).toBe(409);
  });
});
