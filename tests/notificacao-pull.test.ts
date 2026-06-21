// Endpoints pull: AUTH fail-closed (token dedicado, tempo constante) + DECISÃO
// read-only e CONFIRMAÇÃO separada. A dedup do dia só vale APÓS confirmar — uma
// falha de envio (sem confirmar) não consome o resumo. Se isso regredir (voltar a
// marcar na decisão, ou auth furar), estes testes quebram.
import { describe, expect, it } from "vitest";
import { handleNotificacaoPull, type PullDataDeps } from "../src/notificacao/pull";
import type { DbLike } from "../src/scheduler/types";
import type { PrazoRow } from "../src/agenda";

const ENV = { SUPABASE_URL: "https://x.supabase.co", SUPABASE_SERVICE_KEY: "svc", NOTIF_PULL_TOKEN: "tok-123" };
const EMPRESAS = [{ id: "e1", razaoSocial: "Padaria Pão Quente" }];
const PRAZOS: PrazoRow[] = [
  { id: "a", empresaId: "e1", sigla: "DAS", descricao: "x", dataFatal: "2026-06-10", status: "pendente" },
];
function statefulDb(): DbLike {
  const chaves = new Set<string>();
  let enviados = 0;
  return {
    existeDisparo: async (_c, _a, chave) => chaves.has(chave),
    contarEnviosHora: async () => enviados,
    contarEnviosDia: async () => enviados,
    clienteOptOut: async () => false,
    registrarDisparo: async (p) => { if (p.status === "enviado") { enviados++; chaves.add(p.chave); } },
  };
}
function dataDeps(now: Date): PullDataDeps {
  return { agenda: { listarTodos: async () => PRAZOS }, empresas: { listar: async () => EMPRESAS }, db: statefulDb(), now };
}
const DENTRO = new Date("2026-06-15T13:00:00Z"); // 10:00 BRT
const FORA = new Date("2026-06-15T09:00:00Z");    // 06:00 BRT

const getReq = (auth?: string) =>
  new Request("https://w/notificacao/pendente", auth ? { headers: { Authorization: auth } } : undefined);
const confReq = (auth: string | undefined, chave: unknown) =>
  new Request("https://w/notificacao/confirmado", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(auth ? { Authorization: auth } : {}) },
    body: JSON.stringify({ chave }),
  });
type Body = { enviar?: boolean; texto?: string; chave?: string; motivo?: string; ok?: boolean; error?: string };
const body = async (res: Response | null) => (await res!.json()) as Body;

describe("auth fail-closed do pull", () => {
  it("GET sem Authorization → 401", async () => {
    expect((await handleNotificacaoPull(getReq(), ENV, dataDeps(DENTRO)))?.status).toBe(401);
  });
  it("GET token errado → 401", async () => {
    expect((await handleNotificacaoPull(getReq("Bearer nope"), ENV, dataDeps(DENTRO)))?.status).toBe(401);
  });
  it("NOTIF_PULL_TOKEN ausente no env → 401 mesmo com token", async () => {
    const res = await handleNotificacaoPull(getReq("Bearer tok-123"), { ...ENV, NOTIF_PULL_TOKEN: undefined }, dataDeps(DENTRO));
    expect(res?.status).toBe(401);
  });
  it("POST /confirmado sem token → 401", async () => {
    expect((await handleNotificacaoPull(confReq(undefined, "k"), ENV, dataDeps(DENTRO)))?.status).toBe(401);
  });
  it("rota fora de /notificacao → null (segue p/ o roteador /api)", async () => {
    expect(await handleNotificacaoPull(new Request("https://w/api/empresas"), ENV)).toBeNull();
  });
});

describe("decisão (read-only) + confirmação", () => {
  it("dentro da janela + prazo vencido → enviar:true com texto e chave", async () => {
    const b = await body(await handleNotificacaoPull(getReq("Bearer tok-123"), ENV, dataDeps(DENTRO)));
    expect(b.enviar).toBe(true);
    expect(b.texto).toContain("Padaria Pão Quente");
    expect(b.chave).toBeTruthy();
  });

  it("decisão NÃO consome: dois GETs seguidos → ambos enviar:true", async () => {
    const deps = dataDeps(DENTRO);
    const a = await body(await handleNotificacaoPull(getReq("Bearer tok-123"), ENV, deps));
    const b = await body(await handleNotificacaoPull(getReq("Bearer tok-123"), ENV, deps));
    expect(a.enviar).toBe(true);
    expect(b.enviar).toBe(true);
  });

  it("após confirmar, a próxima decisão do dia → enviar:false (dedup)", async () => {
    const deps = dataDeps(DENTRO);
    const d = await body(await handleNotificacaoPull(getReq("Bearer tok-123"), ENV, deps));
    const conf = await handleNotificacaoPull(confReq("Bearer tok-123", d.chave), ENV, deps);
    expect(conf!.status).toBe(200);
    const again = await body(await handleNotificacaoPull(getReq("Bearer tok-123"), ENV, deps));
    expect(again.enviar).toBe(false);
    expect(again.motivo).toBe("bloqueado");
  });

  it("confirmar sem chave → 400", async () => {
    const res = await handleNotificacaoPull(confReq("Bearer tok-123", undefined), ENV, dataDeps(DENTRO));
    expect(res!.status).toBe(400);
  });

  it("fora da janela BRT → enviar:false", async () => {
    const b = await body(await handleNotificacaoPull(getReq("Bearer tok-123"), ENV, dataDeps(FORA)));
    expect(b.enviar).toBe(false);
  });
});
