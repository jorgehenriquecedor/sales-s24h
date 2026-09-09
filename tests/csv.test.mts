import assert from "node:assert/strict";
import { gerarCsv, valorBR, nomeArquivoRelatorio } from "../src/lib/csv.ts";
import type { Venda } from "../src/lib/types.ts";

let ok = 0;
const t = (n: string, f: () => void) => { f(); console.log("✓", n); ok++; };

type Ajustes = {
  id?: string; nome?: string; tel?: string; email?: string;
  produto?: string; turma?: string; valor?: number;
  status?: Venda["status"]; data?: string;
};

const v = (o: Ajustes): Venda => ({
  id: o.id ?? "1",
  comprador_nome: o.nome ?? "Maria Souza",
  comprador_telefone: o.tel ?? "11999998888",
  comprador_email: o.email ?? "maria@ex.com",
  produto_id: "p",
  turma_id: "t",
  produto_nome: o.produto ?? "Mentoria",
  turma_nome: o.turma ?? "Turma Jan",
  valor: o.valor ?? 2997,
  status: o.status ?? "comprovante_nao_anexado",
  comprovante_path: null,
  comprovante_nome: null,
  created_at: o.data ?? "2026-01-15T12:00:00Z",
});

const csv = gerarCsv([v({}), v({ id: "2", nome: "João", valor: 1500, status: "comprovante_anexado", data: "2026-01-10T12:00:00Z" })]);
const linhas = csv.split("\r\n");

t("começa com BOM UTF-8", () => assert.equal(csv.charCodeAt(0), 0xfeff));
t("cabeçalho completo com as 8 colunas pedidas", () => {
  const cab = linhas[0].replace("﻿", "");
  assert.equal(cab.split(";").length, 8);
  for (const c of ["Nome completo","Telefone","E-mail","Produto","Turma","Valor","Status do comprovante","Data da venda"])
    assert.ok(cab.includes(c), `faltou coluna ${c}`);
});
t("uma linha por venda, em ordem cronológica", () => {
  assert.ok(linhas[1].includes("João"), "a venda mais antiga vem primeiro");
  assert.ok(linhas[2].includes("Maria Souza"));
});
t("valor em pt-BR", () => assert.ok(linhas[2].includes('"2997,00"')));
t("status legível", () => {
  assert.ok(linhas[1].includes("Comprovante anexado"));
  assert.ok(linhas[2].includes("Comprovante pendente"));
});
t("data em dd/mm/aaaa", () => assert.ok(linhas[2].includes("15/01/2026")));
t("linha de total ao final", () => {
  const total = linhas[linhas.length - 2];
  assert.ok(total.includes("TOTAL"));
  assert.ok(total.includes('"4497,00"'), "soma das duas vendas");
  assert.ok(total.includes("2 venda(s)"));
});
t("escapa aspas no nome", () => {
  const c = gerarCsv([v({ nome: 'Maria "Bibi" Souza' })]);
  assert.ok(c.includes('"Maria ""Bibi"" Souza"'));
});
t("escapa ponto e vírgula sem quebrar colunas", () => {
  const c = gerarCsv([v({ produto: "Curso A; Turma B" })]);
  const l = c.split("\r\n")[1];
  assert.equal(l.split('";"').length, 8, "continua com 8 campos");
});
t("lista vazia gera só cabeçalho e total zerado", () => {
  const c = gerarCsv([]);
  const ls = c.split("\r\n");
  assert.ok(ls[0].includes("Nome completo"));
  assert.ok(c.includes('"0,00"'));
  assert.ok(c.includes("0 venda(s)"));
});
t("valorBR arredonda centavos", () => {
  assert.equal(valorBR(1234.5), "1234,50");
  assert.equal(valorBR(0), "0,00");
  assert.equal(valorBR(NaN), "0,00");
});
t("nome do arquivo por período", () => {
  assert.equal(nomeArquivoRelatorio("tudo", new Date("2026-03-09T10:00:00Z")), "relatorio-vendas-completo-2026-03-09.csv");
  assert.equal(nomeArquivoRelatorio("2026-03", new Date("2026-03-09T10:00:00Z")), "relatorio-vendas-marco-2026-2026-03-09.csv");
});

console.log(`\n${ok} testes de CSV passaram.`);
