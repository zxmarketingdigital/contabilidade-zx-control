// ════════════════════════════════════════════════════════════════════════
// Smoke test pós-instalação do Contabilidade ZX Control.
// NÃO é um instalador — é a checagem final do passo 9 da instalação guiada.
//
// Uso:
//   WORKER_URL=https://contabilidade-zx-control.SEU.workers.dev node setup/smoke.mjs
//
// Verifica o invariante de segurança que mais quebra na linha: a auth do Worker
// é FAIL-CLOSED. Sem credencial real — só prova que rotas /api negam acesso sem
// token válido (401), inclusive com "Bearer " vazio.
// ════════════════════════════════════════════════════════════════════════

const WORKER_URL = (process.env.WORKER_URL ?? "").replace(/\/$/, "");

if (!WORKER_URL) {
  console.error("❌ Defina WORKER_URL (ex.: WORKER_URL=https://...workers.dev node setup/smoke.mjs)");
  process.exit(2);
}

const casos = [
  { nome: "GET /api/prazos sem header Authorization → 401", req: { path: "/api/prazos?empresaId=x" } },
  { nome: "GET /api/prazos com 'Bearer ' vazio → 401", req: { path: "/api/prazos?empresaId=x", auth: "Bearer " } },
  { nome: "GET /api/saidas com token inválido → 401", req: { path: "/api/saidas", auth: "Bearer token-invalido" } },
  { nome: "POST /api/agentes/consultor sem token → 401", req: { path: "/api/agentes/consultor", method: "POST", body: { pergunta: "x" } } },
];

let falhas = 0;

for (const { nome, req } of casos) {
  const headers = { "Content-Type": "application/json" };
  if (req.auth !== undefined) headers.Authorization = req.auth;
  try {
    const res = await fetch(`${WORKER_URL}${req.path}`, {
      method: req.method ?? "GET",
      headers,
      body: req.body ? JSON.stringify(req.body) : undefined,
    });
    const ok = res.status === 401;
    console.log(`${ok ? "✅" : "❌"} ${nome} (recebeu ${res.status})`);
    if (!ok) falhas++;
  } catch (err) {
    console.log(`❌ ${nome} — erro de rede: ${String(err)}`);
    falhas++;
  }
}

if (falhas === 0) {
  console.log("\n✅ Auth fail-closed confirmada. Instalação saudável.");
  process.exit(0);
}
console.error(`\n❌ ${falhas} checagem(ns) falharam — a auth NÃO está fail-closed. Não libere o acesso.`);
process.exit(1);
