-- Checkout Asaas: o status do comprovante legado continua independente.
alter table public.vendas
  add column if not exists pagamento_status text not null default 'nao_monitorado'
    check (pagamento_status in ('nao_monitorado', 'pendente', 'expirada', 'aprovada')),
  add column if not exists asaas_checkout_id text,
  add column if not exists asaas_checkout_url text,
  add column if not exists asaas_checkout_expira_em timestamptz,
  add column if not exists asaas_pagamento_id text,
  add column if not exists asaas_comprovante_url text,
  add column if not exists asaas_checkout_reserva uuid;

create unique index if not exists vendas_asaas_checkout_id_unique
  on public.vendas (asaas_checkout_id) where asaas_checkout_id is not null;
create index if not exists vendas_pagamento_status_idx
  on public.vendas (pagamento_status);

create table if not exists public.asaas_checkouts (
  id text primary key,
  venda_id uuid not null references public.vendas(id) on delete restrict,
  status text not null default 'pendente'
    check (status in ('pendente', 'expirada', 'aprovada', 'cancelada')),
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null,
  pago_em timestamptz
);
create index if not exists asaas_checkouts_venda_id_idx
  on public.asaas_checkouts (venda_id, criado_em desc);

create table if not exists public.asaas_eventos (
  id text primary key,
  evento text not null,
  recurso_id text not null,
  processado_em timestamptz not null default now()
);

alter table public.asaas_checkouts enable row level security;
alter table public.asaas_eventos enable row level security;

-- O navegador pode ler somente o histórico de tentativas, não alterar eventos.
drop policy if exists "asaas_checkouts: leitura autenticada" on public.asaas_checkouts;
create policy "asaas_checkouts: leitura autenticada" on public.asaas_checkouts
  for select to authenticated using (true);

-- Os campos financeiros são alterados apenas pelo servidor com service_role.
create or replace function public.proteger_venda_asaas()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'DELETE' and auth.role() is distinct from 'authenticated' then
    return old;
  end if;
  if auth.role() = 'authenticated' then
    if tg_op = 'DELETE' then
      if old.pagamento_status <> 'nao_monitorado' then
        raise exception 'Uma venda vinculada ao Asaas não pode ser excluída.';
      end if;
      return old;
    end if;

    if tg_op = 'INSERT' then
      if new.pagamento_status <> 'nao_monitorado' or
         new.asaas_checkout_id is not null or
         new.asaas_checkout_url is not null or
         new.asaas_checkout_reserva is not null or
         new.asaas_pagamento_id is not null or
         new.asaas_comprovante_url is not null then
        raise exception 'Campos do Asaas só podem ser escritos pelo servidor.';
      end if;
    else
      if (new.pagamento_status, new.asaas_checkout_id, new.asaas_checkout_url,
          new.asaas_checkout_expira_em, new.asaas_checkout_reserva,
          new.asaas_pagamento_id, new.asaas_comprovante_url)
         is distinct from
         (old.pagamento_status, old.asaas_checkout_id, old.asaas_checkout_url,
          old.asaas_checkout_expira_em, old.asaas_checkout_reserva,
          old.asaas_pagamento_id, old.asaas_comprovante_url) then
        raise exception 'Campos do Asaas só podem ser escritos pelo servidor.';
      end if;

      if old.pagamento_status <> 'nao_monitorado' and
         (new.valor, new.produto_id, new.turma_id, new.produto_nome,
          new.turma_nome, new.comprador_nome) is distinct from
         (old.valor, old.produto_id, old.turma_id, old.produto_nome,
          old.turma_nome, old.comprador_nome) then
        raise exception 'Dados de uma venda vinculada ao Asaas não podem ser alterados.';
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists vendas_proteger_asaas on public.vendas;
create trigger vendas_proteger_asaas
  before insert or update or delete on public.vendas
  for each row execute function public.proteger_venda_asaas();
