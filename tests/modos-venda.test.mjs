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
const migration = (name) => readFileSync(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8");
await db.exec(migration("20260928150000_asaas_checkout.sql"));
await db.exec("grant select, insert, update, delete on public.vendas to authenticated");
await db.exec(migration("20260928170000_venda_multiplos_produtos.sql"));
const { rows: [p] } = await db.query("insert into public.produtos(nome,preco) values ('Curso',100) returning id");

const { rows: [antiga] } = await db.query(`
  insert into public.vendas(comprador_nome,produto_id,produto_nome,valor,valor_bruto,comprovante_path)
  values ('Antiga',$1,'Curso',100,100,'antiga/recibo.pdf') returning id
`, [p.id]);
const nova = migration("20260928190000_modos_venda.sql");
await db.exec(nova);
await db.exec(nova);
const { rows: [legado] } = await db.query(
  "select modo_venda,pagamento_status from public.vendas where id=$1", [antiga.id],
);
assert.deepEqual(legado, { modo_venda: "manual", pagamento_status: "aprovada" });
console.log("✓ Migração preserva vendas antigas e é idempotente");

await db.query("select set_config('app.role','authenticated',false)");
await db.exec("set role authenticated");
const criar = (modo) => db.query(`
  select public.criar_venda_com_modo(
    'Aluno','','',array[$1]::uuid[],null,'nenhum',0,null,$2
  ) as id
`, [p.id, modo]);
const { rows: [manual] } = await criar("manual");
const { rows: [pendente] } = await db.query(
  "select modo_venda,pagamento_status from public.vendas where id=$1", [manual.id],
);
assert.deepEqual(pendente, { modo_venda: "manual", pagamento_status: "pendente" });
await db.query("update public.vendas set comprovante_path=$1 where id=$2", [`${manual.id}/recibo.pdf`, manual.id]);
const { rows: [aprovada] } = await db.query(
  "select pagamento_status,status from public.vendas where id=$1", [manual.id],
);
assert.deepEqual(aprovada, { pagamento_status: "aprovada", status: "comprovante_anexado" });
await db.query("update public.vendas set comprovante_path=null where id=$1", [manual.id]);
const { rows: [revertida] } = await db.query(
  "select pagamento_status,status from public.vendas where id=$1", [manual.id],
);
assert.deepEqual(revertida, { pagamento_status: "pendente", status: "comprovante_nao_anexado" });
await db.query(`
  select public.atualizar_venda_com_produtos($1,'Aluno editado','','',array[$2]::uuid[],null,'nenhum',0,null)
`, [manual.id, p.id]);
console.log("✓ Venda manual aprova com anexo, reverte ao remover e continua editável");

const { rows: [checkout] } = await criar("checkout");
await db.query("update public.vendas set comprovante_path=$1 where id=$2", [`${checkout.id}/recibo.pdf`, checkout.id]);
const { rows: [semAprovacao] } = await db.query(
  "select modo_venda,pagamento_status from public.vendas where id=$1", [checkout.id],
);
assert.deepEqual(semAprovacao, { modo_venda: "checkout", pagamento_status: "pendente" });
await assert.rejects(db.query("update public.vendas set pagamento_status='aprovada' where id=$1", [checkout.id]));
await db.exec("reset role");
await db.query("select set_config('app.role','',false)");
await db.query("update public.vendas set asaas_checkout_id='check-1' where id=$1", [checkout.id]);
await db.query("select set_config('app.role','authenticated',false)");
await db.exec("set role authenticated");
await assert.rejects(db.query(`
  select public.atualizar_venda_com_produtos($1,'Outro','','',array[$2]::uuid[],null,'nenhum',0,null)
`, [checkout.id, p.id]));
await assert.rejects(db.query("delete from public.vendas where id=$1", [checkout.id]));
await db.exec("reset role");
await db.query("select set_config('app.role','',false)");
await db.query("update public.vendas set pagamento_status='aprovada' where id=$1", [checkout.id]);
const { rows: [confirmada] } = await db.query(
  "select pagamento_status from public.vendas where id=$1", [checkout.id],
);
assert.equal(confirmada.pagamento_status, "aprovada");
console.log("✓ Anexo manual não aprova Checkout; só a confirmação do servidor aprova");

const compradorCheckout = migration("20261001180000_comprador_checkout.sql");
await db.exec(compradorCheckout);
await db.exec(compradorCheckout);
const { rows: [turma] } = await db.query("insert into public.turmas(nome) values ('Turma A') returning id");
await db.query("select set_config('app.role','authenticated',false)");
await db.exec("set role authenticated");
await assert.rejects(criar("checkout"), /Selecione a turma/);
const criarCheckout = (produtos, turmaId) => db.query(`
  select public.criar_venda_com_modo('', '', '', $1::uuid[], $2, 'nenhum', 0, null, 'checkout') as id
`, [produtos, turmaId]);
await assert.rejects(criarCheckout([], turma.id));
await assert.rejects(criarCheckout([p.id], '99999999-9999-4999-8999-999999999999'), /Turma não encontrada/);
const { rows: [semComprador] } = await criarCheckout([p.id], turma.id);
const consultar = async () => (await db.query(
  'select comprador_nome, comprador_email, comprador_telefone, turma_id, valor, pagamento_status from public.vendas where id=$1',
  [semComprador.id],
)).rows[0];
assert.deepEqual(await consultar(), {
  comprador_nome: 'Aguardando dados do comprador', comprador_email: '', comprador_telefone: '',
  turma_id: turma.id, valor: '100.00', pagamento_status: 'pendente',
});
await assert.rejects(db.query(`
  select public.atualizar_venda_com_produtos($1,'','','',array[$2]::uuid[],null,'nenhum',0,null)
`, [semComprador.id, p.id]), /Selecione a turma/);
await db.query(`
  select public.atualizar_venda_com_produtos($1,'Nome forjado','123','forjado@example.com',array[$2]::uuid[],$3,'nenhum',0,null)
`, [semComprador.id, p.id, turma.id]);
assert.equal((await consultar()).comprador_nome, 'Aguardando dados do comprador');
assert.equal((await consultar()).comprador_email, '');
assert.equal((await consultar()).comprador_telefone, '');
await assert.rejects(db.query(`
  select public.criar_venda_com_modo('', '', '', array[$1]::uuid[], null, 'nenhum', 0, null, 'manual')
`, [p.id]), /Informe o nome/);
await criar('manual');
console.log('✓ Checkout exige produtos e turma, aceita comprador ausente e impede edição manual de seus dados');
await db.close();
