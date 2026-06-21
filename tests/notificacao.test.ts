// Notificação de prazo (v1.1): montador de resumo (puro) + orquestrador que
// DEVE passar pela engine anti-ban congelada (janela BRT + dedup diário).
// Se alguém "encurtar" o caminho e chamar o adapter direto, os testes de
// idempotência e de janela quebram.
import { describe, expect, it } from "vitest";
import { montarResumoDiario, isoDateBRT } from "../src/notificacao/digest";
import { enviarResumoDiario } from "../src/notificacao/run";
import type { DbLike, AdapterLike } from "../src/scheduler/types";
import type { PrazoRow } from "../src/agenda";

const HOJE = "2026-06-15";
const EMPRESAS = [
  { id: "e1", razaoSocial: "Padaria Pão Quente" },
  { id: "e2", razaoSocial: "Studio Bella" },
  { id: "e3", razaoSocial: "Café Encerrado", inativo: true },
];
function prazo(over: Partial<PrazoRow>): PrazoRow {
  return { id: "p", empresaId: "e1", sigla: "DAS", descricao: "x", dataFatal: HOJE, status: "pendente", ...over };
}

describe("montarResumoDiario (puro)", () => {
  it("lista vencidos e próximos, ignora os longe e os de empresa inativa", () => {
    const prazos = [
      prazo({ id: "a", empresaId: "e1", sigla: "DAS", dataFatal: "2026-06-10" }), // vencido
      prazo({ id: "b", empresaId: "e2", sigla: "ISS", dataFatal: "2026-06-18" }), // em 3 dias
      prazo({ id: "c", empresaId: "e1", sigla: "ECD", dataFatal: "2026-06-30" }), // longe → fora
      prazo({ id: "d", empresaId: "e3", sigla: "DAS", dataFatal: "2026-06-16" }), // inativa → fora
    ];
    const msg = montarResumoDiario(prazos, EMPRESAS, HOJE, 5)!;
    expect(msg).toContain("Vencidos (1)");
    expect(msg).toContain("Padaria Pão Quente — DAS");
    expect(msg).toContain("Vencem em até 5 dias (1)");
    expect(msg).toContain("Studio Bella — ISS");
    expect(msg).not.toContain("ECD");
    expect(msg).not.toContain("Café Encerrado");
  });

  it("retorna null quando não há vencidos nem próximos", () => {
    const prazos = [prazo({ dataFatal: "2026-06-30" }), prazo({ dataFatal: "2026-06-10", status: "cumprido" })];
    expect(montarResumoDiario(prazos, EMPRESAS, HOJE, 5)).toBeNull();
  });

  it("isoDateBRT devolve o dia civil de São Paulo", () => {
    // 2026-06-16T01:00Z = 22:00 BRT do dia 15
    expect(isoDateBRT(new Date("2026-06-16T01:00:00Z"))).toBe("2026-06-15");
  });
});

// ── Orquestrador: tem que ir pela engine (dispatch) ──
function statefulDb() {
  const chaves = new Set<string>();
  let enviados = 0;
  const db: DbLike = {
    existeDisparo: async (_c, _a, chave) => chaves.has(chave),
    contarEnviosHora: async () => enviados,
    contarEnviosDia: async () => enviados,
    clienteOptOut: async () => false,
    registrarDisparo: async (p) => { if (p.status === "enviado") { enviados++; chaves.add(p.chave); } },
  };
  return { db, enviados: () => enviados };
}
function adapterFake(): AdapterLike & { sent: string[] } {
  const sent: string[] = [];
  return { sent, send: async (n, m) => void sent.push(`${n}:${m}`) };
}
const PRAZOS = [prazo({ id: "a", empresaId: "e1", dataFatal: "2026-06-10" })]; // 1 vencido
const deps = (now: Date, db: DbLike, adapter: AdapterLike) => ({
  agenda: { listarTodos: async () => PRAZOS },
  empresas: { listar: async () => EMPRESAS },
  db, adapter, numero: "5511999990000", now,
});
const DENTRO = new Date("2026-06-15T13:00:00Z"); // 10:00 BRT (janela 8–18)
const FORA = new Date("2026-06-15T09:00:00Z");    // 06:00 BRT (antes da janela)

describe("enviarResumoDiario via engine anti-ban", () => {
  it("envia 1x dentro da janela e é idempotente no mesmo dia", async () => {
    const { db } = statefulDb();
    const ad = adapterFake();
    expect(await enviarResumoDiario(deps(DENTRO, db, ad))).toBe("enviado");
    expect(ad.sent).toHaveLength(1);
    expect(ad.sent[0]).toContain("Contabilidade ZX Control");
    // 2ª vez no mesmo dia → dedup bloqueia, NÃO reenvia
    expect(await enviarResumoDiario(deps(DENTRO, db, ad))).toBe("bloqueado");
    expect(ad.sent).toHaveLength(1);
  });

  it("fora da janela BRT não envia", async () => {
    const { db } = statefulDb();
    const ad = adapterFake();
    expect(await enviarResumoDiario(deps(FORA, db, ad))).toBe("bloqueado");
    expect(ad.sent).toHaveLength(0);
  });

  it("sem prazos a avisar → vazio, não toca o adapter", async () => {
    const { db } = statefulDb();
    const ad = adapterFake();
    const d = { ...deps(DENTRO, db, ad), agenda: { listarTodos: async () => [prazo({ dataFatal: "2026-06-30" })] } };
    expect(await enviarResumoDiario(d)).toBe("vazio");
    expect(ad.sent).toHaveLength(0);
  });
});
