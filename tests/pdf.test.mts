import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { PDFArray, PDFDict, PDFDocument, PDFHexString, PDFName, StandardFonts } from "pdf-lib";
import { gerarRelatorioPdf, linksRelatorio, nomeArquivoRelatorio, limparTexto, quebrarTexto } from "../src/lib/pdf.ts";
import { buscarVendas } from "../src/lib/filtros.ts";
import { urlReciboAsaasConfiavel } from "../src/lib/comprovante.ts";
import type { Venda } from "../src/lib/types.ts";

const v = (ajustes: Partial<Venda> = {}): Venda => ({
  id: "00000000-0000-4000-8000-000000000001",
  comprador_nome: "Pessoa de Exemplo", comprador_telefone: "(11) 90000-0000", comprador_email: "exemplo@example.com",
  produto_id: "p", turma_id: "t", produto_nome: "Curso Presencial + S24H (Suporte 24H)", turma_nome: "TJGO",
  itens: [{ produto_id: "p", produto_nome: "Curso Presencial", preco_unitario: 3990, ordem: 0 },
    { produto_id: "p2", produto_nome: "S24H (Suporte 24H)", preco_unitario: 2900, ordem: 1 }],
  valor: 6890, valor_bruto: 6890, desconto_tipo: "nenhum", desconto_valor: 0, desconto_observacao: null,
  status: "comprovante_anexado", pagamento_status: "aprovada", modo_venda: "manual",
  asaas_checkout_id: null, asaas_checkout_url: null, asaas_checkout_expira_em: null,
  asaas_pagamento_id: null, asaas_comprovante_url: null,
  comprovante_path: "venda/recibo.pdf", comprovante_nome: "recibo.pdf", created_at: "2026-09-15T12:00:00Z",
  ...ajustes,
});
const recorte = { periodo: "2026-09", produtos: [], turmas: [] };
const origem = "https://controle-vendas-s24h.vercel.app";
const gerar = (vendas: Venda[], filtros = recorte) => gerarRelatorioPdf(vendas, filtros, new Date("2026-10-01T15:00:00Z"), { origem });
const paginas = async (bytes: Uint8Array) => (await PDFDocument.load(bytes)).getPageCount();
let ok = 0;
async function teste(nome: string, funcao: () => void | Promise<void>) { await funcao(); console.log("✓", nome); ok++; }

const pdf = await gerar([v(), v({ id: "2", valor: 1500 })]);
await teste("PDF A4 com resumo e detalhes em páginas separadas", async () => {
  assert.equal(Buffer.from(pdf.slice(0, 5)).toString(), "%PDF-");
  const doc = await PDFDocument.load(pdf);
  assert.equal(doc.getPageCount(), 2);
  assert.equal(Math.round(doc.getPage(0).getWidth()), 595);
  assert.equal(Math.round(doc.getPage(0).getHeight()), 842);
});

await teste("anotações clicáveis apontam para cada venda e comprovante, sem URL temporária", async () => {
  const doc = await PDFDocument.load(pdf);
  const urls: string[] = [];
  for (const pagina of doc.getPages()) {
    const annots = pagina.node.Annots();
    for (let i = 0; annots && i < annots.size(); i++) {
      const annot = annots.lookup(i, PDFDict);
      assert.equal(annot.lookup(PDFName.of("Subtype"), PDFName).toString(), "/Link");
      const rect = annot.lookup(PDFName.of("Rect"), PDFArray).asArray().map((n) => Number(n.toString()));
      assert.ok(rect[0] >= 40 && rect[2] < 556 && rect[1] >= 65 && rect[3] <= 742);
      const action = annot.lookup(PDFName.of("A"), PDFDict);
      urls.push(action.lookup(PDFName.of("URI"), PDFHexString).decodeText());
    }
  }
  assert.deepEqual(urls, [
    `${origem}/vendas?venda=${v().id}`, `${origem}/vendas/${v().id}/comprovante`,
    `${origem}/vendas?venda=2`, `${origem}/vendas/2/comprovante`,
  ]);
  assert.ok(urls.every((url) => !url.includes("token=")));
});

