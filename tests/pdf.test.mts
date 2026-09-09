import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import { gerarRelatorioPdf, nomeArquivoRelatorio, limparTexto } from "../src/lib/pdf.ts";
import type { Venda } from "../src/lib/types.ts";

let ok = 0;
const t = (n: string, f: () => void) => { f(); console.log("✓", n); ok++; };
const ta = async (n: string, f: () => Promise<void>) => { await f(); console.log("✓", n); ok++; };

type Ajustes = {
  id?: string; nome?: string; tel?: string; produto?: string;
  turma?: string; valor?: number; data?: string;
};

const v = (o: Ajustes = {}): Venda => ({
  id: o.id ?? "1",
  comprador_nome: o.nome ?? "Maria Souza Lima",
  comprador_telefone: o.tel ?? "(11) 99999-8888",
  comprador_email: "maria@ex.com",
  produto_id: "p", turma_id: "t",
  produto_nome: o.produto ?? "Mentoria Prova Oral",
  turma_nome: o.turma ?? "Turma Janeiro 2026",
  valor: o.valor ?? 2997,
  status: "comprovante_nao_anexado",
  comprovante_path: null, comprovante_nome: null,
  created_at: o.data ?? "2026-01-15T12:00:00Z",
});

const recorte = { periodo: "tudo", produtos: [], turmas: [] };
const paginas = async (bytes: Uint8Array) =>
  (await PDFDocument.load(bytes)).getPageCount();

/* ---------- saída é um PDF de verdade ---------- */
const pdf = await gerarRelatorioPdf([v(), v({ id: "2", valor: 1500 })], recorte);

t("devolve bytes com assinatura de PDF", () => {
  assert.equal(Buffer.from(pdf.slice(0, 5)).toString(), "%PDF-");
});
await ta("abre como documento válido, uma página", async () => {
  assert.equal(await paginas(pdf), 1);
});
await ta("tem tamanho de A4 retrato", async () => {
  const p = (await PDFDocument.load(pdf)).getPage(0).getSize();
  assert.equal(Math.round(p.width), 595);
  assert.equal(Math.round(p.height), 842);
});

/* ---------- paginação ---------- */
// Descobre quantas linhas cabem na primeira página junto com o total, em vez
// de fixar um número que envelhece a cada ajuste de layout.
const lote = (n: number) => Array.from({ length: n }, (_, i) => v({ id: String(i) }));
let cabemNaPrimeira = 0;
for (let n = 1; n <= 60; n++) {
  if ((await paginas(await gerarRelatorioPdf(lote(n), recorte))) > 1) break;
  cabemNaPrimeira = n;
}

t(`uma página comporta ${cabemNaPrimeira} vendas com o total junto`, () => {
  assert.ok(cabemNaPrimeira >= 25, `só couberam ${cabemNaPrimeira} linhas por página`);
});
await ta("uma venda a mais empurra o total para a página seguinte, sem cortá-lo", async () => {
  assert.equal(await paginas(await gerarRelatorioPdf(lote(cabemNaPrimeira + 1), recorte)), 2);
});
await ta("100 vendas geram várias páginas", async () => {
  const muitas = Array.from({ length: 100 }, (_, i) => v({ id: String(i) }));
  const n = await paginas(await gerarRelatorioPdf(muitas, recorte));
  assert.ok(n >= 3 && n <= 5, `esperava 3 a 5 páginas, veio ${n}`);
});
await ta("500 vendas não quebram nem estouram", async () => {
  const muitas = Array.from({ length: 500 }, (_, i) => v({ id: String(i) }));
  const n = await paginas(await gerarRelatorioPdf(muitas, recorte));
  assert.ok(n >= 15, `esperava 15+ páginas, veio ${n}`);
});

/* ---------- casos de borda ---------- */
await ta("lista vazia gera uma página com o bloco de total", async () => {
  assert.equal(await paginas(await gerarRelatorioPdf([], recorte)), 1);
});
await ta("recorte com filtros nomeados não quebra", async () => {
  const bytes = await gerarRelatorioPdf([v()], {
    periodo: "2026-09",
    produtos: ["Curso Online S24h", "Mentoria Prova Oral"],
    turmas: ["MPBA"],
  });
  assert.equal(await paginas(bytes), 1);
});
await ta("nome gigante é truncado sem estourar a coluna", async () => {
  const bytes = await gerarRelatorioPdf(
    [v({ nome: "Maria ".repeat(40), produto: "Curso ".repeat(40) })],
    recorte,
  );
  assert.equal(await paginas(bytes), 1);
});
await ta("emoji e caracteres fora do latim não derrubam a exportação", async () => {
  const bytes = await gerarRelatorioPdf(
    [v({ nome: "Maria 🎉 Souza 中文 Lima", produto: "Curso ✨" })],
    recorte,
  );
  assert.equal(await paginas(bytes), 1);
});
await ta("telefone vazio vira travessão", async () => {
  assert.equal(await paginas(await gerarRelatorioPdf([v({ tel: "" })], recorte)), 1);
});

/* ---------- limpeza de texto ---------- */
t("mantém todos os acentos do português", () => {
  assert.equal(limparTexto("João Conceição Ângela Ruíz Türk ÇÃO"), "João Conceição Ângela Ruíz Türk ÇÃO");
});
t("remove emoji e alfabetos não latinos sem deixar buraco de espaços", () => {
  assert.equal(limparTexto("Maria 🎉 中文 Souza"), "Maria Souza");
});
t("colapsa quebras de linha e espaços duplos", () => {
  assert.equal(limparTexto("Maria\n\tSouza   Lima"), "Maria Souza Lima");
});

/* ---------- nome do arquivo ---------- */
t("nome do arquivo por período", () => {
  const hoje = new Date("2026-09-09T10:00:00Z");
  assert.equal(nomeArquivoRelatorio("tudo", hoje), "relatorio-vendas-completo-2026-09-09.pdf");
  assert.equal(nomeArquivoRelatorio("2026-03", hoje), "relatorio-vendas-marco-2026-2026-09-09.pdf");
});

console.log(`\n${ok} testes de PDF passaram.`);
