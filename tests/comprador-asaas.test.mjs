import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { dadosCompradorAsaas } from '../src/lib/comprador-asaas.ts';

assert.deepEqual(dadosCompradorAsaas({ id: 'cus_1', name: ' Aluna ', email: ' aluna@example.com ', phone: '11', mobilePhone: '22' }), {
  comprador_nome: 'Aluna', comprador_email: 'aluna@example.com', comprador_telefone: '22',
});
assert.equal(dadosCompradorAsaas({ id: 'cus_1', name: 'Aluna', phone: '11', mobilePhone: ' ' }).comprador_telefone, '11');
assert.throws(() => dadosCompradorAsaas({ id: 'cus_1', name: ' ' }));

// Executa o processador real com fronteiras de rede/banco controladas.
const tabelas = {
  vendas: [{ id: 'venda-1', modo_venda: 'checkout', pagamento_status: 'pendente', asaas_checkout_id: 'checkout-1', comprador_nome: 'Aguardando dados do comprador' }],
  asaas_checkouts: [{ id: 'checkout-1', venda_id: 'venda-1', status: 'pendente' }],
  asaas_eventos: [],
};
let clienteFalha = false;
let consultas = 0;
const uploads = [];
let falhaUpload = false;
const fetchOriginal = globalThis.fetch;
const pagamento = { id: 'pay_1', checkoutSession: 'checkout-1', customer: 'cus_1', status: 'CONFIRMED' };
const cliente = { id: 'cus_1', name: 'Aluna do Checkout', email: 'aluna@example.com', mobilePhone: '11999999999' };
globalThis.__checkoutTest = {
  buscarPagamento: async () => pagamento,
  buscarCliente: async (id) => {
    consultas++;
    assert.equal(id, 'cus_1');
    if (clienteFalha) throw new Error('Asaas temporariamente indisponível');
    return cliente;
  },
  adminClient: () => ({ storage: { from: () => ({ upload: async (path, bytes) => {
    if (falhaUpload) return { error: new Error('Storage indisponível') };
    uploads.push({ path, bytes });
    return { error: null };
  } }) }, from(tabela) {
    const filtros = [];
    let alteracoes;
    const query = {
      select() { return query; },
      eq(chave, valor) { filtros.push((r) => r[chave] === valor); return query; },
      neq(chave, valor) { filtros.push((r) => r[chave] !== valor); return query; },
      is(chave, valor) { filtros.push((r) => (r[chave] ?? null) === valor); return query; },
      update(dados) { alteracoes = dados; return query; },
      upsert(dados) { tabelas[tabela].push(dados); return query; },
      maybeSingle() { return query; },
      single() { return query; },
      then(resolve, reject) {
        return Promise.resolve().then(() => {
          const linhas = tabelas[tabela].filter((r) => filtros.every((f) => f(r)));
          if (alteracoes) for (const linha of linhas) Object.assign(linha, alteracoes);
          return { data: linhas[0] ?? null, error: null };
        }).then(resolve, reject);
      },
    };
    return query;
  } }),
};
const hook = registerHooks({ resolve(specifier, context, next) {
  let source;
  if (context.parentURL?.endsWith('/asaas-fluxo.ts')) {
    if (specifier === 'server-only') source = 'export {}';
    if (specifier === '@/lib/supabase/admin') source = 'export const adminClient = () => globalThis.__checkoutTest.adminClient();';
    if (specifier === './asaas') source = `
      export const buscarPagamento = (...a) => globalThis.__checkoutTest.buscarPagamento(...a);
      export const buscarCliente = (...a) => globalThis.__checkoutTest.buscarCliente(...a);
      export const cancelarCheckout = async () => {};
      export const criarCheckout = async () => { throw new Error('Não criar cobrança em teste'); };
    `;
  }
  return source !== undefined ? { url: 'data:text/javascript,' + encodeURIComponent(source), shortCircuit: true } : next(specifier, context);
} });
try {
  const { processarEventoAsaas, recuperarComprovanteAsaas } = await import('../src/lib/asaas-fluxo.ts');
  const evento = { id: 'evt_1', event: 'CHECKOUT_PAID', checkout: { id: 'checkout-1', customer: 'cus_1' } };
  clienteFalha = true;
  await assert.rejects(processarEventoAsaas(evento), /temporariamente indisponível/);
  assert.equal(tabelas.asaas_eventos.length, 0);
  assert.equal(tabelas.vendas[0].pagamento_status, 'pendente');
  clienteFalha = false;
  await processarEventoAsaas(evento);
  assert.equal(tabelas.vendas[0].comprador_nome, cliente.name);
  assert.equal(tabelas.vendas[0].comprador_email, cliente.email);
  assert.equal(tabelas.vendas[0].comprador_telefone, cliente.mobilePhone);
  assert.equal(tabelas.vendas[0].pagamento_status, 'aprovada');
  const antes = consultas;
  await processarEventoAsaas(evento);
  assert.equal(consultas, antes);
  cliente.name = 'Nome atualizado no Asaas';
  await processarEventoAsaas({ id: 'evt_2', event: 'PAYMENT_RECEIVED', payment: pagamento });
  assert.equal(tabelas.vendas[0].comprador_nome, cliente.name);
  assert.equal(tabelas.vendas[0].asaas_pagamento_id, pagamento.id);
  globalThis.__checkoutTest.buscarPagamento = async () => null;
  await processarEventoAsaas({ ...evento, id: 'evt_3' });
  assert.equal(tabelas.asaas_eventos.length, 3);
  pagamento.transactionReceiptUrl = 'https://sandbox.asaas.com/comprovantes/teste';
  globalThis.fetch = async (url) => url.includes('/pdf/')
    ? new Response('%PDF-1.7 original', { headers: { 'content-type': 'application/pdf' } })
    : new Response('<a href="/transactionReceipt/pdf/teste">PDF</a>', { headers: { 'content-type': 'text/html' } });
  const comRecibo = { id: 'evt_recibo', event: 'PAYMENT_RECEIVED', payment: pagamento };
  falhaUpload = true;
  await assert.rejects(processarEventoAsaas(comRecibo), /Storage indisponível/);
  assert.ok(!tabelas.asaas_eventos.some((e) => e.id === comRecibo.id));
  falhaUpload = false;
  await processarEventoAsaas(comRecibo);
  assert.equal(uploads.length, 1);
  assert.equal(tabelas.vendas[0].comprovante_path, 'venda-1/asaas-pay_1.pdf');
  await processarEventoAsaas(comRecibo);
  assert.equal(uploads.length, 1);
  tabelas.vendas[0].comprovante_path = null;
  await recuperarComprovanteAsaas('venda-1');
  assert.equal(uploads.length, 2);
  assert.equal(tabelas.vendas[0].comprovante_nome, 'Comprovante Asaas.pdf');
  console.log('✓ Webhook anexa PDF oficial, repete após falha no Storage e recupera venda já aprovada');
  await processarEventoAsaas({ id: 'evt_4', event: 'PAYMENT_RECEIVED', payment: { id: 'desconhecido', customer: 'cus_outro' } });
  assert.equal(tabelas.asaas_eventos.length, 4);
  console.log('✓ Webhook importa comprador, repete após falha, ignora duplicatas e cobra vínculo com a venda');
} finally {
  globalThis.fetch = fetchOriginal;
  hook.deregister();
  delete globalThis.__checkoutTest;
}
