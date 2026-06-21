-- ════════════════════════════════════════════════════════════════════════
-- Melhorias de carteira: cliente inativo (oculta sem perder histórico) e campo
-- de observação livre por empresa. Idempotente (add column if not exists).
-- RLS já habilitado em 0001 — alterar coluna não mexe na policy.
-- ════════════════════════════════════════════════════════════════════════

alter table empresas_cliente add column if not exists inativo    boolean not null default false;
alter table empresas_cliente add column if not exists observacao  text;
