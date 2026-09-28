-- Itens e descontos persistidos separadamente do valor final da venda.
alter table public.vendas
  add column if not exists valor_bruto numeric(12,2),
  add column if not exists desconto_tipo text not null default 'nenhum'
    check (desconto_tipo in ('nenhum', 'percentual', 'fixo')),
  add column if not exists desconto_valor numeric(12,2) not null default 0
    check (desconto_valor >= 0),
  add column if not exists desconto_observacao text;

update public.vendas set valor_bruto = valor where valor_bruto is null;
alter table public.vendas alter column valor_bruto set not null;
do $$ begin
  if not exists (select 1 from pg_constraint
    where conname = 'vendas_valor_bruto_nao_negativo'
      and conrelid = 'public.vendas'::regclass) then
    alter table public.vendas add constraint vendas_valor_bruto_nao_negativo
      check (valor_bruto >= 0);
  end if;
end $$;

create table if not exists public.venda_itens (
  venda_id uuid not null references public.vendas(id) on delete cascade,
  ordem integer not null check (ordem between 1 and 20),
  produto_id uuid references public.produtos(id) on delete restrict,
  produto_nome text not null,
  preco_unitario numeric(12,2) not null check (preco_unitario >= 0),
  primary key (venda_id, ordem),
  unique (venda_id, produto_id)
);
create index if not exists venda_itens_produto_id_idx on public.venda_itens(produto_id);

-- Preserva vendas antigas, inclusive produtos que não tenham mais vínculo.
insert into public.venda_itens(venda_id, ordem, produto_id, produto_nome, preco_unitario)
select v.id, 1, v.produto_id, v.produto_nome, v.valor
from public.vendas v
where not exists (select 1 from public.venda_itens i where i.venda_id = v.id)
  and (v.produto_id is not null or v.produto_nome <> '');

alter table public.venda_itens enable row level security;
grant select on public.venda_itens to authenticated;
drop policy if exists "venda_itens: leitura autenticada" on public.venda_itens;
create policy "venda_itens: leitura autenticada" on public.venda_itens
  for select to authenticated using (true);

-- A única escrita de valores e itens ocorre nas funções transacionais abaixo.
revoke insert, update on public.vendas from authenticated;
grant update (comprovante_path, comprovante_nome) on public.vendas to authenticated;
revoke insert, update, delete on public.venda_itens from authenticated;

create schema if not exists private;

create or replace function private.calcular_itens_venda(
  p_produto_ids uuid[], p_desconto_tipo text, p_desconto_valor numeric,
  p_permitir_arquivados boolean default false
)
returns table (
  produto_primeiro uuid, nomes text, bruto numeric, final numeric
)
language plpgsql security definer set search_path = '' as $$
declare
  v_quantidade integer;
  v_encontrados integer;
  v_arquivados integer;
  v_sem_preco integer;
  v_abatimento numeric;
begin
  v_quantidade := coalesce(array_length(p_produto_ids, 1), 0);
  if v_quantidade < 1 or v_quantidade > 20 then
    raise exception 'Selecione entre 1 e 20 produtos.';
  end if;
  if (select count(distinct id) from unnest(p_produto_ids) as t(id)) <> v_quantidade then
    raise exception 'Um produto não pode aparecer duas vezes na venda.';
  end if;

  select count(*), count(*) filter (where p.arquivado),
         count(*) filter (where p.preco <= 0),
         (array_agg(p.id order by escolha.ordem))[1],
         string_agg(p.nome, ' + ' order by escolha.ordem),
         coalesce(sum(p.preco), 0)
    into v_encontrados, v_arquivados, v_sem_preco,
         produto_primeiro, nomes, bruto
  from unnest(p_produto_ids) with ordinality as escolha(id, ordem)
  join public.produtos p on p.id = escolha.id;

  if v_encontrados <> v_quantidade then
    raise exception 'Um dos produtos não foi encontrado.';
  end if;
  if v_arquivados > 0 and not p_permitir_arquivados then
    raise exception 'Um dos produtos selecionados está arquivado.';
  end if;
  if v_sem_preco > 0 then
    raise exception 'Todos os produtos precisam ter preço maior que zero.';
  end if;
  if p_desconto_tipo not in ('nenhum', 'percentual', 'fixo') or
     p_desconto_valor is null or p_desconto_valor < 0 then
    raise exception 'Desconto inválido.';
  end if;
  if round(p_desconto_valor, 2) <> p_desconto_valor then
    raise exception 'O desconto aceita até duas casas decimais.';
  end if;
  if p_desconto_tipo = 'nenhum' and p_desconto_valor <> 0 then
    raise exception 'Desconto inválido.';
  end if;
  if p_desconto_tipo <> 'nenhum' and p_desconto_valor <= 0 then
    raise exception 'Informe um desconto maior que zero.';
  end if;
  if p_desconto_tipo = 'percentual' and p_desconto_valor > 100 then
    raise exception 'O desconto percentual não pode passar de 100%%.';
  end if;

  v_abatimento := case p_desconto_tipo
    when 'percentual' then round(bruto * p_desconto_valor / 100, 2)
    when 'fixo' then p_desconto_valor
    else 0 end;
  final := bruto - v_abatimento;
  if final < v_quantidade * 0.01 then
    raise exception 'O desconto deixa o valor abaixo do mínimo de R$ 0,01 por produto.';
  end if;
  return next;
end;
$$;

