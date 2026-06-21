// ════════════════════════════════════════════════════════════════════════
// Reconecta a instância da Evolution (gera o QR / pairing code). Lê a config
// local (~/.zx-notif/config.json) — a apikey não passa pela linha de comando.
// Uso: node setup/notificacao/reconectar.mjs
// ════════════════════════════════════════════════════════════════════════

import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const cfgPath = process.env.ZX_NOTIF_CONFIG || join(homedir(), ".zx-notif", "config.json");
const cfg = JSON.parse(readFileSync(cfgPath, "utf8"));
const base = cfg.evolutionUrl.replace(/\/$/, "");
const headers = { apikey: cfg.evolutionApiKey };

const estado = await fetch(`${base}/instance/connectionState/${cfg.evolutionInstance}`, { headers })
  .then((r) => r.json()).catch(() => null);
console.log("estado atual:", JSON.stringify(estado));

const r = await fetch(`${base}/instance/connect/${cfg.evolutionInstance}`, { headers });
if (!r.ok) { console.log(`connect HTTP ${r.status}`); process.exit(1); }
const data = await r.json();

if (data.pairingCode) console.log("PAIRING CODE (digite no WhatsApp):", data.pairingCode);

const b64 = String(data.base64 || data?.qrcode?.base64 || "").replace(/^data:image\/png;base64,/, "");
if (b64) {
  const out = join(homedir(), ".zx-notif", "whatsapp-qr.png");
  writeFileSync(out, Buffer.from(b64, "base64"));
  console.log("QR_PATH:", out);
} else {
  console.log("sem QR no retorno:", JSON.stringify(data).slice(0, 300));
}
