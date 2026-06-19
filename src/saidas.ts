// ════════════════════════════════════════════════════════════════════════
// Histórico de saídas dos agentes (tabela `saidas_geradas`, spec §6.4).
// Contrato grava-vs-lê: o `conteudo` gravado (com disclaimer embutido) é o mesmo
// que o painel lê. Interface + impl em memória (demo/teste) + Supabase (produção).
// ════════════════════════════════════════════════════════════════════════

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type AgenteTipo = "calendario" | "enquadramento" | "comunicado" | "consultor" | "fisco";

export interface SaidaNova {
  empresaId?: string;
  agente: AgenteTipo;
  titulo: string;
  conteudo: string; // inclui o disclaimer
}

export interface SaidaRow extends SaidaNova {
  id: string;
  criadoEm: string;
}

export interface SaidasRepo {
  registrar(s: SaidaNova): Promise<SaidaRow>;
  listar(empresaId?: string): Promise<SaidaRow[]>;
}

export class SaidasMemoria implements SaidasRepo {
  private rows: SaidaRow[] = [];
  private seq = 0;
  constructor(private agora: () => string = () => new Date().toISOString()) {}

  async registrar(s: SaidaNova): Promise<SaidaRow> {
    const row: SaidaRow = { ...s, id: `s${++this.seq}`, criadoEm: this.agora() };
    this.rows.push(row);
    return row;
  }
  async listar(empresaId?: string): Promise<SaidaRow[]> {
    const rows = empresaId ? this.rows.filter((r) => r.empresaId === empresaId) : this.rows;
    return [...rows].reverse(); // mais recentes primeiro
  }
}

interface SaidaDb {
  id: string;
  empresa_id: string | null;
  agente: AgenteTipo;
  titulo: string;
  conteudo: string;
  criado_em: string;
}
function toRow(d: SaidaDb): SaidaRow {
  return {
    id: d.id,
    empresaId: d.empresa_id ?? undefined,
    agente: d.agente,
    titulo: d.titulo,
    conteudo: d.conteudo,
    criadoEm: d.criado_em,
  };
}

export class SaidasSupabase implements SaidasRepo {
  private db: SupabaseClient;
  constructor(url: string, serviceKey: string) {
    this.db = createClient(url, serviceKey, { auth: { persistSession: false } });
  }
  async registrar(s: SaidaNova): Promise<SaidaRow> {
    const { data, error } = await this.db
      .from("saidas_geradas")
      .insert({ empresa_id: s.empresaId ?? null, agente: s.agente, titulo: s.titulo, conteudo: s.conteudo })
      .select()
      .single();
    if (error) throw new Error(`Falha ao gravar saída: ${error.message}`);
    return toRow(data as SaidaDb);
  }
  async listar(empresaId?: string): Promise<SaidaRow[]> {
    let q = this.db.from("saidas_geradas").select().order("criado_em", { ascending: false });
    if (empresaId) q = q.eq("empresa_id", empresaId);
    const { data, error } = await q;
    if (error) throw new Error(`Falha ao ler saídas: ${error.message}`);
    return (data as SaidaDb[]).map(toRow);
  }
}
