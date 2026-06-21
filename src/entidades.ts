// ════════════════════════════════════════════════════════════════════════
// CRUD das entidades do painel (spec §6): empresas_cliente e competencias.
// (prazos e saidas_geradas têm seus próprios repos.) Interface + impl em memória
// (demo/teste) + Supabase (produção). Toda escrita valida com zod no router.
// ════════════════════════════════════════════════════════════════════════

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { REGIMES } from "./config";

// ── Empresas-cliente ──────────────────────────────────────────────────────
export const empresaInputSchema = z.object({
  razaoSocial: z.string().min(1, "Razão social obrigatória"),
  cnpj: z.string().optional(),
  regime: z.enum(REGIMES),
  porte: z.string().optional(),
  observacao: z.string().optional(),
  inativo: z.boolean().optional(),
});
export type EmpresaInput = z.infer<typeof empresaInputSchema>;
/** Atualização parcial (toggle inativo, editar observação, etc.). */
export const empresaPatchSchema = empresaInputSchema.partial();
export type EmpresaPatch = z.infer<typeof empresaPatchSchema>;
export interface EmpresaRow extends EmpresaInput {
  id: string;
  inativo: boolean;
  criadoEm: string;
}

// ── Competências ──────────────────────────────────────────────────────────
export const competenciaInputSchema = z.object({
  empresaId: z.string().min(1),
  ano: z.number().int().min(2000).max(2100),
  mes: z.number().int().min(1).max(12),
  status: z.enum(["aberta", "fechada"]).optional(),
});
export type CompetenciaInput = z.infer<typeof competenciaInputSchema>;
export interface CompetenciaRow {
  id: string;
  empresaId: string;
  ano: number;
  mes: number;
  status: "aberta" | "fechada";
  criadoEm: string;
}

export interface EmpresasRepo {
  listar(): Promise<EmpresaRow[]>;
  criar(input: EmpresaInput): Promise<EmpresaRow>;
  atualizar(id: string, patch: EmpresaPatch): Promise<EmpresaRow>;
  remover(id: string): Promise<void>;
}
export interface CompetenciasRepo {
  listar(empresaId?: string): Promise<CompetenciaRow[]>;
  criar(input: CompetenciaInput): Promise<CompetenciaRow>;
  atualizarStatus(id: string, status: "aberta" | "fechada"): Promise<void>;
}

// ── Implementações em memória ─────────────────────────────────────────────
export class EmpresasMemoria implements EmpresasRepo {
  private rows: EmpresaRow[] = [];
  private seq = 0;
  constructor(private agora: () => string = () => new Date().toISOString()) {}
  async listar(): Promise<EmpresaRow[]> {
    return [...this.rows];
  }
  async criar(input: EmpresaInput): Promise<EmpresaRow> {
    const row: EmpresaRow = { ...input, inativo: input.inativo ?? false, id: `emp${++this.seq}`, criadoEm: this.agora() };
    this.rows.push(row);
    return row;
  }
  async atualizar(id: string, patch: EmpresaPatch): Promise<EmpresaRow> {
    const row = this.rows.find((r) => r.id === id);
    if (!row) throw new Error("Empresa não encontrada");
    Object.assign(row, patch);
    return row;
  }
  async remover(id: string): Promise<void> {
    this.rows = this.rows.filter((r) => r.id !== id);
  }
}

export class CompetenciasMemoria implements CompetenciasRepo {
  private rows: CompetenciaRow[] = [];
  private seq = 0;
  constructor(private agora: () => string = () => new Date().toISOString()) {}
  async listar(empresaId?: string): Promise<CompetenciaRow[]> {
    return this.rows.filter((r) => !empresaId || r.empresaId === empresaId);
  }
  async criar(input: CompetenciaInput): Promise<CompetenciaRow> {
    const row: CompetenciaRow = {
      id: `comp${++this.seq}`,
      empresaId: input.empresaId,
      ano: input.ano,
      mes: input.mes,
      status: input.status ?? "aberta",
      criadoEm: this.agora(),
    };
    this.rows.push(row);
    return row;
  }
  async atualizarStatus(id: string, status: "aberta" | "fechada"): Promise<void> {
    const row = this.rows.find((r) => r.id === id);
    if (row) row.status = status;
  }
}

