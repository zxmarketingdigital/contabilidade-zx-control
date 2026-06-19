// Invariantes dos agentes 2-5 (spec §5.2-5.5, §7.1-7.2). Falham se revertidos.
import { describe, expect, it } from "vitest";
import { DISCLAIMER } from "../src/config";
import { gerarEnquadramento, montarPromptEnquadramento } from "../src/agents/enquadramento";
import { gerarComunicado, montarPromptComunicado } from "../src/agents/comunicado";
import { gerarConsultoria, montarPromptConsultor } from "../src/agents/consultor";
import { gerarRespostaFisco, montarPromptFisco } from "../src/agents/fisco";

const llm = async () => "texto gerado pela IA";
const llmQuebra = async () => {
  throw new Error("gemini down");
};

describe("disclaimer obrigatório em todos os agentes (spec §7.1)", () => {
  it("Enquadramento embute disclaimer", async () => {
    const r = await gerarEnquadramento({ dados: "Padaria, faturamento médio, 2 sócios" }, { llm });
    expect(r.conteudo).toContain(DISCLAIMER);
  });
  it("Comunicado embute disclaimer", async () => {
    const r = await gerarComunicado({ situacao: "DAS a pagar este mês e nota pendente" }, { llm });
    expect(r.conteudo).toContain(DISCLAIMER);
  });
  it("Consultor embute disclaimer", async () => {
    const r = await gerarConsultoria({ pergunta: "Posso migrar para o Simples?" }, { llm });
    expect(r.conteudo).toContain(DISCLAIMER);
  });
  it("Fisco embute disclaimer", async () => {
    const r = await gerarRespostaFisco({ intimacao: "Intimação fiscal para apresentar documentos X" }, { llm });
    expect(r.conteudo).toContain(DISCLAIMER);
  });
  it("disclaimer presente mesmo quando a IA falha", async () => {
    const r = await gerarConsultoria({ pergunta: "Dúvida qualquer" }, { llm: llmQuebra });
    expect(r.conteudo).toContain(DISCLAIMER);
  });
});

describe("não afirma valor/lei — bloco de proibição em todo prompt (spec §7.2)", () => {
  const casos: Array<[string, string]> = [
    ["enquadramento", montarPromptEnquadramento("dados")],
    ["comunicado", montarPromptComunicado({ situacao: "situação do mês" })],
    ["consultor", montarPromptConsultor("pergunta")],
    ["fisco", montarPromptFisco({ intimacao: "texto da intimação fiscal" })],
  ];
  for (const [nome, prompt] of casos) {
    it(`${nome}: proíbe valor e nº de norma`, () => {
      expect(prompt).toMatch(/NÃO afirme valores/i);
      expect(prompt).toMatch(/NÃO cite número de artigo/i);
      expect(prompt).toMatch(/legislação vigente/i);
    });
  }
});

describe("validação de input", () => {
  it("Consultor rejeita pergunta vazia", async () => {
    await expect(gerarConsultoria({ pergunta: "" }, { llm })).rejects.toBeTruthy();
  });
  it("Fisco rejeita intimação curta demais", async () => {
    await expect(gerarRespostaFisco({ intimacao: "oi" }, { llm })).rejects.toBeTruthy();
  });
  it("Enquadramento rejeita dados curtos", async () => {
    await expect(gerarEnquadramento({ dados: "x" }, { llm })).rejects.toBeTruthy();
  });
});
