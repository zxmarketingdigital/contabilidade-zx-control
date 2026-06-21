// ════════════════════════════════════════════════════════════════════════
// Envio de TESTE da notificação — manda uma mensagem de amostra pela Evolution
// local pra confirmar a entrega ponta a ponta (instância conectada + apikey +
// número). NÃO toca na dedup nem nos dados de produção. Lê ~/.zx-notif/config.json.
// Uso: node setup/notificacao/teste-envio.mjs
// ════════════════════════════════════════════════════════════════════════

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const cfg = JSON.parse(readFileSync(process.env.ZX_NOTIF_CONFIG || join(homedir(), ".zx-notif", "config.json"), "utf8"));
const texto =
  "📊 *Contabilidade ZX Control*\n" +
  "Teste de conexão ✅\n\n" +
  "Se você recebeu esta mensagem, a notificação diária de prazos está funcionando. " +
  "Todo dia útil às 8h você receberá aqui o resumo dos prazos vencidos e a vencer.";

const r = await fetch(`${cfg.evolutionUrl.replace(/\/$/, "")}/message/sendText/${cfg.evolutionInstance}`, {
  method: "POST",
  headers: { "Content-Type": "application/json", apikey: cfg.evolutionApiKey },
  body: JSON.stringify({ number: cfg.numero, text: texto }),
});
console.log(r.ok ? `enviado ✅ (HTTP ${r.status}) para ${cfg.numero}` : `falhou: HTTP ${r.status}`);
if (!r.ok) { console.log((await r.text()).slice(0, 300)); process.exit(1); }
