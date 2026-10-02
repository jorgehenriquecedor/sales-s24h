import assert from 'node:assert/strict';
import { baixarComprovanteAsaas, localizarPdfRecibo } from '../src/lib/comprovante-asaas.ts';

const url = 'https://sandbox.asaas.com/comprovantes/teste';
const destino = 'https://sandbox.asaas.com/000/transactionReceipt/pdf/teste?x=1&y=2';
const html = '<a href="/000/transactionReceipt/pdf/teste?x=1&amp;y=2">Baixar PDF</a>';
assert.equal(localizarPdfRecibo(html, url), destino);
assert.equal(localizarPdfRecibo('<a href="https://outro.com/recibo.pdf">PDF</a>', url), null);
assert.equal(localizarPdfRecibo('<a href="https://usuario@asaas.com/recibo.pdf">PDF</a>', url), null);
const pdf = new TextEncoder().encode('%PDF-1.7\nconteudo original');
const pedidos = [];
const resultado = await baixarComprovanteAsaas(url, async (alvo, config) => {
  pedidos.push(alvo);
  assert.equal(config.redirect, 'manual');
  return alvo === url ? new Response(html, { headers: { 'content-type': 'text/html; charset=UTF-8' } })
    : new Response(pdf, { headers: { 'content-type': 'application/pdf; charset=utf-8' } });
});
assert.deepEqual(pedidos, [url, destino]);
assert.deepEqual(resultado.bytes, pdf);
assert.equal(resultado.extensao, 'pdf');
const direto = await baixarComprovanteAsaas(url, async () => new Response(pdf, { headers: { 'content-type': 'application/pdf' } }));
assert.deepEqual(direto.bytes, pdf);
await assert.rejects(baixarComprovanteAsaas(url, async () => new Response('html', { headers: { 'content-type': 'application/pdf' } })), /não é um comprovante válido/);
await assert.rejects(baixarComprovanteAsaas(url, async () => new Response('', { status: 503 })), /HTTP 503/);
await assert.rejects(baixarComprovanteAsaas(url, async () => new Response('sem download', { headers: { 'content-type': 'text/html' } })), /download/);
let chamadas = 0;
await assert.rejects(baixarComprovanteAsaas(url, async () => {
  chamadas++;
  return new Response(null, { status: 302, headers: { location: 'http://127.0.0.1/segredo' } });
}), /inválido/);
assert.equal(chamadas, 1);
await assert.rejects(baixarComprovanteAsaas(url, async () => new Response(pdf, {
  headers: { 'content-type': 'application/pdf', 'content-length': String(21 * 1024 * 1024) },
})), /tamanho permitido/);
console.log('✓ Comprovante oficial preservado, HTML resolvido para PDF e links externos/arquivos inválidos bloqueados');
