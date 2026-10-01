-- Dados do comprador vêm do Asaas; produto e turma são definidos no painel.
create or replace function public.criar_venda_com_modo(
  p_comprador_nome text, p_comprador_telefone text, p_comprador_email text,
  p_produto_ids uuid[], p_turma_id uuid,
  p_desconto_tipo text, p_desconto_valor numeric, p_desconto_observacao text,
  p_modo_venda text
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'Faça login novamente.'; end if;
  if p_modo_venda not in ('manual', 'checkout') or p_modo_venda is null then
    raise exception 'Escolha Com Checkout ou Sem Checkout.';
  end if;
  if p_modo_venda = 'checkout' then
    if p_turma_id is null then raise exception 'Selecione a turma da venda com checkout.'; end if;
    p_comprador_nome := 'Aguardando dados do comprador';
    p_comprador_telefone := '';
    p_comprador_email := '';
  end if;
  v_id := public.criar_venda_com_produtos(
    p_comprador_nome, p_comprador_telefone, p_comprador_email,
    p_produto_ids, p_turma_id, p_desconto_tipo, p_desconto_valor,
    p_desconto_observacao
  );
  update public.vendas set modo_venda = p_modo_venda where id = v_id;
  return v_id;
end;
$$;

revoke all on function public.criar_venda_com_modo(text,text,text,uuid[],uuid,text,numeric,text,text) from public, anon;
grant execute on function public.criar_venda_com_modo(text,text,text,uuid[],uuid,text,numeric,text,text) to authenticated;

create or replace function public.atualizar_venda_com_produtos(
  p_id uuid, p_comprador_nome text, p_comprador_telefone text, p_comprador_email text,
  p_produto_ids uuid[], p_turma_id uuid,
  p_desconto_tipo text, p_desconto_valor numeric, p_desconto_observacao text
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_status text;
  v_modo text;
  v_checkout_id text;
  v_reserva uuid;
  v_produto uuid;
  v_nomes text;
  v_bruto numeric;
  v_final numeric;
  v_turma_nome text := '';
begin
  if auth.uid() is null then raise exception 'Faça login novamente.'; end if;
  select pagamento_status, modo_venda, asaas_checkout_id, asaas_checkout_reserva
    into v_status, v_modo, v_checkout_id, v_reserva
    from public.vendas where id = p_id for update;
  if v_status is null or v_reserva is not null or
     (v_modo = 'checkout' and v_checkout_id is not null) then
    raise exception 'Uma venda vinculada ao Asaas não pode ser editada.';
  end if;
  if v_modo = 'checkout' then
    if p_turma_id is null then raise exception 'Selecione a turma da venda com checkout.'; end if;
    select comprador_nome, comprador_telefone, comprador_email
      into p_comprador_nome, p_comprador_telefone, p_comprador_email
      from public.vendas where id = p_id;
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

