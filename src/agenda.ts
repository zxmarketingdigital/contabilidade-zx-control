// ════════════════════════════════════════════════════════════════════════
// Agenda de prazos — camada de persistência das obrigações (tabela `prazos`).
//
// Contrato grava-vs-lê (DoD item 2): o MESMO campo que o Agente 1 grava
// (`data_fatal`) é o que a agenda do painel lê. A interface abaixo é a fronteira;
// há uma implementação em memória (demo/teste) e uma sobre Supabase (produção).
// ════════════════════════════════════════════════════════════════════════

import { z } from "zod";
import { PRAZO_ALERTA_DIAS } from "./config";

export interface PrazoNovo {
  empresaId: string;
  sigla: string;
  descricao: string;
  dataFatal: string; // ISO YYYY-MM-DD (vindo de src/prazos.ts, já antecipado)
}

/** Entrada de prazo MANUAL pelo painel (a agenda também recebe do Agente 1). */
export const prazoManualSchema = z.object({
  empresaId: z.string().min(1),
  sigla: z.string().min(1),
  descricao: z.string().min(1),
  dataFatal: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "data no formato YYYY-MM-DD"),
});

export interface PrazoRow extends PrazoNovo {
  id: string;
  status: "pendente" | "cumprido";
}

export interface AgendaRepo {
  inserirPrazos(prazos: PrazoNovo[]): Promise<PrazoRow[]>;
  listarPrazos(empresaId: string): Promise<PrazoRow[]>;
  /** Todos os prazos do escritório (alimenta o painel-início e o aviso de login). */
  listarTodos(): Promise<PrazoRow[]>;
  atualizarStatus(id: string, status: "pendente" | "cumprido"): Promise<void>;
}

/** Implementação em memória — usada pela demo e pelos testes de integração. */
export class AgendaMemoria implements AgendaRepo {
  private rows: PrazoRow[] = [];
  private seq = 0;

  async inserirPrazos(prazos: PrazoNovo[]): Promise<PrazoRow[]> {
    const novos = prazos.map((p) => ({ ...p, id: `p${++this.seq}`, status: "pendente" as const }));
    this.rows.push(...novos);
    return novos;
  }

  async listarPrazos(empresaId: string): Promise<PrazoRow[]> {
    return this.rows
      .filter((r) => r.empresaId === empresaId)
      .sort((a, b) => a.dataFatal.localeCompare(b.dataFatal));
  }

  async listarTodos(): Promise<PrazoRow[]> {
    return [...this.rows].sort((a, b) => a.dataFatal.localeCompare(b.dataFatal));
  }

  async atualizarStatus(id: string, status: "pendente" | "cumprido"): Promise<void> {
    const row = this.rows.find((r) => r.id === id);
    if (row) row.status = status;
  }
}

/**
 * Classifica um prazo para o destaque visual do painel (spec §6.3):
 * 'vencido' (< hoje), 'alerta' (≤ PRAZO_ALERTA_DIAS), 'ok'. `hoje` é injetável
 * (data civil ISO) para teste determinístico.
 */
export function statusVisualPrazo(dataFatalISO: string, hojeISO: string): "vencido" | "alerta" | "ok" {
  const MS = 86_400_000;
  const fatal = Date.parse(`${dataFatalISO}T00:00:00Z`);
  const hoje = Date.parse(`${hojeISO}T00:00:00Z`);
  const dias = Math.round((fatal - hoje) / MS);
  if (dias < 0) return "vencido";
  if (dias <= PRAZO_ALERTA_DIAS) return "alerta";
  return "ok";
}
