// Agente 1 — invariantes do spec §5.1/§7. Testes falham se o código for revertido.
import { describe, expect, it } from "vitest";
import {
  comDisclaimer,
  gerarCalendario,
  montarPromptCalendario,
  type CalendarioInput,
} from "../src/agents/calendario";
import { AgendaMemoria } from "../src/agenda";
import { DISCLAIMER } from "../src/config";

const INPUT: CalendarioInput = {
  empresaId: "emp-1",
  regime: "simples",
  competencia: { ano: 2026, mes: 5 },
};

// llm fake — devolve texto SEM disclaimer e sem nada fiscal proibido.
const llmFake = async () => "Organize os pagamentos do mês conforme as datas.";

describe("disclaimer obrigatório (spec §7.1)", () => {
  it("comDisclaimer embute o texto exato", () => {
    expect(comDisclaimer("qualquer coisa")).toContain(DISCLAIMER);
  });
  it("não duplica se já presente", () => {
    const t = comDisclaimer(`texto\n\n${DISCLAIMER}`);
    expect(t.split(DISCLAIMER)).toHaveLength(2);
  });
  it("a saída do agente SEMPRE contém o disclaimer (mesmo com IA muda)", async () => {
    const r = await gerarCalendario(INPUT, { agenda: new AgendaMemoria(), llm: llmFake });
    expect(r.texto).toContain(DISCLAIMER);
  });
  it("disclaimer presente mesmo quando a IA falha", async () => {
    const llmQuebra = async () => {
      throw new Error("gemini down");
    };
    const r = await gerarCalendario(INPUT, { agenda: new AgendaMemoria(), llm: llmQuebra });
    expect(r.texto).toContain(DISCLAIMER);
  });
});

describe("não afirma valor/lei (spec §7.2)", () => {
  it("o prompt PROÍBE valor/alíquota e nº de norma/artigo", () => {
    const p = montarPromptCalendario(INPUT, []);
    expect(p).toMatch(/NÃO afirme valores/i);
    expect(p).toMatch(/NÃO cite número de artigo|legislação vigente/i);
  });
});

describe("datas determinísticas + grava-vs-lê (DoD item 2)", () => {
  it("calcula as obrigações do regime sem depender da IA", async () => {
    const r = await gerarCalendario(INPUT, { agenda: new AgendaMemoria(), llm: llmFake });
    const das = r.obrigacoes.find((o) => o.sigla === "DAS");
    expect(das?.dataFatal).toBe("2026-06-19"); // 20/jun é sábado → antecipa
  });

  it("o prazo GRAVADO pelo agente é o MESMO LIDO na agenda (coluna data_fatal)", async () => {
    const agenda = new AgendaMemoria();
    const r = await gerarCalendario(INPUT, { agenda, llm: llmFake });

    const lidos = await agenda.listarPrazos("emp-1");
    // toda obrigação calculada virou linha na agenda, com a mesma data_fatal
    expect(lidos).toHaveLength(r.obrigacoes.length);
    const gravadoDAS = lidos.find((p) => p.sigla === "DAS");
    expect(gravadoDAS?.dataFatal).toBe("2026-06-19");
    // ponta a ponta: o que o agente devolveu === o que a agenda persistiu
    for (const o of r.obrigacoes) {
      expect(lidos.find((p) => p.sigla === o.sigla)?.dataFatal).toBe(o.dataFatal);
    }
  });

  it("rejeita input inválido (regime fora do enum)", async () => {
    await expect(
      gerarCalendario({ ...INPUT, regime: "lucro_arbitrado" }, { agenda: new AgendaMemoria(), llm: llmFake }),
    ).rejects.toBeTruthy();
  });
});
