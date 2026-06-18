// 5 invariantes anti-ban/anti-spam da engine de disparo (casca catálogo, congelada).
// Mock do banco e adapter via funções injetáveis — sem banco real.
import { describe, expect, it } from "vitest";
import { dispatch } from "../src/scheduler/scheduler";
import type { DbLike, AdapterLike, DispatchOptions } from "../src/scheduler/types";

// Janela 8–18 em horário do Brasil (America/Sao_Paulo = UTC-3).
// 15:00Z = 12:00 BRT → dentro da janela.
const NOW_9H = new Date("2026-01-01T15:00:00Z");

function baseOpts(overrides: Partial<DispatchOptions> = {}): DispatchOptions {
  return {
    clienteId: "c1",
    numero: "5511999990001",
    agente: "followup",
    dedup: { tipo: "week" },
    mensagem: "Olá!",
    window: { start: 8, end: 18 },
    now: NOW_9H,
    ...overrides,
  };
}

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

function makeAdapter(): AdapterLike & { sent: string[] } {
  const sent: string[] = [];
  return { sent, send: async (num, msg) => void sent.push(`${num}:${msg}`) };
}

// ── (a) dedup em janela ────────────────────────────────────────────────────
describe("(a) dedup em janela", () => {
  it("bloqueia quando disparo já existe na janela", async () => {
    const db = makeDb({ existeDisparo: async () => true });
    const adapter = makeAdapter();
    const result = await dispatch(db, adapter, baseOpts());
    expect(result).toBe("bloqueado");
    expect(adapter.sent).toHaveLength(0);
  });

  it("envia quando não há disparo anterior", async () => {
    const db = makeDb();
    const adapter = makeAdapter();
    const result = await dispatch(db, adapter, baseOpts());
    expect(result).toBe("enviado");
    expect(adapter.sent).toHaveLength(1);
  });
});

// ── (b) janela inferior+superior ──────────────────────────────────────────
describe("(b) janela inferior+superior", () => {
  it("bloqueia antes da janela (hora < start)", async () => {
    const result = await dispatch(
      makeDb(),
      makeAdapter(),
      baseOpts({ now: new Date("2026-01-01T10:30:00Z") }), // 07:30 BRT
    );
    expect(result).toBe("bloqueado");
  });

  it("bloqueia após a janela (hora >= end)", async () => {
    const result = await dispatch(
      makeDb(),
      makeAdapter(),
      baseOpts({ now: new Date("2026-01-01T21:00:00Z") }), // 18:00 BRT
    );
    expect(result).toBe("bloqueado");
  });

  it("permite exatamente no início da janela (hora === start)", async () => {
    const result = await dispatch(
      makeDb(),
      makeAdapter(),
      baseOpts({ now: new Date("2026-01-01T11:00:00Z") }), // 08:00 BRT
    );
    expect(result).toBe("enviado");
  });
});

// ── (c) idempotência por entidade (cliente × entidade) ────────────────────
describe("(c) idempotência por entidade — não reavisa cliente×entidade", () => {
  it("bloqueia se (clienteId, entityId) já foi notificado", async () => {
    const db = makeDb({ existeDisparo: async () => true });
    const result = await dispatch(
      db,
      makeAdapter(),
      baseOpts({ agente: "radar", dedup: { tipo: "entity", entityId: "e1" } }),
    );
    expect(result).toBe("bloqueado");
  });

  it("envia se (clienteId, entityId) ainda não foi notificado", async () => {
    const result = await dispatch(
      makeDb(),
      makeAdapter(),
      baseOpts({ agente: "radar", dedup: { tipo: "entity", entityId: "e1" } }),
    );
    expect(result).toBe("enviado");
  });
});

// ── (d) rate-cap GLOBAL da instância emissora ─────────────────────────────
describe("(d) rate-cap GLOBAL da emissora (default 20/h · 80/dia)", () => {
  it("bloqueia quando envios/hora atingem o cap", async () => {
    const db = makeDb({ contarEnviosHora: async () => 20 });
    expect(await dispatch(db, makeAdapter(), baseOpts())).toBe("bloqueado");
  });

  it("bloqueia quando envios/dia atingem o cap", async () => {
    const db = makeDb({ contarEnviosDia: async () => 80 });
    expect(await dispatch(db, makeAdapter(), baseOpts())).toBe("bloqueado");
  });

  it("envia quando abaixo dos limites", async () => {
    const db = makeDb({ contarEnviosHora: async () => 19, contarEnviosDia: async () => 79 });
    expect(await dispatch(db, makeAdapter(), baseOpts())).toBe("enviado");
  });

  it("respeita rateCap customizado do nicho", async () => {
    const db = makeDb({ contarEnviosHora: async () => 5 });
    expect(await dispatch(db, makeAdapter(), baseOpts({ rateCap: { hora: 5, dia: 50 } }))).toBe("bloqueado");
  });
});

// ── (e) opt-out "SAIR" ────────────────────────────────────────────────────
describe("(e) opt-out SAIR bloqueia todo proativo", () => {
  it("bloqueia quando cliente tem opt_out=true", async () => {
    const db = makeDb({ clienteOptOut: async () => true });
    expect(await dispatch(db, makeAdapter(), baseOpts())).toBe("bloqueado");
  });

  it("envia quando opt_out=false", async () => {
    expect(await dispatch(makeDb(), makeAdapter(), baseOpts())).toBe("enviado");
  });
});
