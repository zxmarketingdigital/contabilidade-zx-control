-- ════════════════════════════════════════════════════════════════════════
-- Schema do Contabilidade ZX Control (spec §6) — 4 entidades, RLS OBRIGATÓRIO.
--
-- Modelo de tenancy (spec §4): 1 instalação = 1 escritório; os usuários do mesmo
-- escritório COMPARTILHAM os dados. Sem multi-tenancy entre escritórios na v1.
-- Por isso a policy de RLS libera o papel `authenticated` (cada pessoa do
-- escritório tem login Supabase Auth próprio) e bloqueia acesso anônimo.
-- O Worker usa a SERVICE_KEY no servidor; o RLS protege o acesso direto do client.
--
-- NÃO há tabela "documentos" — o produto não recebe upload (spec §2).
-- Migration IDEMPOTENTE: roda 2x sem erro (CREATE ... IF NOT EXISTS + DROP POLICY
-- IF EXISTS antes de cada CREATE POLICY).
-- Valores de regime espelham REGIMES de src/config.ts (fonte única do enum).
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. Empresas-cliente (carteira do escritório) ──────────────────────────
create table if not exists empresas_cliente (
  id            uuid primary key default gen_random_uuid(),
  razao_social  text not null,
  cnpj          text,
  regime        text not null check (regime in ('mei', 'simples', 'presumido', 'real')),
  porte         text,
  criado_em     timestamptz not null default now()
);

-- ── 2. Competências (mês/ano de referência por empresa) ───────────────────
create table if not exists competencias (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references empresas_cliente (id) on delete cascade,
  ano         int  not null check (ano between 2000 and 2100),
  mes         int  not null check (mes between 1 and 12),
  status      text not null default 'aberta' check (status in ('aberta', 'fechada')),
  criado_em   timestamptz not null default now(),
  unique (empresa_id, ano, mes)
);

-- ── 3. Prazos (agenda de obrigações — destaque ≤5 dias e vencidos no painel) ─
create table if not exists prazos (
  id           uuid primary key default gen_random_uuid(),
  empresa_id   uuid not null references empresas_cliente (id) on delete cascade,
  competencia_id uuid references competencias (id) on delete set null,
  sigla        text not null,            -- ex.: DAS, DCTFWeb (catálogo de config.ts)
  descricao    text not null,
  data_fatal   date not null,            -- já antecipada para dia útil (src/prazos.ts)
  status       text not null default 'pendente' check (status in ('pendente', 'cumprido')),
  criado_em    timestamptz not null default now()
);
create index if not exists prazos_empresa_idx on prazos (empresa_id);
create index if not exists prazos_data_fatal_idx on prazos (data_fatal);

-- ── 4. Saídas geradas (histórico dos outputs dos 5 agentes) ───────────────
create table if not exists saidas_geradas (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid references empresas_cliente (id) on delete set null,
  agente      text not null,             -- calendario | enquadramento | comunicado | consultor | fisco
  titulo      text not null,
  conteudo    text not null,             -- inclui o disclaimer obrigatório embutido
  criado_em   timestamptz not null default now()
);
create index if not exists saidas_empresa_idx on saidas_geradas (empresa_id);

-- ════════════════════════════════════════════════════════════════════════
-- RLS — habilitado em TODA tabela (invariante da linha; CI smoke-db valida).
-- enable row level security é idempotente. As policies são recriadas com
-- drop ... if exists para a migration rodar 2x.
-- ════════════════════════════════════════════════════════════════════════
alter table empresas_cliente enable row level security;
alter table competencias     enable row level security;
alter table prazos           enable row level security;
alter table saidas_geradas   enable row level security;

-- O papel `authenticated` existe no Supabase (gerenciado). Em Postgres vanilla
-- (CI smoke-db) ele não existe — cria de forma idempotente para a policy poder
-- referenciá-lo. No Supabase o IF NOT EXISTS pula (papel já presente).
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
end $$;

do $$
declare t text;
begin
  foreach t in array array['empresas_cliente', 'competencias', 'prazos', 'saidas_geradas']
  loop
    execute format('drop policy if exists %I on %I', t || '_rw', t);
    -- Escritório único: qualquer usuário autenticado lê/escreve; anônimo é negado.
    execute format(
      'create policy %I on %I for all to authenticated using (true) with check (true)',
      t || '_rw', t
    );
  end loop;
end $$;
