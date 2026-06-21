-- ════════════════════════════════════════════════════════════════════════
-- Log de disparos da notificação de prazo (v1.1). É o "DbLike" que a engine
-- anti-ban congelada (src/scheduler) usa para: dedup/idempotência (chave),
-- rate-cap GLOBAL da linha emissora (contagem por hora/dia) e auditoria.
--
-- RLS HABILITADO e SEM policy de propósito: nenhum usuário do painel lê/escreve
-- aqui — só o Worker (service key, que ignora RLS). É a tabela mais sensível
-- (números + cadência de envio); fica fechada. Idempotente.
-- ════════════════════════════════════════════════════════════════════════

create table if not exists disparos (
  id          uuid primary key default gen_random_uuid(),
  cliente_id  text not null,             -- linha lógica de origem ("escritorio" na v1.1)
  numero      text not null,             -- destino (WhatsApp)
  agente      text not null,             -- ex.: prazo-diario
  chave       text not null,             -- dedup (gerada pela engine)
  status      text not null check (status in ('enviado', 'bloqueado')),
  criado_em   timestamptz not null default now()
);

-- Rate-cap global lê por janela de tempo (status enviado).
create index if not exists disparos_criado_idx on disparos (criado_em);
-- Idempotência: 1 envio por (agente, chave). Bloqueados não contam para a unicidade.
create unique index if not exists disparos_chave_uq on disparos (agente, chave) where status = 'enviado';

alter table disparos enable row level security;
