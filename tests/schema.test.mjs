import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

const db = await new PGlite();

const sql = readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8");

// PGlite não tem o schema `storage` nem os papéis do Supabase. Roda-se aqui a
// parte de DDL pura (seções 1 a 3), que é onde mora a lógica de verdade.
const ddl = sql.slice(0, sql.indexOf("-- 4. Row Level Security"));

try {
  await db.exec(ddl);
  console.log("✓ DDL executado sem erro de sintaxe");
} catch (e) {
  console.error("✗ DDL falhou:", e.message);
  process.exit(1);
}

// Idempotência: rodar de novo não pode quebrar.
try {
  await db.exec(ddl);
  console.log("✓ Script é idempotente (rodou duas vezes)");
} catch (e) {
  console.error("✗ Segunda execução falhou:", e.message);
  process.exit(1);
}

const p = await db.query(
  "insert into produtos (nome, preco) values ('Mentoria', 2997.00) returning id, preco",
);
const t = await db.query("insert into turmas (nome) values ('Turma Jan 2026') returning id");
const produtoId = p.rows[0].id;
const turmaId = t.rows[0].id;
console.log("✓ Produto e turma criados — preco:", p.rows[0].preco);

// Venda nova entra como pendente.
const v = await db.query(
  `insert into vendas (comprador_nome, comprador_telefone, comprador_email,
                       produto_id, turma_id, produto_nome, turma_nome, valor)
   values ('Maria Souza', '11999998888', 'maria@ex.com', $1, $2, 'Mentoria', 'Turma Jan 2026', 2500.00)
   returning id, status, valor`,
  [produtoId, turmaId],
);
const vendaId = v.rows[0].id;
console.log("✓ Venda criada — status:", v.rows[0].status, "| valor:", v.rows[0].valor);
if (v.rows[0].status !== "comprovante_nao_anexado") { console.error("✗ status inicial errado"); process.exit(1); }

// Anexar comprovante deve virar o status sozinho.
const a = await db.query(
  "update vendas set comprovante_path=$1, comprovante_nome=$2 where id=$3 returning status",
  [`${vendaId}/123.pdf`, "recibo.pdf", vendaId],
);
console.log("✓ Após anexar — status:", a.rows[0].status);
if (a.rows[0].status !== "comprovante_anexado") { console.error("✗ trigger não sincronizou"); process.exit(1); }

// Remover o arquivo deve voltar para pendente e limpar o nome.
const r = await db.query(
  "update vendas set comprovante_path=null where id=$1 returning status, comprovante_nome",
  [vendaId],
);
console.log("✓ Após remover — status:", r.rows[0].status, "| nome:", r.rows[0].comprovante_nome);
if (r.rows[0].status !== "comprovante_nao_anexado" || r.rows[0].comprovante_nome !== null) {
  console.error("✗ trigger não limpou"); process.exit(1);
}

// Tentar forjar o status na mão não pode furar a regra.
const f = await db.query(
  "update vendas set status='comprovante_anexado' where id=$1 returning status",
  [vendaId],
);
console.log("✓ Status forjado é corrigido pelo trigger →", f.rows[0].status);
if (f.rows[0].status !== "comprovante_nao_anexado") { console.error("✗ regra furada"); process.exit(1); }

// on delete restrict protege o histórico.
try {
  await db.query("delete from produtos where id=$1", [produtoId]);
  console.error("✗ produto com venda foi excluído — histórico desprotegido");
  process.exit(1);
} catch {
  console.log("✓ Excluir produto com venda vinculada é bloqueado pelo banco");
}
try {
  await db.query("delete from turmas where id=$1", [turmaId]);
  console.error("✗ turma com venda foi excluída");
  process.exit(1);
} catch {
  console.log("✓ Excluir turma com venda vinculada é bloqueado pelo banco");
}

// updated_at tem que se mexer sozinho.
const u1 = await db.query("select updated_at from vendas where id=$1", [vendaId]);
await new Promise((r) => setTimeout(r, 30));
await db.query("update vendas set comprador_nome='Maria S. Lima' where id=$1", [vendaId]);
const u2 = await db.query("select updated_at from vendas where id=$1", [vendaId]);
console.log("✓ updated_at avançou:", u2.rows[0].updated_at > u1.rows[0].updated_at);

// Restrições de valor.
for (const [rotulo, q] of [
  ["preço negativo", "insert into produtos (nome, preco) values ('X', -1)"],
  ["nome vazio", "insert into produtos (nome, preco) values ('   ', 10)"],
]) {
  try { await db.query(q); console.error(`✗ ${rotulo} foi aceito`); process.exit(1); }
  catch { console.log(`✓ Rejeitado: ${rotulo}`); }
}

// Um status inválido não é rejeitado: o trigger normaliza antes do CHECK ver.
// O que importa é que valor inválido nunca fica gravado.
const s2 = await db.query(
  "update vendas set status='qualquer' where id=$1 returning status",
  [vendaId],
);
console.log("✓ Status inválido é normalizado pelo trigger →", s2.rows[0].status);
if (!["comprovante_nao_anexado", "comprovante_anexado"].includes(s2.rows[0].status)) {
  console.error("✗ status inválido ficou gravado"); process.exit(1);
}

// O CHECK continua sendo a rede de segurança se o trigger for removido.
await db.exec("drop trigger vendas_sync_status on vendas");
try {
  await db.query("update vendas set status='qualquer' where id=$1", [vendaId]);
  console.error("✗ CHECK de status não segurou"); process.exit(1);
} catch { console.log("✓ Sem o trigger, o CHECK de status barra o valor inválido"); }

console.log("\nTodos os testes do schema passaram.");
await db.close();
