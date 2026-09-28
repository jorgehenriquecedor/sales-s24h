import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const db = await new PGlite();
const base = readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8");
const ddl = base.slice(0, base.indexOf("-- 4. Row Level Security"));
await db.exec(ddl);
await db.exec(`
  create role authenticated;
  create schema auth;
  create function auth.role() returns text language sql stable as $$
    select nullif(current_setting('app.role', true), '')
  $$;
`);
const migration = readFileSync(
  new URL("../supabase/migrations/20260928150000_asaas_checkout.sql", import.meta.url),
  "utf8",
);
await db.exec(migration);
await db.exec(migration);
console.log("✓ Migração Asaas aplicada duas vezes");

await db.query("select set_config('app.role', 'authenticated', false)");
const { rows: [sale] } = await db.query(`
  insert into public.vendas (comprador_nome, produto_nome, valor)
  values ('Cliente', 'Curso', 100)
  returning id, pagamento_status
`);
assert.equal(sale.pagamento_status, "nao_monitorado");

await assert.rejects(db.query(
  "update public.vendas set pagamento_status='aprovada' where id=$1",
  [sale.id],
));
console.log("✓ Usuário autenticado não pode aprovar a própria venda");

await db.query("select set_config('app.role', 'service_role', false)");
await db.query("update public.vendas set pagamento_status='pendente', asaas_checkout_id='check-1' where id=$1", [sale.id]);
await db.query("insert into public.asaas_checkouts(id, venda_id, expira_em) values ('check-1', $1, now() + interval '1 day')", [sale.id]);

await db.query("select set_config('app.role', 'authenticated', false)");
await assert.rejects(db.query("update public.vendas set valor=1 where id=$1", [sale.id]));
await assert.rejects(db.query("delete from public.vendas where id=$1", [sale.id]));
console.log("✓ Valor e histórico da venda com checkout ficam protegidos");

await db.query("select set_config('app.role', 'service_role', false)");
await db.query("update public.vendas set pagamento_status='aprovada' where id=$1", [sale.id]);
const { rows: [approved] } = await db.query("select pagamento_status from public.vendas where id=$1", [sale.id]);
assert.equal(approved.pagamento_status, "aprovada");
console.log("✓ Servidor consegue aprovar a venda");
await db.close();
