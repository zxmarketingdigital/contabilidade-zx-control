// ════════════════════════════════════════════════════════════════════════
// Poller local da notificação de prazo (modelo pull). Roda na máquina do
// escritório (agendador do Windows, de hora em hora). Pergunta ao Worker se há
// resumo pra hoje; se houver, envia pela Evolution LOCAL. A nuvem nunca alcança
// esta máquina e a chave do WhatsApp nunca sai daqui.
//
// A decisão (janela BRT, dedup 1x/dia, rate-cap) é do Worker — aqui é só o
// transporte. Config local (fora do repo): ~/.zx-notif/config.json
//   { workerUrl, pullToken, evolutionUrl, evolutionInstance, evolutionApiKey, numero }
//
// Uso: node poller.mjs        (lê ZX_NOTIF_CONFIG ou o caminho padrão)
// ════════════════════════════════════════════════════════════════════════

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const CFG_PATH = process.env.ZX_NOTIF_CONFIG || join(homedir(), ".zx-notif", "config.json");
const log = (m) => console.log(`[${new Date().toISOString()}] ${m}`);

function carregarConfig() {
  let cfg;
  try {
    cfg = JSON.parse(readFileSync(CFG_PATH, "utf8"));
  } catch {
    log(`config não encontrada em ${CFG_PATH}`);
    process.exit(1);
  }
  for (const campo of ["workerUrl", "pullToken", "evolutionUrl", "evolutionInstance", "evolutionApiKey", "numero"]) {
    if (!cfg[campo]) { log(`config sem o campo "${campo}"`); process.exit(1); }
  }
  return cfg;
}

async function evolutionPronta(cfg) {
  // Só consulta o Worker se a Evolution local estiver REALMENTE pronta pra enviar
  // (chave válida + instância conectada). Isso evita "consumir" o resumo do dia
  // quando a chave está errada (401) ou o WhatsApp caiu — aí o envio falharia e o
  // dedup do Worker bloquearia as próximas tentativas do dia.
  try {
    const r = await fetch(cfg.evolutionUrl.replace(/\/$/, "") + "/instance/fetchInstances", {
      headers: { apikey: cfg.evolutionApiKey },
      signal: AbortSignal.timeout(8000),
    });
    if (r.status === 401) { log("Evolution recusou a apikey (401) — confira evolutionApiKey."); return false; }
    if (!r.ok) { log(`Evolution respondeu HTTP ${r.status} no health-check.`); return false; }
    const data = await r.json().catch(() => null);
    if (!Array.isArray(data)) return true; // formato inesperado: segue (o envio revelará)
    const inst = data.find((d) => (d?.name ?? d?.instance?.instanceName) === cfg.evolutionInstance);
    const estado = inst?.connectionStatus ?? inst?.instance?.status;
    if (inst && estado && estado !== "open") { log(`instância "${cfg.evolutionInstance}" não conectada (${estado}).`); return false; }
    return true;
  } catch {
    log("Evolution local não respondeu.");
    return false;
  }
}

async function main() {
  const cfg = carregarConfig();
  const base = cfg.workerUrl.replace(/\/$/, "");
  const headers = { Authorization: `Bearer ${cfg.pullToken}` };

  if (!(await evolutionPronta(cfg))) return; // não consome o dia se não dá pra enviar

  // 1) DECIDE — o Worker aplica janela + dedup + rate-cap, sem persistir nada.
  const r = await fetch(`${base}/notificacao/pendente`, { headers, signal: AbortSignal.timeout(15000) });
  if (!r.ok) { log(`Worker respondeu HTTP ${r.status} na decisão`); process.exit(1); }
  const data = await r.json();
  if (!data.enviar) { log(`nada a enviar agora (${data.motivo ?? "-"}).`); return; }

  // 2) ENVIA pela Evolution local.
  const send = await fetch(`${cfg.evolutionUrl.replace(/\/$/, "")}/message/sendText/${cfg.evolutionInstance}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: cfg.evolutionApiKey },
    body: JSON.stringify({ number: cfg.numero, text: data.texto }),
    signal: AbortSignal.timeout(20000),
  });
  // Falhou o envio → NÃO confirma. O dia não é consumido; o próximo ciclo re-tenta.
  if (!send.ok) { log(`Evolution respondeu HTTP ${send.status} ao enviar — sem confirmar, re-tenta depois`); process.exit(1); }

  // 3) CONFIRMA — só agora o disparo é registrado (dedup bloqueia o resto do dia).
  let confirmado = false;
  for (let i = 0; i < 3 && !confirmado; i++) {
    try {
      const c = await fetch(`${base}/notificacao/confirmado`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ chave: data.chave }),
        signal: AbortSignal.timeout(15000),
      });
      confirmado = c.ok;
    } catch { /* tenta de novo */ }
  }
  if (!confirmado) log("AVISO: enviado, mas a confirmação falhou — pode reenviar no próximo ciclo.");
  log("resumo do dia enviado pelo WhatsApp ✅");
}

main().catch((e) => { log(`erro: ${e?.message ?? e}`); process.exit(1); });
