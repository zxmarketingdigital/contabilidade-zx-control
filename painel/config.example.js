// ════════════════════════════════════════════════════════════════════════
// TEMPLATE de configuração do painel. NA INSTALAÇÃO: copie este arquivo para
// painel/config.js e preencha com os dados do escritório.
//
//   cp painel/config.example.js painel/config.js   # depois preencha os campos
//
// painel/config.js é gitignored — NUNCA comite credencial. A anon key É PÚBLICA
// por design (o RLS do Supabase protege os dados); pode ir no painel.
// O painel (painel/app.js) lê estes 5 campos de window.ZX.
// ════════════════════════════════════════════════════════════════════════

window.ZX = {
  // "prod" usa Supabase Auth (login real). "demo" é só pra mock local — não use em produção.
  mode: "prod",

  // URL do Worker publicado (wrangler deploy) + "/api".
  // Ex.: https://contabilidade-zx-control.SEU-SUBDOMINIO.workers.dev/api
  apiBase: "https://SEU-WORKER.workers.dev/api",

  // Supabase do escritório — Project Settings ▸ API.
  supabaseUrl: "https://SEU-PROJETO.supabase.co",
  supabaseAnonKey: "SUA_ANON_KEY_PUBLICA",

  // Dias para destacar um prazo como "próximo" na agenda. Espelha PRAZO_ALERTA_DIAS
  // do núcleo ("um valor, um lugar") — mantenha igual ao do Worker.
  prazoAlertaDias: 5,
};
