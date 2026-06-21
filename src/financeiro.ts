// ════════════════════════════════════════════════════════════════════════
// Financeiro do escritório — receitas (base do MRR) e custos (fixo/único/
// anúncios). Repos (memória p/ teste+demo, Supabase p/ prod) + cálculo PURO das
// métricas (MRR, custo mensal, lucro, CAC). Métricas portadas do Jurídico
// Otimizado 2 (src/growth.ts), com lucro mensal acrescentado.
// ════════════════════════════════════════════════════════════════════════

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { RECEITA_TIPO, CUSTO_TIPO } from "./config";

// ── Schemas de entrada ────────────────────────────────────────────────────
export const receitaInputSchema = z.object({
  empresaId: z.string().min(1).optional(),
  descricao: z.string().optional(),
  valor: z.coerce.number().nonnegative(),
  tipo: z.enum(RECEITA_TIPO),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
export type ReceitaInput = z.infer<typeof receitaInputSchema>;

export const custoInputSchema = z.object({
  descricao: z.string().min(1, "Descrição obrigatória"),
  valor: z.coerce.number().nonnegative(),
  tipo: z.enum(CUSTO_TIPO),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
export type CustoInput = z.infer<typeof custoInputSchema>;

export interface ReceitaRow {
  id: string;
  empresaId?: string;
  descricao?: string;
  valor: number;
  tipo: (typeof RECEITA_TIPO)[number];
  data?: string;
  criadoEm: string;
}
export interface CustoRow {
  id: string;
  descricao: string;
  valor: number;
  tipo: (typeof CUSTO_TIPO)[number];
  data?: string;
  criadoEm: string;
}

export interface ReceitasRepo {
  listar(): Promise<ReceitaRow[]>;
  criar(input: ReceitaInput): Promise<ReceitaRow>;
  remover(id: string): Promise<void>;
}
export interface CustosRepo {
  listar(): Promise<CustoRow[]>;
  criar(input: CustoInput): Promise<CustoRow>;
  remover(id: string): Promise<void>;
}

// ── Cálculo PURO das métricas ─────────────────────────────────────────────
const round2 = (n: number) => Math.round(n * 100) / 100;
const soma = <T extends { valor: number; tipo: string }>(arr: T[], tipo: string) =>
  round2(arr.filter((x) => x.tipo === tipo).reduce((s, x) => s + Number(x.valor || 0), 0));

export interface Financeiro {
  mrr: number;                  // receita recorrente
  receitaUnica: number;
  custoFixoMensal: number;
  custoUnico: number;
  investimentoAnuncios: number;
  custoMensalTotal: number;     // fixo + anúncios
  lucroMensal: number;          // MRR − custo mensal total
  cac: number | null;           // anúncios ÷ leads convertidos
  leadsConvertidos: number;
}

export function calcularFinanceiro(args: {
  receitas: Array<{ valor: number; tipo: string }>;
  custos: Array<{ valor: number; tipo: string }>;
  leadsConvertidos: number;
}): Financeiro {
  const { receitas, custos, leadsConvertidos } = args;
  const mrr = soma(receitas, "recorrente");
  const receitaUnica = soma(receitas, "unica");
  const custoFixoMensal = soma(custos, "fixo_mensal");
  const custoUnico = soma(custos, "unico");
  const investimentoAnuncios = soma(custos, "anuncios");
  const custoMensalTotal = round2(custoFixoMensal + investimentoAnuncios);
  return {
    mrr,
    receitaUnica,
    custoFixoMensal,
    custoUnico,
    investimentoAnuncios,
    custoMensalTotal,
    lucroMensal: round2(mrr - custoMensalTotal),
    cac: leadsConvertidos > 0 ? round2(investimentoAnuncios / leadsConvertidos) : null,
    leadsConvertidos,
  };
}

// ── Implementações em memória (demo/teste) ────────────────────────────────
export class ReceitasMemoria implements ReceitasRepo {
  private rows: ReceitaRow[] = [];
  private seq = 0;
  constructor(private agora: () => string = () => new Date().toISOString()) {}
  async listar() { return [...this.rows]; }
  async criar(i: ReceitaInput) {
    const row: ReceitaRow = { ...i, valor: Number(i.valor), id: `rec${++this.seq}`, criadoEm: this.agora() };
    this.rows.push(row);
    return row;
  }
  async remover(id: string) { this.rows = this.rows.filter((r) => r.id !== id); }
}
export class CustosMemoria implements CustosRepo {
  private rows: CustoRow[] = [];
  private seq = 0;
  constructor(private agora: () => string = () => new Date().toISOString()) {}
  async listar() { return [...this.rows]; }
  async criar(i: CustoInput) {
    const row: CustoRow = { ...i, valor: Number(i.valor), id: `cus${++this.seq}`, criadoEm: this.agora() };
    this.rows.push(row);
    return row;
  }
  async remover(id: string) { this.rows = this.rows.filter((r) => r.id !== id); }
}

// ── Implementações Supabase (produção) ────────────────────────────────────
function client(url: string, key: string): SupabaseClient {
  return createClient(url, key, { auth: { persistSession: false } });
}
function mapReceita(d: Record<string, unknown>): ReceitaRow {
  return {
    id: String(d.id),
    empresaId: (d.empresa_id as string) ?? undefined,
    descricao: (d.descricao as string) ?? undefined,
    valor: Number(d.valor),
    tipo: d.tipo as ReceitaRow["tipo"],
    data: (d.data as string) ?? undefined,
    criadoEm: String(d.criado_em),
  };
}
function mapCusto(d: Record<string, unknown>): CustoRow {
  return {
    id: String(d.id),
    descricao: String(d.descricao ?? ""),
    valor: Number(d.valor),
    tipo: d.tipo as CustoRow["tipo"],
    data: (d.data as string) ?? undefined,
    criadoEm: String(d.criado_em),
  };
}

export class ReceitasSupabase implements ReceitasRepo {
  private db: SupabaseClient;
  constructor(url: string, key: string) { this.db = client(url, key); }
  async listar() {
    const { data, error } = await this.db.from("receitas").select().order("criado_em", { ascending: false });
    if (error) throw new Error(error.message);
    return (data as Array<Record<string, unknown>>).map(mapReceita);
  }
  async criar(i: ReceitaInput) {
    const { data, error } = await this.db.from("receitas")
      .insert({ empresa_id: i.empresaId ?? null, descricao: i.descricao ?? null, valor: i.valor, tipo: i.tipo, data: i.data ?? null })
      .select().single();
    if (error) throw new Error(error.message);
    return mapReceita(data as Record<string, unknown>);
  }
  async remover(id: string) {
    const { error } = await this.db.from("receitas").delete().eq("id", id);
    if (error) throw new Error(error.message);
  }
}
export class CustosSupabase implements CustosRepo {
  private db: SupabaseClient;
  constructor(url: string, key: string) { this.db = client(url, key); }
  async listar() {
    const { data, error } = await this.db.from("custos").select().order("criado_em", { ascending: false });
    if (error) throw new Error(error.message);
    return (data as Array<Record<string, unknown>>).map(mapCusto);
  }
  async criar(i: CustoInput) {
    const { data, error } = await this.db.from("custos")
      .insert({ descricao: i.descricao, valor: i.valor, tipo: i.tipo, data: i.data ?? null })
      .select().single();
    if (error) throw new Error(error.message);
    return mapCusto(data as Record<string, unknown>);
  }
  async remover(id: string) {
    const { error } = await this.db.from("custos").delete().eq("id", id);
    if (error) throw new Error(error.message);
  }
}
