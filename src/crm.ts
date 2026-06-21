// ════════════════════════════════════════════════════════════════════════
// CRM — leads (prospecção) e seu pipeline até virar empresa-cliente. Repo
// (memória p/ teste+demo, Supabase p/ prod). A CONVERSÃO (lead → empresa) é
// orquestrada no roteador (app.ts), que cria a empresa e marca o lead como
// 'convertido' apontando para ela — assim o repo não acopla com EmpresasRepo.
// ════════════════════════════════════════════════════════════════════════

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { LEAD_STATUS } from "./config";

export const leadInputSchema = z.object({
  nome: z.string().min(1, "Nome obrigatório"),
  contato: z.string().optional(),
  origem: z.string().optional(),
  status: z.enum(LEAD_STATUS).optional(),
  empresaId: z.string().optional(),
  proximaAcao: z.string().optional(),
  dataAcao: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  observacao: z.string().optional(),
});
export type LeadInput = z.infer<typeof leadInputSchema>;
export const leadPatchSchema = leadInputSchema.partial();
export type LeadPatch = z.infer<typeof leadPatchSchema>;

export interface LeadRow {
  id: string;
  nome: string;
  contato?: string;
  origem?: string;
  status: (typeof LEAD_STATUS)[number];
  empresaId?: string;
  proximaAcao?: string;
  dataAcao?: string;
  observacao?: string;
  criadoEm: string;
}

export interface LeadsRepo {
  listar(): Promise<LeadRow[]>;
  obter(id: string): Promise<LeadRow | null>;
  criar(input: LeadInput): Promise<LeadRow>;
  atualizar(id: string, patch: LeadPatch): Promise<LeadRow>;
  remover(id: string): Promise<void>;
}

export class LeadsMemoria implements LeadsRepo {
  private rows: LeadRow[] = [];
  private seq = 0;
  constructor(private agora: () => string = () => new Date().toISOString()) {}
  async listar() { return [...this.rows]; }
  async obter(id: string) { return this.rows.find((r) => r.id === id) ?? null; }
  async criar(i: LeadInput) {
    const row: LeadRow = { ...i, status: i.status ?? "novo", id: `lead${++this.seq}`, criadoEm: this.agora() };
    this.rows.push(row);
    return row;
  }
  async atualizar(id: string, patch: LeadPatch) {
    const row = this.rows.find((r) => r.id === id);
    if (!row) throw new Error("Lead não encontrado");
    Object.assign(row, patch);
    return row;
  }
  async remover(id: string) { this.rows = this.rows.filter((r) => r.id !== id); }
}

function mapLead(d: Record<string, unknown>): LeadRow {
  return {
    id: String(d.id),
    nome: String(d.nome),
    contato: (d.contato as string) ?? undefined,
    origem: (d.origem as string) ?? undefined,
    status: d.status as LeadRow["status"],
    empresaId: (d.empresa_id as string) ?? undefined,
    proximaAcao: (d.proxima_acao as string) ?? undefined,
    dataAcao: (d.data_acao as string) ?? undefined,
    observacao: (d.observacao as string) ?? undefined,
    criadoEm: String(d.criado_em),
  };
}

export class LeadsSupabase implements LeadsRepo {
  private db: SupabaseClient;
  constructor(url: string, key: string) {
    this.db = createClient(url, key, { auth: { persistSession: false } });
  }
  async listar() {
    const { data, error } = await this.db.from("leads").select().order("criado_em", { ascending: false });
    if (error) throw new Error(error.message);
    return (data as Array<Record<string, unknown>>).map(mapLead);
  }
  async obter(id: string) {
    const { data, error } = await this.db.from("leads").select().eq("id", id).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapLead(data as Record<string, unknown>) : null;
  }
  async criar(i: LeadInput) {
    const { data, error } = await this.db.from("leads")
      .insert({
        nome: i.nome, contato: i.contato ?? null, origem: i.origem ?? null,
        status: i.status ?? "novo", empresa_id: i.empresaId ?? null,
        proxima_acao: i.proximaAcao ?? null, data_acao: i.dataAcao ?? null, observacao: i.observacao ?? null,
      })
      .select().single();
    if (error) throw new Error(error.message);
    return mapLead(data as Record<string, unknown>);
  }
  async atualizar(id: string, patch: LeadPatch) {
    const upd: Record<string, unknown> = {};
    if (patch.nome !== undefined) upd.nome = patch.nome;
    if (patch.contato !== undefined) upd.contato = patch.contato ?? null;
    if (patch.origem !== undefined) upd.origem = patch.origem ?? null;
    if (patch.status !== undefined) upd.status = patch.status;
    if (patch.empresaId !== undefined) upd.empresa_id = patch.empresaId ?? null;
    if (patch.proximaAcao !== undefined) upd.proxima_acao = patch.proximaAcao ?? null;
    if (patch.dataAcao !== undefined) upd.data_acao = patch.dataAcao ?? null;
    if (patch.observacao !== undefined) upd.observacao = patch.observacao ?? null;
    const { data, error } = await this.db.from("leads").update(upd).eq("id", id).select().single();
    if (error) throw new Error(error.message);
    return mapLead(data as Record<string, unknown>);
  }
  async remover(id: string) {
    const { error } = await this.db.from("leads").delete().eq("id", id);
    if (error) throw new Error(error.message);
  }
}
