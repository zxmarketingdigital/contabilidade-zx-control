-- ════════════════════════════════════════════════════════════════════════
-- 0004 — Contabilidade ZX Control: CRM (leads) + Financeiro (receitas/custos).
-- Modelado no Jurídico Otimizado 2 (módulo growth/CRM), adaptado: lead converte
-- em empresas_cliente; receita vincula a empresa; custo "anuncios" alimenta o CAC.
-- Aditiva. Idempotente (roda 2×). RLS habilitado em TODA tabela nova, política da
-- linha (qualquer usuário autenticado do escritório lê/escreve; anônimo negado).
-- ════════════════════════════════════════════════════════════════════════

-- ── CRM: leads (prospecção até virar empresa-cliente) ─────────────────────
create table if not exists leads (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null,
  contato       text,
  origem        text,
  status        text not null default 'novo' check (status in (
                  'desqualificado', 'novo', 'contatado', 'reuniao_agendada', 'convertido')),
  empresa_id    uuid references empresas_cliente (id) on delete set null,
  proxima_acao  text,           -- próximo passo (ação) do lead
  data_acao     date,           -- quando fazer a próxima ação
  observacao    text,
  criado_em     timestamptz not null default now()
);
create index if not exists leads_status_idx on leads (status);
create index if not exists leads_data_acao_idx on leads (data_acao);

-- ── Financeiro: receitas (base do MRR) ────────────────────────────────────
create table if not exists receitas (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid references empresas_cliente (id) on delete set null,
  descricao   text,
  valor       numeric(12,2) not null,
  tipo        text not null check (tipo in ('recorrente', 'unica')),
  data        date,
  criado_em   timestamptz not null default now()
);
create index if not exists receitas_tipo_idx on receitas (tipo);

-- ── Financeiro: custos (fixo mensal / único / anúncios → CAC) ──────────────
create table if not exists custos (
  id          uuid primary key default gen_random_uuid(),
  descricao   text not null,
  valor       numeric(12,2) not null,
  tipo        text not null check (tipo in ('fixo_mensal', 'unico', 'anuncios')),
  data        date,
  criado_em   timestamptz not null default now()
);
create index if not exists custos_tipo_idx on custos (tipo);

-- ── RLS em toda tabela nova (invariante da linha) ─────────────────────────
alter table leads    enable row level security;
alter table receitas enable row level security;
alter table custos   enable row level security;

-- Papel `authenticated` existe no Supabase; em Postgres vanilla (CI smoke-db) não.
-- Cria idempotente para esta migração ser auto-suficiente (não depender da 0001).
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
end $$;

do $$
declare t text;
begin
  foreach t in array array['leads', 'receitas', 'custos']
  loop
    execute format('drop policy if exists %I on %I', t || '_rw', t);
    execute format(
      'create policy %I on %I for all to authenticated using (true) with check (true)',
      t || '_rw', t
    );
  end loop;
end $$;