// ── Implementações Supabase ───────────────────────────────────────────────
function client(url: string, key: string): SupabaseClient {
  return createClient(url, key, { auth: { persistSession: false } });
}

export class EmpresasSupabase implements EmpresasRepo {
  private db: SupabaseClient;
  constructor(url: string, key: string) {
    this.db = client(url, key);
  }
  async listar(): Promise<EmpresaRow[]> {
    const { data, error } = await this.db.from("empresas_cliente").select().order("razao_social");
    if (error) throw new Error(error.message);
    return (data as Array<Record<string, unknown>>).map(mapEmpresa);
  }
  async criar(input: EmpresaInput): Promise<EmpresaRow> {
    const { data, error } = await this.db
      .from("empresas_cliente")
      .insert({
        razao_social: input.razaoSocial,
        cnpj: input.cnpj ?? null,
        regime: input.regime,
        porte: input.porte ?? null,
        observacao: input.observacao ?? null,
        inativo: input.inativo ?? false,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return mapEmpresa(data as Record<string, unknown>);
  }
  async atualizar(id: string, patch: EmpresaPatch): Promise<EmpresaRow> {
    const upd: Record<string, unknown> = {};
    if (patch.razaoSocial !== undefined) upd.razao_social = patch.razaoSocial;
    if (patch.cnpj !== undefined) upd.cnpj = patch.cnpj ?? null;
    if (patch.regime !== undefined) upd.regime = patch.regime;
    if (patch.porte !== undefined) upd.porte = patch.porte ?? null;
    if (patch.observacao !== undefined) upd.observacao = patch.observacao ?? null;
    if (patch.inativo !== undefined) upd.inativo = patch.inativo;
    const { data, error } = await this.db.from("empresas_cliente").update(upd).eq("id", id).select().single();
    if (error) throw new Error(error.message);
    return mapEmpresa(data as Record<string, unknown>);
  }
  async remover(id: string): Promise<void> {
    const { error } = await this.db.from("empresas_cliente").delete().eq("id", id);
    if (error) throw new Error(error.message);
  }
}

export class CompetenciasSupabase implements CompetenciasRepo {
  private db: SupabaseClient;
  constructor(url: string, key: string) {
    this.db = client(url, key);
  }
  async listar(empresaId?: string): Promise<CompetenciaRow[]> {
    let q = this.db.from("competencias").select().order("ano", { ascending: false }).order("mes", { ascending: false });
    if (empresaId) q = q.eq("empresa_id", empresaId);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return (data as Array<Record<string, unknown>>).map(mapCompetencia);
  }
  async criar(input: CompetenciaInput): Promise<CompetenciaRow> {
    const { data, error } = await this.db
      .from("competencias")
      .insert({ empresa_id: input.empresaId, ano: input.ano, mes: input.mes, status: input.status ?? "aberta" })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return mapCompetencia(data as Record<string, unknown>);
  }
  async atualizarStatus(id: string, status: "aberta" | "fechada"): Promise<void> {
    const { error } = await this.db.from("competencias").update({ status }).eq("id", id);
    if (error) throw new Error(error.message);
  }
}

function mapEmpresa(d: Record<string, unknown>): EmpresaRow {
  return {
    id: String(d.id),
    razaoSocial: String(d.razao_social),
    cnpj: (d.cnpj as string) ?? undefined,
    regime: d.regime as EmpresaInput["regime"],
    porte: (d.porte as string) ?? undefined,
    observacao: (d.observacao as string) ?? undefined,
    inativo: Boolean(d.inativo),
    criadoEm: String(d.criado_em),
  };
}
function mapCompetencia(d: Record<string, unknown>): CompetenciaRow {
  return {
    id: String(d.id),
    empresaId: String(d.empresa_id),
    ano: Number(d.ano),
    mes: Number(d.mes),
    status: d.status as "aberta" | "fechada",
    criadoEm: String(d.criado_em),
  };
}
