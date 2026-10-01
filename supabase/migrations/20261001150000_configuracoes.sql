-- Credenciais cifradas no servidor; nenhuma leitura ou escrita pelo navegador.
create table if not exists public.integracoes (
  provedor text primary key check (provedor = 'asaas'),
  segredo text,
  segredo_pendente text,
  ambiente text check (ambiente in ('sandbox', 'producao')),
  email text,
  webhook_id text,
  ativa boolean not null default false,
  configurando_em timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.integracoes enable row level security;
revoke all on public.integracoes from public, anon, authenticated;
grant select, insert, update on public.integracoes to service_role;
insert into public.integracoes (provedor) values ('asaas') on conflict do nothing;
