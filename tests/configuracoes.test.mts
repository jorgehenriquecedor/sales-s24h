import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { cifrar, decifrar } from "../src/lib/segredos.ts";
import { administrador } from "../src/lib/permissoes.ts";
import { chamarAsaasConfig, gravarWebhookAsaas, EVENTOS_ASAAS } from "../src/lib/asaas-webhook-config.ts";

const envAnterior = process.env.INTEGRACOES_CHAVE;
process.env.INTEGRACOES_CHAVE = "ab".repeat(32);
try {
  const cifrado = cifrar("credencial-secreta");
  assert.equal(decifrar(cifrado), "credencial-secreta");
  assert.notEqual(cifrado, cifrar("credencial-secreta"));
  assert.ok(!cifrado.includes("credencial-secreta"));
  const partes = cifrado.split(".");
  partes[1] = Buffer.alloc(16).toString("base64");
  assert.throws(() => decifrar(partes.join(".")));
  delete process.env.INTEGRACOES_CHAVE;
  assert.throws(() => cifrar("segredo"));
} finally {
  if (envAnterior === undefined) delete process.env.INTEGRACOES_CHAVE;
  else process.env.INTEGRACOES_CHAVE = envAnterior;
}
assert.equal(administrador(null), false);
assert.equal(administrador({ id: "usuario-da-equipe" }), false);
assert.equal(administrador({ id: process.env.PAINEL_ADMIN_ID || "3c3b6215-7203-4c92-9fbb-d5b9c33447f8" }), true);
console.log("✓ Credenciais cifradas, adulteração rejeitada e administração restrita");

const db = new PGlite();
await db.exec("create role anon; create role authenticated; create role service_role bypassrls;");
const sql = readFileSync(new URL("../supabase/migrations/20261001150000_configuracoes.sql", import.meta.url), "utf8");
await db.exec(sql); await db.exec(sql);
for (const role of ["anon", "authenticated"]) {
  await db.exec(`set role ${role}`);
  await assert.rejects(db.query("select segredo from public.integracoes"));
  await assert.rejects(db.query("update public.integracoes set ativa = true"));
  await db.exec("reset role");
}
await db.exec("set role service_role");
assert.equal((await db.query("select provedor from public.integracoes")).rows.length, 1);
await db.close();
console.log("✓ Banco bloqueia leitura e alteração de credenciais para anônimos e usuários do painel");

const originalFetch = globalThis.fetch;
const chamadas: { url: string; init?: RequestInit }[] = [];
try {
  globalThis.fetch = async (url, init) => { chamadas.push({ url: String(url), init }); return Response.json({ id: "wh_teste" }); };
  const dados = { ambiente: "sandbox" as const, chave: "chave-teste", token: "token-teste", origem: "https://painel.example", email: "teste@example.com" };
  await gravarWebhookAsaas(dados);
  assert.equal(chamadas[0].url, "https://api-sandbox.asaas.com/v3/webhooks");
  assert.equal(chamadas[0].init?.method, "POST");
  const body = JSON.parse(String(chamadas[0].init?.body));
  assert.deepEqual(body.events, EVENTOS_ASAAS);
  assert.equal(body.authToken, "token-teste");
  assert.equal(body.url, "https://painel.example/api/asaas/webhook");
  await gravarWebhookAsaas({ ...dados, ambiente: "producao", existente: { id: "wh_existente", url: body.url } });
  assert.equal(chamadas[1].url, "https://api.asaas.com/v3/webhooks/wh_existente");
  assert.equal(chamadas[1].init?.method, "PUT");
  globalThis.fetch = async () => Response.json({ errors: [{ description: "segredo-na-resposta" }] }, { status: 401 });
  await assert.rejects(chamarAsaasConfig("sandbox", "chave", "/webhooks"), (erro: Error) => erro.message.includes("recusada") && !erro.message.includes("segredo-na-resposta"));
  globalThis.fetch = async () => Response.json({});
  await assert.rejects(gravarWebhookAsaas(dados), /não retornou/);
} finally { globalThis.fetch = originalFetch; }
console.log("✓ Webhook usa ambiente, token e eventos corretos; falhas nunca retornam confirmação");
