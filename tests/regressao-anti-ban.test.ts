// Regressão das invariantes anti-ban da ENGINE (casca catálogo, congelada).
// Estes blocos FALHAM se a engine regredir — foi onde o Contabilidade teve bugs CRITICAL no PR#2.
// (Invariantes de NICHO — auth nos endpoints de import e "import popula a coluna que o match lê" —
//  ficam nos testes do REPO DO NICHO, não aqui: a casca não tem api/index/catalog.)
import { describe, expect, it, vi } from "vitest";
import { dispatch } from "../src/scheduler/scheduler";
import { gerarChave } from "../src/scheduler/dedup";
import type { DbLike, AdapterLike, DispatchOptions } from "../src/scheduler/types";

const NOW = new Date("2026-01-15T15:00:00Z"); // 12:00 BRT — dentro da janela 8–18

function baseOpts(overrides: Partial<DispatchOptions> = {}): DispatchOptions {
  return {
    clienteId: "c1",
    numero: "5511999990001",
    agente: "followup",
    dedup: { tipo: "week" },
    mensagem: "Olá!",
    window: { start: 8, end: 18 },
    now: NOW,
    ...overrides,
  };
}

function makeAdapter(): AdapterLike & { sent: string[] } {
  const sent: string[] = [];
  return { sent, send: async (num, msg) => void sent.push(`${num}:${msg}`) };
}

// ── rate-cap é GLOBAL da instância, não por destinatário ──
describe("rate-cap global da linha emissora", () => {
  function statefulDb() {
    let enviados = 0;
    const chaves = new Set<string>();
    const db: DbLike = {
      existeDisparo: async (_c, _a, chave) => chaves.has(chave),
      contarEnviosHora: async () => enviados,
      contarEnviosDia: async () => enviados,
      clienteOptOut: async () => false,
      registrarDisparo: async (p) => {
        enviados++;
        chaves.add(p.chave);
      },
    };
    return { db, total: () => enviados };
  }

  it("bloqueia o 21º envio mesmo sendo destinatários diferentes", async () => {
    const { db, total } = statefulDb();
    const adapter = makeAdapter();
    let bloqueados = 0;
    for (let i = 0; i < 25; i++) {
      // cada disparo é para um cliente/número distinto — no bug antigo (cap por número)
      // o cap NUNCA dispararia e os 25 sairiam.
      const r = await dispatch(db, adapter, baseOpts({ clienteId: `c${i}`, numero: `55${i}` }));
      if (r === "bloqueado") bloqueados++;
    }
    expect(total()).toBe(20); // cap global 20/h respeitado
    expect(bloqueados).toBe(5);
  });

  it("contarEnviosHora é chamado só com a data (sem número)", async () => {
    const spy = vi.fn(async (_desde: Date) => 0);
    const db: DbLike = {
      existeDisparo: async () => false,
      contarEnviosHora: spy,
      contarEnviosDia: async () => 0,
      clienteOptOut: async () => false,
      registrarDisparo: async () => {},
    };
    await dispatch(db, makeAdapter(), baseOpts());
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]).toHaveLength(1);
    expect(spy.mock.calls[0]![0]).toBeInstanceOf(Date);
  });
});

// ── delay/jitter após cada envio ──
describe("delay/jitter após envio", () => {
  function makeDb(overrides: Partial<DbLike> = {}): DbLike {
    return {
      existeDisparo: async () => false,
      contarEnviosHora: async () => 0,
      contarEnviosDia: async () => 0,
      clienteOptOut: async () => false,
      registrarDisparo: async () => {},
      ...overrides,
    };
  }

  it("chama sleep com delayMs após enviar", async () => {
    const sleep = vi.fn(async () => {});
    const r = await dispatch(makeDb(), makeAdapter(), baseOpts({ delayMs: 5000, sleep }));
    expect(r).toBe("enviado");
    expect(sleep).toHaveBeenCalledWith(5000);
  });

  it("NÃO chama sleep quando o envio é bloqueado", async () => {
    const sleep = vi.fn(async () => {});
    const db = makeDb({ clienteOptOut: async () => true });
    const r = await dispatch(db, makeAdapter(), baseOpts({ delayMs: 5000, sleep }));
    expect(r).toBe("bloqueado");
    expect(sleep).not.toHaveBeenCalled();
  });
});

// ── dedup por mês+toque distingue toques (ex.: pós-venda D+3 vs D+30) ──
describe("dedup month inclui o toque", () => {
  it("toque 1 e toque 2 no mesmo mês geram chaves diferentes", () => {
    const k1 = gerarChave("c1", "posvenda", NOW, { tipo: "month", toque: 1 });
    const k2 = gerarChave("c1", "posvenda", NOW, { tipo: "month", toque: 2 });
    expect(k1).not.toBe(k2);
  });

  it("dedup entity é estável por (cliente, agente, entidade)", () => {
    const k1 = gerarChave("c1", "radar", NOW, { tipo: "entity", entityId: "e1" });
    const k2 = gerarChave("c1", "radar", new Date("2026-03-01T00:00:00Z"), { tipo: "entity", entityId: "e1" });
    expect(k1).toBe(k2); // mesma entidade → mesma chave, independente do tempo
  });
});
