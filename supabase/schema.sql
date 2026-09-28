-- =====================================================================
-- Controle de Vendas — Prova Oral Suporte 24h
-- Base do banco (idempotente). Execute também os arquivos em migrations/
-- em ordem para instalar Checkout Asaas, itens, descontos e modos de venda.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Tabelas
-- ---------------------------------------------------------------------

create table if not exists public.produtos (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null check (length(btrim(nome)) > 0),
  preco      numeric(12, 2) not null default 0 check (preco >= 0),
  arquivado  boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.turmas (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null check (length(btrim(nome)) > 0),
  arquivado  boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vendas (
  id                 uuid primary key default gen_random_uuid(),

  comprador_nome     text not null check (length(btrim(comprador_nome)) > 0),
  comprador_telefone text not null default '',
  comprador_email    text not null default '',

  -- on delete restrict: o histórico da venda nunca é destruído por engano.
  produto_id         uuid references public.produtos(id) on delete restrict,
  turma_id           uuid references public.turmas(id)   on delete restrict,

  -- Nome congelado no momento da venda: o relatório continua legível
  -- mesmo que o produto/turma seja renomeado depois.
  produto_nome       text not null default '',
  turma_nome         text not null default '',

  valor              numeric(12, 2) not null default 0 check (valor >= 0),

  status             text not null default 'comprovante_nao_anexado'
                     check (status in ('comprovante_nao_anexado', 'comprovante_anexado')),

  comprovante_path   text,
  comprovante_nome   text,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2. Índices
-- ---------------------------------------------------------------------

create index if not exists vendas_created_at_idx on public.vendas (created_at desc);
create index if not exists vendas_produto_id_idx on public.vendas (produto_id);
create index if not exists vendas_turma_id_idx   on public.vendas (turma_id);
create index if not exists vendas_status_idx     on public.vendas (status);

-- ---------------------------------------------------------------------
-- 3. Triggers
-- ---------------------------------------------------------------------

-- updated_at automático
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists produtos_set_updated_at on public.produtos;
create trigger produtos_set_updated_at
  before update on public.produtos
  for each row execute function public.set_updated_at();

drop trigger if exists turmas_set_updated_at on public.turmas;
create trigger turmas_set_updated_at
  before update on public.turmas
  for each row execute function public.set_updated_at();

drop trigger if exists vendas_set_updated_at on public.vendas;
create trigger vendas_set_updated_at
  before update on public.vendas
  for each row execute function public.set_updated_at();

-- Garante no banco a regra: status = 'comprovante_anexado' se, e somente se,
-- existe arquivo anexado. O status nunca fica dessincronizado do arquivo.
create or replace function public.sync_status_comprovante()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.comprovante_path is null or length(btrim(new.comprovante_path)) = 0 then
    new.comprovante_path := null;
    new.comprovante_nome := null;
    new.status := 'comprovante_nao_anexado';
  else
    new.status := 'comprovante_anexado';
  end if;
  return new;
end;
$$;

drop trigger if exists vendas_sync_status on public.vendas;
create trigger vendas_sync_status
  before insert or update on public.vendas
  for each row execute function public.sync_status_comprovante();

-- ---------------------------------------------------------------------
-- 4. Row Level Security
--    Painel interno de um dono só: qualquer usuário autenticado pelo
--    Supabase Auth tem acesso total. Anônimos não têm acesso nenhum.
-- ---------------------------------------------------------------------

alter table public.produtos enable row level security;
alter table public.turmas   enable row level security;
alter table public.vendas   enable row level security;

drop policy if exists "produtos: acesso total autenticado" on public.produtos;
create policy "produtos: acesso total autenticado" on public.produtos
  for all to authenticated using (true) with check (true);

drop policy if exists "turmas: acesso total autenticado" on public.turmas;
create policy "turmas: acesso total autenticado" on public.turmas
  for all to authenticated using (true) with check (true);

drop policy if exists "vendas: acesso total autenticado" on public.vendas;
create policy "vendas: acesso total autenticado" on public.vendas
  for all to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------
-- 5. Storage — bucket privado dos comprovantes
-- ---------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'comprovantes',
  'comprovantes',
  false,
  20971520, -- 20 MB
  array['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/heic', 'application/pdf']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "comprovantes: leitura autenticada"  on storage.objects;
create policy "comprovantes: leitura autenticada" on storage.objects
  for select to authenticated using (bucket_id = 'comprovantes');

drop policy if exists "comprovantes: upload autenticado"   on storage.objects;
create policy "comprovantes: upload autenticado" on storage.objects
  for insert to authenticated with check (bucket_id = 'comprovantes');

drop policy if exists "comprovantes: update autenticado"   on storage.objects;
create policy "comprovantes: update autenticado" on storage.objects
  for update to authenticated
  using (bucket_id = 'comprovantes') with check (bucket_id = 'comprovantes');

drop policy if exists "comprovantes: delete autenticado"   on storage.objects;
create policy "comprovantes: delete autenticado" on storage.objects
  for delete to authenticated using (bucket_id = 'comprovantes');

-- ---------------------------------------------------------------------
-- Pronto. Nenhum dado de exemplo é inserido: o painel começa vazio,
-- com estados vazios que orientam o primeiro cadastro.
-- ---------------------------------------------------------------------