await teste("sem arquivo e sem recibo não inventa link; recibo Asaas usa rota permanente", () => {
  assert.equal(linksRelatorio(v({ comprovante_path: null }), origem).comprovante, null);
  assert.equal(linksRelatorio(v({ comprovante_path: null, asaas_comprovante_url: "https://www.asaas.com/comprovantes/123" }), origem).comprovante,
    `${origem}/vendas/${v().id}/comprovante`);
  assert.equal(linksRelatorio(v()).venda, null);
  assert.throws(() => linksRelatorio(v(), "javascript:alert(1)"));
});
await teste("redirecionamento de recibos externos aceita apenas HTTPS do Asaas", () => {
  assert.ok(urlReciboAsaasConfiavel("https://www.asaas.com/comprovantes/123"));
  for (const url of [null, "javascript:alert(1)", "https://asaas.com.evil.example/recibo", "http://asaas.com/recibo", "https://usuario@asaas.com/recibo"]) {
    assert.equal(urlReciboAsaasConfiavel(url), false);
  }
});
await teste("busca do PDF e da lista inclui produtos individuais e dados do comprador", () => {
  const vendas = [v({ produto_nome: "Pacote", itens: [{ produto_id: "p", produto_nome: "Mentoria Especial", preco_unitario: 99, ordem: 0 }] }), v({ id: "2", comprador_nome: "Outro cliente", itens: [] })];
  assert.deepEqual(buscarVendas(vendas, " mentoria especial ").map((v) => v.id), [v().id]);
  assert.deepEqual(buscarVendas(vendas, "OUTRO CLIENTE").map((v) => v.id), ["2"]);
});
await teste("relatório vazio é válido e cabe em uma página", async () => {
  assert.equal(await paginas(await gerar([])), 1);
});
await teste("grandes volumes paginam resumo e todas as fichas", async () => {
  const vendas = Array.from({ length: 100 }, (_, i) => v({ id: String(i) }));
  const doc = await PDFDocument.load(await gerar(vendas));
  assert.ok(doc.getPageCount() > 2);
  assert.equal(doc.getPages().reduce((soma, pagina) => soma + (pagina.node.Annots()?.size() ?? 0), 0), 200);
});
await teste("textos extensos e produtos completos continuam em outras páginas", async () => {
  const doc = await PDFDocument.create();
  const fonte = await doc.embedFont(StandardFonts.Helvetica);
  const produto = "Curso Presencial + S24H (Suporte 24H)";
  assert.equal(quebrarTexto(produto, fonte, 9, 116).join(" "), produto);
  const bytes = await gerar([v({ comprador_nome: "Nome ".repeat(150), itens: [], produto_nome: produto.repeat(150) })]);
  assert.ok(await paginas(bytes) > 2);
});
await teste("acentos, emojis e espaços não impedem a exportação", async () => {
  assert.equal(limparTexto("João Conceição Ângela Ruíz Türk ÇÃO"), "João Conceição Ângela Ruíz Türk ÇÃO");
  assert.equal(limparTexto("Maria 🎉 中文\n\t Souza"), "Maria Souza");
  assert.equal(await paginas(await gerar([v({ comprador_nome: "Pessoa 🎉 中文", comprador_telefone: "" })])), 2);
});
await teste("nome do arquivo acompanha o período", () => {
  const data = new Date("2026-10-01T15:00:00Z");
  assert.equal(nomeArquivoRelatorio("tudo", data), "relatorio-vendas-completo-2026-10-01.pdf");
  assert.equal(nomeArquivoRelatorio("2026-03", data), "relatorio-vendas-marco-2026-2026-10-01.pdf");
});

if (process.env.PDF_PREVIEW_PATH) {
  const exemplos = [v(), v({ id: "2", comprador_nome: "Cliente Exemplo com Desconto", valor: 6201, desconto_tipo: "percentual", desconto_valor: 10, desconto_observacao: "Desconto combinado para matrícula em dois produtos." }),
    v({ id: "3", comprador_nome: "Cliente Exemplo Asaas", modo_venda: "checkout", comprovante_path: null, asaas_comprovante_url: "https://www.asaas.com/comprovantes/123", asaas_pagamento_id: "pay_exemplo" }),
    v({ id: "4", comprador_nome: "Cliente Exemplo sem Comprovante", comprovante_path: null })];
  await writeFile(process.env.PDF_PREVIEW_PATH, await gerar(exemplos));
}
console.log(`\n${ok} testes de PDF passaram.`);
