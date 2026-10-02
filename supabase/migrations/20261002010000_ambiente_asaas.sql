-- Preserva a origem dos registros ao passar dos testes para produção.
alter table public.vendas add column if not exists asaas_ambiente text
  check (asaas_ambiente in ('sandbox', 'producao'));
alter table public.asaas_checkouts add column if not exists ambiente text
  check (ambiente in ('sandbox', 'producao'));

update public.vendas set asaas_ambiente = case
  when asaas_checkout_url like 'https://sandbox.asaas.com/%' then 'sandbox'
  when asaas_checkout_url like 'https://asaas.com/%' or asaas_checkout_url like 'https://www.asaas.com/%' then 'producao'
  else null end
where asaas_ambiente is null and modo_venda = 'checkout';
update public.vendas v set asaas_ambiente = i.ambiente
from public.integracoes i where i.provedor = 'asaas' and i.ativa
  and v.modo_venda = 'checkout' and v.asaas_checkout_url is null and v.asaas_ambiente is null;
update public.asaas_checkouts c set ambiente = v.asaas_ambiente
from public.vendas v where v.id = c.venda_id and c.ambiente is null;

create or replace function public.reservar_ambiente_asaas()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_ambiente text; v_configurando timestamptz;
begin
  if new.asaas_checkout_reserva is not null and
     new.asaas_checkout_reserva is distinct from old.asaas_checkout_reserva then
    select ambiente, configurando_em into v_ambiente, v_configurando
      from public.integracoes where provedor = 'asaas' and ativa for update;
    if v_configurando is not null then raise exception 'A integração está sendo configurada. Aguarde e tente novamente.'; end if;
    if v_ambiente is not null then
      if old.asaas_ambiente is not null and old.asaas_ambiente <> v_ambiente then
        raise exception 'Esta venda pertence ao ambiente de testes. Crie uma nova venda para produção.';
      end if;
      new.asaas_ambiente := v_ambiente;
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists vendas_reservar_ambiente on public.vendas;
create trigger vendas_reservar_ambiente before update on public.vendas
  for each row execute function public.reservar_ambiente_asaas();

create or replace function public.identificar_ambiente_checkout()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  select asaas_ambiente into new.ambiente from public.vendas where id = new.venda_id;
  return new;
end;
$$;
drop trigger if exists checkout_identificar_ambiente on public.asaas_checkouts;
create trigger checkout_identificar_ambiente before insert on public.asaas_checkouts
  for each row execute function public.identificar_ambiente_checkout();
