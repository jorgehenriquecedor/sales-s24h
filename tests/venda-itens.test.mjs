import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const db = await new PGlite();
const base = readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8");
await db.exec(base.slice(0, base.indexOf("-- 4. Row Level Security")));
await db.exec(`
  create role authenticated;
  create role anon;
  create schema auth;
  grant usage on schema auth to authenticated;
  create function auth.role() returns text language sql stable as $$
    select nullif(current_setting('app.role', true), '')
  $$;
  create function auth.uid() returns uuid language sql stable as $$
    select case when current_setting('app.role', true) = 'authenticated'
      then '11111111-1111-1111-1111-111111111111'::uuid else null end
  $$;
  grant execute on function auth.role() to authenticated;
  grant execute on function auth.uid() to authenticated;
`);
const read = (name) => readFileSync(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8");
await db.exec(read("20260928150000_asaas_checkout.sql"));
await db.exec("grant select, insert, update, delete on public.vendas to authenticated");

const { rows: [a] } = await db.query("insert into public.produtos(nome, preco) values ('Curso A', 100) returning id");
const { rows: [b] } = await db.query("insert into public.produtos(nome, preco) values ('Curso B', 50) returning id");
const { rows: [legacy] } = await db.query(
  "insert into public.vendas(comprador_nome, produto_id, produto_nome, valor) values ('Antiga', $1, 'Curso A', 80) returning id",
  [a.id],
);

const migration = read("20260928170000_venda_multiplos_produtos.sql");
await db.exec(migration);
await db.exec(migration);
await db.exec("set role authenticated");
await assert.rejects(db.query(
  "insert into public.vendas(comprador_nome, produto_nome, valor) values ('Fraude', 'Curso', 1)",
));
await assert.rejects(db.query(
  "update public.vendas set valor=1 where id=$1", [legacy.id],
));
await db.query("select set_config('app.role', 'authenticated', false)");
await db.query("update public.vendas set comprovante_path=$1 where id=$2", [`${legacy.id}/recibo.pdf`, legacy.id]);
await db.exec("reset role");
console.log("✓ Valor protegido e anexo manual preservado");
const { rows: [old] } = await db.query(
  "select v.valor_bruto, i.preco_unitario from public.vendas v join public.venda_itens i on i.venda_id=v.id where v.id=$1",
  [legacy.id],
);
assert.equal(Number(old.valor_bruto), 80);
assert.equal(Number(old.preco_unitario), 80);
console.log("✓ Vendas antigas preservam o valor histórico; migração idempotente");
await db.exec("set role authenticated");
await db.query("delete from public.vendas where id=$1", [legacy.id]);
await db.exec("reset role");
const { rows: [remaining] } = await db.query(
  "select count(*)::integer as total from public.venda_itens where venda_id=$1", [legacy.id],
);
assert.equal(remaining.total, 0);
console.log("✓ Exclusão de venda antiga também limpa os itens");

await db.query("select set_config('app.role', 'authenticated', false)");
await db.exec("set role authenticated");
const { rows: [created] } = await db.query(`
  select public.criar_venda_com_produtos(
    'Aluno', '', '', array[$1,$2]::uuid[], null, 'percentual', 10, 'Campanha'
  ) as id
`, [a.id, b.id]);
const { rows: [sale] } = await db.query(
  "select valor_bruto, valor, desconto_tipo, desconto_valor, desconto_observacao, produto_nome from public.vendas where id=$1",
  [created.id],
);
assert.equal(Number(sale.valor_bruto), 150);
assert.equal(Number(sale.valor), 135);
assert.equal(sale.produto_nome, "Curso A + Curso B");
assert.equal(sale.desconto_observacao, "Campanha");
const { rows: items } = await db.query(
  "select produto_nome, preco_unitario from public.venda_itens where venda_id=$1 order by ordem",
  [created.id],
);
assert.deepEqual(items.map((i) => i.produto_nome), ["Curso A", "Curso B"]);
console.log("✓ Dois produtos somados e desconto percentual calculado no banco");

await db.query(`
  select public.atualizar_venda_com_produtos(
    $1, 'Aluno', '', '', array[$2,$3]::uuid[], null, 'fixo', 20, null
  )
`, [created.id, a.id, b.id]);
const { rows: [updated] } = await db.query(
  "select valor_bruto, valor, desconto_tipo from public.vendas where id=$1", [created.id],
);
assert.equal(Number(updated.valor), 130);
assert.equal(updated.desconto_tipo, "fixo");
console.log("✓ Desconto fixo aplicado sem aceitar valor digitado pelo cliente");

await assert.rejects(db.query(`
  select public.criar_venda_com_produtos('Aluno', '', '', array[$1,$1]::uuid[], null, 'nenhum', 0, null)
`, [a.id]));
await assert.rejects(db.query(`
  select public.criar_venda_com_produtos('Aluno', '', '', array[$1,$2]::uuid[], null, 'fixo', 200, null)
`, [a.id, b.id]));
await assert.rejects(db.query(`
  select public.criar_venda_com_produtos('Aluno', '', '', array[$1,$2]::uuid[], null, 'fixo', 0.001, null)
`, [a.id, b.id]));
console.log("✓ Produto duplicado, desconto acima do total e frações de centavo são rejeitados");
await db.exec("reset role");
await db.close();
