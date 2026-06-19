// Router — auth fail-closed NO CAMINHO de cada rota (spec §4) + grava-vs-lê via HTTP.
import { describe, expect, it } from "vitest";
import { handleRequest, type AppDeps } from "../src/app";
import { AgendaMemoria } from "../src/agenda";
import { SaidasMemoria } from "../src/saidas";
import { CompetenciasMemoria, EmpresasMemoria } from "../src/entidades";
import type { AuthEnv } from "../src/auth";

const ENV: AuthEnv = { SUPABASE_URL: "https://x.supabase.co", SUPABASE_SERVICE_KEY: "svc" };

function deps(over: Partial<AppDeps> = {}): AppDeps {
  return {
    agenda: new AgendaMemoria(),
    saidas: new SaidasMemoria(),
    empresas: new EmpresasMemoria(),
    competencias: new CompetenciasMemoria(),
    llm: async () => "orientação",
    verify: async () => ({ id: "u1", email: "c@e.com" }), // token "válido" nos testes
    ...over,
  };
}

function post(body: unknown, auth?: string): Request {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (auth) headers.set("Authorization", auth);
  return new Request("https://w/api/agentes/calendario", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

const CORPO = { empresaId: "emp-1", regime: "simples", competencia: { ano: 2026, mes: 5 } };

describe("auth fail-closed no caminho da rota", () => {
  it("POST calendário sem token → 401 e NÃO executa o agente (agenda intacta)", async () => {
    const d = deps();
    const res = await handleRequest(post(CORPO), ENV, d);
    expect(res.status).toBe(401);
    // o agente nem rodou: nada foi gravado
    expect(await d.agenda.listarPrazos("emp-1")).toHaveLength(0);
  });

  it("GET /api/prazos sem token → 401", async () => {
    const res = await handleRequest(new Request("https://w/api/prazos?empresaId=emp-1"), ENV, deps());
    expect(res.status).toBe(401);
  });

  it("token inválido (verify rejeita) → 401", async () => {
    const d = deps({
      verify: async () => {
        throw new (await import("../src/auth")).AuthError();
      },
    });
    const res = await handleRequest(post(CORPO, "Bearer xyz"), ENV, d);
    expect(res.status).toBe(401);
  });
});

describe("fluxo autenticado — grava-vs-lê via HTTP", () => {
  it("POST gera+grava (201) e GET /api/prazos lê o MESMO data_fatal", async () => {
    const d = deps();
    const resPost = await handleRequest(post(CORPO, "Bearer ok"), ENV, d);
    expect(resPost.status).toBe(201);
    const resultado = (await resPost.json()) as { obrigacoes: { sigla: string; dataFatal: string }[] };
    expect(resultado.obrigacoes.find((o) => o.sigla === "DAS")?.dataFatal).toBe("2026-06-19");

    const resGet = await handleRequest(
      new Request("https://w/api/prazos?empresaId=emp-1", { headers: { Authorization: "Bearer ok" } }),
      ENV,
      d,
    );
    expect(resGet.status).toBe(200);
    const prazos = (await resGet.json()) as { sigla: string; dataFatal: string }[];
    expect(prazos.find((p) => p.sigla === "DAS")?.dataFatal).toBe("2026-06-19");
  });

  it("GET /api/prazos sem empresaId → 400", async () => {
    const res = await handleRequest(
      new Request("https://w/api/prazos", { headers: { Authorization: "Bearer ok" } }),
      ENV,
      deps(),
    );
    expect(res.status).toBe(400);
  });
});

describe("agentes texto (2-5) + histórico de saídas", () => {
  function postAg(path: string, body: unknown): Request {
    return new Request(`https://w${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer ok" },
      body: JSON.stringify(body),
    });
  }

  it("Consultor sem token → 401 e nada registrado", async () => {
    const d = deps();
    const req = new Request("https://w/api/agentes/consultor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pergunta: "Posso optar pelo Simples?" }),
    });
    expect((await handleRequest(req, ENV, d)).status).toBe(401);
    expect(await d.saidas.listar()).toHaveLength(0);
  });

  it("POST consultor (201) grava saída e GET /api/saidas lê o MESMO conteúdo", async () => {
    const d = deps();
    const resPost = await handleRequest(
      postAg("/api/agentes/consultor", { empresaId: "emp-1", pergunta: "Posso optar pelo Simples?" }),
      ENV,
      d,
    );
    expect(resPost.status).toBe(201);
    const saida = (await resPost.json()) as { conteudo: string; agente: string };
    expect(saida.agente).toBe("consultor");

    const resGet = await handleRequest(
      new Request("https://w/api/saidas?empresaId=emp-1", { headers: { Authorization: "Bearer ok" } }),
      ENV,
      d,
    );
    const lista = (await resGet.json()) as { conteudo: string }[];
    expect(lista).toHaveLength(1);
    expect(lista[0]?.conteudo).toBe(saida.conteudo); // grava-vs-lê
  });

  it("input inválido → 400", async () => {
    const res = await handleRequest(postAg("/api/agentes/fisco", { intimacao: "curto" }), ENV, deps());
    expect(res.status).toBe(400);
  });
});
