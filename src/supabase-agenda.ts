// AgendaRepo de produção sobre Supabase (tabela `prazos`). Mapeia camelCase ↔
// snake_case das colunas. Grava `data_fatal` (o MESMO campo que o painel lê).
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AgendaRepo, PrazoNovo, PrazoRow } from "./agenda";

interface PrazoDb {
  id: string;
  empresa_id: string;
  sigla: string;
  descricao: string;
  data_fatal: string;
  status: "pendente" | "cumprido";
}

function toRow(d: PrazoDb): PrazoRow {
  return {
    id: d.id,
    empresaId: d.empresa_id,
    sigla: d.sigla,
    descricao: d.descricao,
    dataFatal: d.data_fatal,
    status: d.status,
  };
}

export class AgendaSupabase implements AgendaRepo {
  private db: SupabaseClient;
  constructor(url: string, serviceKey: string) {
    this.db = createClient(url, serviceKey, { auth: { persistSession: false } });
  }

  async inserirPrazos(prazos: PrazoNovo[]): Promise<PrazoRow[]> {
    if (!prazos.length) return [];
    const payload = prazos.map((p) => ({
      empresa_id: p.empresaId,
      sigla: p.sigla,
      descricao: p.descricao,
      data_fatal: p.dataFatal,
    }));
    const { data, error } = await this.db.from("prazos").insert(payload).select();
    if (error) throw new Error(`Falha ao gravar prazos: ${error.message}`);
    return (data as PrazoDb[]).map(toRow);
  }

  async listarPrazos(empresaId: string): Promise<PrazoRow[]> {
    const { data, error } = await this.db
      .from("prazos")
      .select()
      .eq("empresa_id", empresaId)
      .order("data_fatal", { ascending: true });
    if (error) throw new Error(`Falha ao ler prazos: ${error.message}`);
    return (data as PrazoDb[]).map(toRow);
  }
}
