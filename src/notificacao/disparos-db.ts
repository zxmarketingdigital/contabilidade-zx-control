// ════════════════════════════════════════════════════════════════════════
// Implementação do DbLike (contrato da engine anti-ban congelada) sobre a
// tabela `disparos` do Supabase. NÃO contém regra anti-ban — a regra vive na
// engine (src/scheduler/scheduler.ts); aqui só persistimos e contamos.
//
// clienteOptOut: na v1.1 o destinatário é o PRÓPRIO escritório (resumo diário).
// O "opt-out" do escritório é desligar a notificação (remover o número/segredo),
// então aqui retornamos false — a engine continua chamando este método, e quando
// houver destinatário-cliente (opt-out "SAIR") esta é a costura a implementar.
// ════════════════════════════════════════════════════════════════════════

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { DbLike } from "../scheduler/types";

export class DisparosSupabase implements DbLike {
  private db: SupabaseClient;
  constructor(url: string, serviceKey: string) {
    this.db = createClient(url, serviceKey, { auth: { persistSession: false } });
  }

  async existeDisparo(_clienteId: string, agente: string, chave: string): Promise<boolean> {
    const { count } = await this.db
      .from("disparos")
      .select("*", { count: "exact", head: true })
      .eq("agente", agente)
      .eq("chave", chave)
      .eq("status", "enviado");
    return (count ?? 0) > 0;
  }

  // Rate-cap GLOBAL da linha emissora: conta TODOS os envios, sem filtrar destino.
  async contarEnviosHora(desde: Date): Promise<number> {
    return this.contarDesde(desde);
  }
  async contarEnviosDia(desde: Date): Promise<number> {
    return this.contarDesde(desde);
  }
  private async contarDesde(desde: Date): Promise<number> {
    const { count } = await this.db
      .from("disparos")
      .select("*", { count: "exact", head: true })
      .eq("status", "enviado")
      .gte("criado_em", desde.toISOString());
    return count ?? 0;
  }

  async clienteOptOut(_clienteId: string): Promise<boolean> {
    return false;
  }

  async registrarDisparo(p: {
    clienteId: string;
    numero: string;
    agente: string;
    chave: string;
    status: "enviado" | "bloqueado";
  }): Promise<void> {
    const { error } = await this.db.from("disparos").insert({
      cliente_id: p.clienteId,
      numero: p.numero,
      agente: p.agente,
      chave: p.chave,
      status: p.status,
    });
    // 23505 = violação do índice único (agente, chave) where enviado → já
    // confirmado hoje. Idempotente: trata como sucesso, não como erro.
    if (error && (error as { code?: string }).code !== "23505") {
      throw new Error(`Falha ao registrar disparo: ${error.message}`);
    }
  }
}
