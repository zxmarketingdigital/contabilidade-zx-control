// CRUD das entidades do painel (spec §6) via HTTP — auth fail-closed + grava-vs-lê.
import { describe, expect, it } from "vitest";
import { handleRequest, type AppDeps } from "../src/app";
import { AgendaMemoria } from "../src/agenda";
import { SaidasMemoria } from "../src/saidas";
import { CompetenciasMemoria, EmpresasMemoria } from "../src/entidades";
import type { AuthEnv } from "../src/auth";

const ENV: AuthEnv = { SUPABASE_URL: "https://x.supabase.co", SUPABASE_SERVICE_KEY: "svc" };
const AUTH = { Authorization: "Bearer ok", "Content-Type": "application/json" };

function deps(): AppDeps {
  return {
    agenda: new AgendaMemoria(),
    saidas: new SaidasMemoria(),
    empresas: new EmpresasMemoria(),
    competencias: new CompetenciasMemoria(),
    llm: async () => "x",
    verify: async () => ({ id: "u1" }),
  };
}

describe("CRUD empresas — auth + grava-vs-lê", () => {
  it("POST /api/empresas sem token → 401 e nada criado", async () => {
    const d = deps();
    const req = new Request("https://w/api/empresas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ razaoSocial: "X", regime: "simples" }),
    });
    expect((await handleRequest(req, ENV, d)).status).toBe(401);
    expect(await d.empresas.listar()).toHaveLength(0);
  });

  it("cria empresa (201) e lê na listagem com os mesmos campos", async () => {
    const d = deps();
    const res = await handleRequest(
      new Request("https://w/api/empresas", {
        method: "POST",
        headers: AUTH,
        body: JSON.stringify({ razaoSocial: "Padaria Pão Quente LTDA", regime: "simples", cnpj: "12.345.678/0001-90" }),
      }),
      ENV,
      d,
    );
    expect(res.status).toBe(201);
    const criada = (await res.json()) as { id: string; razaoSocial: string };

    const lista = (await (
      await handleRequest(new Request("https://w/api/empresas", { headers: AUTH }), ENV, d)
    ).json()) as Array<{ id: string; razaoSocial: string; regime: string }>;
    expect(lista).toHaveLength(1);
    expect(lista[0]).toMatchObject({ id: criada.id, razaoSocial: "Padaria Pão Quente LTDA", regime: "simples" });
  });

  it("regime fora do enum → 400", async () => {
    const res = await handleRequest(
      new Request("https://w/api/empresas", {
        method: "POST",
        headers: AUTH,
        body: JSON.stringify({ razaoSocial: "X", regime: "arbitrado" }),
      }),
      ENV,
      deps(),
    );
    expect(res.status).toBe(400);
  });

  it("DELETE remove a empresa", async () => {
    const d = deps();
    const criada = (await (
      await handleRequest(
        new Request("https://w/api/empresas", { method: "POST", headers: AUTH, body: JSON.stringify({ razaoSocial: "Y", regime: "mei" }) }),
        ENV,
        d,
      )
    ).json()) as { id: string };
    const del = await handleRequest(
      new Request(`https://w/api/empresas/${criada.id}`, { method: "DELETE", headers: AUTH }),
      ENV,
      d,
    );
    expect(del.status).toBe(200);
    expect(await d.empresas.listar()).toHaveLength(0);
  });
});

describe("CRUD competências + status de prazo", () => {
  it("cria competência e filtra por empresaId", async () => {
    const d = deps();
    await handleRequest(
      new Request("https://w/api/competencias", { method: "POST", headers: AUTH, body: JSON.stringify({ empresaId: "emp-1", ano: 2026, mes: 5 }) }),
      ENV,
      d,
    );
    const lista = (await (
      await handleRequest(new Request("https://w/api/competencias?empresaId=emp-1", { headers: AUTH }), ENV, d)
    ).json()) as Array<{ status: string }>;
    expect(lista).toHaveLength(1);
    expect(lista[0]?.status).toBe("aberta");
  });

  it("PUT /api/prazos/:id/status marca cumprido", async () => {
    const d = deps();
    const [p] = await d.agenda.inserirPrazos([{ empresaId: "emp-1", sigla: "DAS", descricao: "x", dataFatal: "2026-06-19" }]);
    const res = await handleRequest(
      new Request(`https://w/api/prazos/${p!.id}/status`, { method: "PUT", headers: AUTH, body: JSON.stringify({ status: "cumprido" }) }),
      ENV,
      d,
    );
    expect(res.status).toBe(200);
    expect((await d.agenda.listarPrazos("emp-1"))[0]?.status).toBe("cumprido");
  });

  it("status inválido → 400", async () => {
    const res = await handleRequest(
      new Request("https://w/api/prazos/p1/status", { method: "PUT", headers: AUTH, body: JSON.stringify({ status: "xpto" }) }),
      ENV,
      deps(),
    );
    expect(res.status).toBe(400);
  });
});
