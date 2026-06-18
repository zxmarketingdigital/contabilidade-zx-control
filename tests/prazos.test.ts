// Invariante da linha (spec §7.3): prazos em dias úteis, America/Sao_Paulo,
// feriados nacionais (fixos + móveis) e ANTECIPAÇÃO de vencimento.
// Casos âncora calculados à mão — falham se a lógica de antecipação for revertida.
import { describe, expect, it } from "vitest";
import {
  antecipaParaDiaUtil,
  calendarioObrigacoes,
  dataFatalObrigacao,
  isDiaUtil,
  isFeriado,
  pascoa,
  toISO,
} from "../src/prazos";

describe("Páscoa (base dos feriados móveis)", () => {
  it("calcula o domingo de Páscoa (Meeus)", () => {
    expect(toISO(pascoa(2025))).toBe("2025-04-20");
    expect(toISO(pascoa(2026))).toBe("2026-04-05");
  });
});

describe("isFeriado", () => {
  it("reconhece feriado fixo nacional", () => {
    expect(isFeriado({ ano: 2026, mes: 9, dia: 7 })).toBe(true); // Independência
    expect(isFeriado({ ano: 2026, mes: 11, dia: 20 })).toBe(true); // Consciência Negra
  });
  it("reconhece feriado móvel (Corpus Christi 2026 = 04/jun)", () => {
    expect(isFeriado({ ano: 2026, mes: 6, dia: 4 })).toBe(true);
  });
  it("dia comum não é feriado", () => {
    expect(isFeriado({ ano: 2026, mes: 6, dia: 10 })).toBe(false);
  });
});

describe("antecipaParaDiaUtil — feriado no meio e fim de semana", () => {
  it("antecipa quando cai em fim de semana (sábado → sexta)", () => {
    // 20/jun/2026 é sábado → 19/jun (sexta) é dia útil
    expect(toISO(antecipaParaDiaUtil({ ano: 2026, mes: 6, dia: 20 }))).toBe("2026-06-19");
  });
  it("antecipa em feriado caindo no MEIO da semana (Tiradentes terça → segunda)", () => {
    // 21/abr/2026 (Tiradentes) é terça-feira → antecipa para segunda 20/abr
    expect(toISO(antecipaParaDiaUtil({ ano: 2026, mes: 4, dia: 21 }))).toBe("2026-04-20");
  });
  it("encadeia domingo+feriado (15/nov/2026 domingo e feriado → sexta 13/nov)", () => {
    expect(toISO(antecipaParaDiaUtil({ ano: 2026, mes: 11, dia: 15 }))).toBe("2026-11-13");
  });
  it("não mexe quando já é dia útil", () => {
    expect(toISO(antecipaParaDiaUtil({ ano: 2026, mes: 2, dia: 20 }))).toBe("2026-02-20");
    expect(isDiaUtil({ ano: 2026, mes: 2, dia: 20 })).toBe(true);
  });
});

describe("dataFatalObrigacao — mesOffset e virada de ano", () => {
  it("DAS (dia 20, mês+1) da competência mai/2026 vence 20/jun (sáb) → antecipa 19/jun", () => {
    expect(toISO(dataFatalObrigacao({ ano: 2026, mes: 5 }, { diaVenc: 20, mesOffset: 1 }))).toBe(
      "2026-06-19",
    );
  });
  it("vira o ano: competência dez/2026, dia 20 mês+1 → jan/2027", () => {
    expect(toISO(dataFatalObrigacao({ ano: 2026, mes: 12 }, { diaVenc: 20, mesOffset: 1 }))).toBe(
      "2027-01-20",
    );
  });
});

describe("calendarioObrigacoes — catálogo determinístico por regime", () => {
  it("Simples em mai/2026: ordena por data fatal e aplica antecipação no DAS", () => {
    const cal = calendarioObrigacoes("simples", { ano: 2026, mes: 5 });
    const siglas = cal.map((o) => o.sigla);
    expect(siglas).toContain("DAS");
    expect(siglas).toContain("DCTFWeb");
    // ordenado por dataFatal ascendente
    const datas = cal.map((o) => o.dataFatal);
    expect([...datas]).toEqual([...datas].sort((a, b) => a.localeCompare(b)));
    // DAS antecipado para sexta 19/jun
    expect(cal.find((o) => o.sigla === "DAS")?.dataFatal).toBe("2026-06-19");
  });
  it("MEI tem apenas DAS-MEI", () => {
    const cal = calendarioObrigacoes("mei", { ano: 2026, mes: 5 });
    expect(cal).toHaveLength(1);
    expect(cal[0]?.sigla).toBe("DAS-MEI");
  });
});