create or replace function public.criar_venda_com_produtos(
  p_comprador_nome text, p_comprador_telefone text, p_comprador_email text,
  p_produto_ids uuid[], p_turma_id uuid,
  p_desconto_tipo text, p_desconto_valor numeric, p_desconto_observacao text
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_produto uuid;
  v_nomes text;
  v_bruto numeric;
  v_final numeric;
  v_turma_nome text := '';
begin
  if auth.uid() is null then raise exception 'Faça login novamente.'; end if;
  if length(btrim(coalesce(p_comprador_nome, ''))) = 0 then
    raise exception 'Informe o nome do comprador.';
  end if;
  if length(coalesce(p_desconto_observacao, '')) > 1000 then
    raise exception 'A observação deve ter até 1000 caracteres.';
  end if;
  if p_turma_id is not null then
    select nome into v_turma_nome from public.turmas where id = p_turma_id and not arquivado;
    if v_turma_nome is null then raise exception 'Turma não encontrada ou arquivada.'; end if;
  end if;

  select produto_primeiro, nomes, bruto, final
    into v_produto, v_nomes, v_bruto, v_final
  from private.calcular_itens_venda(p_produto_ids, p_desconto_tipo, p_desconto_valor);

  insert into public.vendas(
    comprador_nome, comprador_telefone, comprador_email,
    produto_id, produto_nome, turma_id, turma_nome, valor_bruto, valor,
    desconto_tipo, desconto_valor, desconto_observacao
  ) values (
    btrim(p_comprador_nome), coalesce(p_comprador_telefone, ''),
    coalesce(p_comprador_email, ''), v_produto, v_nomes,
    p_turma_id, coalesce(v_turma_nome, ''), v_bruto, v_final,
    p_desconto_tipo, p_desconto_valor,
    case when p_desconto_tipo = 'nenhum' then null
      else nullif(btrim(coalesce(p_desconto_observacao, '')), '') end
  ) returning id into v_id;

  insert into public.venda_itens(venda_id, ordem, produto_id, produto_nome, preco_unitario)
  select v_id, escolha.ordem::integer, p.id, p.nome, p.preco
  from unnest(p_produto_ids) with ordinality as escolha(id, ordem)
  join public.produtos p on p.id = escolha.id;
  return v_id;
end;
$$;

create or replace function public.atualizar_venda_com_produtos(
  p_id uuid, p_comprador_nome text, p_comprador_telefone text, p_comprador_email text,
  p_produto_ids uuid[], p_turma_id uuid,
  p_desconto_tipo text, p_desconto_valor numeric, p_desconto_observacao text
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_status text;
  v_reserva uuid;
  v_produto uuid;
  v_nomes text;
  v_bruto numeric;
  v_final numeric;
  v_turma_nome text := '';
begin
  if auth.uid() is null then raise exception 'Faça login novamente.'; end if;
  select pagamento_status, asaas_checkout_reserva
    into v_status, v_reserva from public.vendas where id = p_id for update;
  if v_status is distinct from 'nao_monitorado' or v_reserva is not null then
    raise exception 'Uma venda vinculada ao Asaas não pode ser editada.';
  end if;
  if length(btrim(coalesce(p_comprador_nome, ''))) = 0 then
    raise exception 'Informe o nome do comprador.';
  end if;
  if length(coalesce(p_desconto_observacao, '')) > 1000 then
    raise exception 'A observação deve ter até 1000 caracteres.';
  end if;
  if p_turma_id is not null then
    select nome into v_turma_nome from public.turmas where id = p_turma_id;
    if v_turma_nome is null then raise exception 'Turma não encontrada.'; end if;
  end if;

  select produto_primeiro, nomes, bruto, final
    into v_produto, v_nomes, v_bruto, v_final
  from private.calcular_itens_venda(p_produto_ids, p_desconto_tipo, p_desconto_valor, true);

  update public.vendas set
    comprador_nome = btrim(p_comprador_nome),
    comprador_telefone = coalesce(p_comprador_telefone, ''),
    comprador_email = coalesce(p_comprador_email, ''),
    produto_id = v_produto, produto_nome = v_nomes,
    turma_id = p_turma_id, turma_nome = coalesce(v_turma_nome, ''),
    valor_bruto = v_bruto, valor = v_final,
    desconto_tipo = p_desconto_tipo, desconto_valor = p_desconto_valor,
    desconto_observacao = case when p_desconto_tipo = 'nenhum' then null
      else nullif(btrim(coalesce(p_desconto_observacao, '')), '') end
  where id = p_id;

  delete from public.venda_itens where venda_id = p_id;
  insert into public.venda_itens(venda_id, ordem, produto_id, produto_nome, preco_unitario)
  select p_id, escolha.ordem::integer, p.id, p.nome, p.preco
  from unnest(p_produto_ids) with ordinality as escolha(id, ordem)
  join public.produtos p on p.id = escolha.id;
end;
$$;

revoke all on function public.criar_venda_com_produtos(text,text,text,uuid[],uuid,text,numeric,text) from public, anon;
revoke all on function public.atualizar_venda_com_produtos(uuid,text,text,text,uuid[],uuid,text,numeric,text) from public, anon;
grant execute on function public.criar_venda_com_produtos(text,text,text,uuid[],uuid,text,numeric,text) to authenticated;
grant execute on function public.atualizar_venda_com_produtos(uuid,text,text,text,uuid[],uuid,text,numeric,text) to authenticated;
