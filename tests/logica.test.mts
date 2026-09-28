import assert from "node:assert/strict";
import { converterParaNumero, paraCampoValor, formatarMoeda } from "../src/lib/format.ts";
import { chaveMes, rotularMes, mesesDisponiveis, lerFiltros, lerStatusFiltro, montarQuery, montarQueryVendas, alternar, aplicarFiltros, totalizar } from "../src/lib/filtros.ts";
import type { Venda } from "../src/lib/types.ts";

let ok = 0;
const t = (nome: string, fn: () => void) => { fn(); console.log("✓", nome); ok++; };

/* ---------- entrada de valores em pt-BR ---------- */
t("aceita 2997,00", () => assert.equal(converterParaNumero("2997,00"), 2997));
t("aceita 1.234,56", () => assert.equal(converterParaNumero("1.234,56"), 1234.56));
t("aceita 1234.56", () => assert.equal(converterParaNumero("1234.56"), 1234.56));
t("aceita R$ 2.997,00", () => assert.equal(converterParaNumero("R$ 2.997,00"), 2997));
t("aceita 1,234.56 (formato en)", () => assert.equal(converterParaNumero("1,234.56"), 1234.56));
t("aceita inteiro", () => assert.equal(converterParaNumero("500"), 500));
t("aceita zero", () => assert.equal(converterParaNumero("0"), 0));
t("recusa vazio", () => assert.ok(Number.isNaN(converterParaNumero(""))));
t("recusa texto", () => assert.ok(Number.isNaN(converterParaNumero("abc"))));
t("recusa null", () => assert.ok(Number.isNaN(converterParaNumero(null))));
t("ida e volta do campo", () => assert.equal(converterParaNumero(paraCampoValor(1234.5)), 1234.5));
t("moeda em pt-BR", () => assert.match(formatarMoeda(2997), /2\.997,00/));

/* ---------- meses no fuso de São Paulo ---------- */
// 31/01 às 23h em São Paulo é 01/02 03:00 UTC: sem fuso, cairia em fevereiro.
t("mês respeita America/Sao_Paulo", () =>
  assert.equal(chaveMes("2026-02-01T02:30:00Z"), "2026-01"));
t("mês normal", () => assert.equal(chaveMes("2026-03-15T12:00:00Z"), "2026-03"));
t("rótulo do mês", () => assert.equal(rotularMes("2026-01"), "Janeiro 2026"));
t("meses ordenados do mais novo", () =>
  assert.deepEqual(
    mesesDisponiveis([
      { created_at: "2026-01-10T12:00:00Z" },
      { created_at: "2026-03-10T12:00:00Z" },
      { created_at: "2026-01-20T12:00:00Z" },
    ]),
    ["2026-03", "2026-01"],
  ));

/* ---------- leitura e escrita dos filtros na URL ---------- */
t("padrão é tudo", () => assert.deepEqual(lerFiltros({}), { periodo: "tudo", produtos: [], turmas: [] }));
t("período inválido vira tudo", () => assert.equal(lerFiltros({ periodo: "xx" }).periodo, "tudo"));
t("produto único vira lista", () => assert.deepEqual(lerFiltros({ produto: "a" }).produtos, ["a"]));
t("vários produtos", () => assert.deepEqual(lerFiltros({ produto: ["a", "b"] }).produtos, ["a", "b"]));
t("query preserva tudo", () =>
  assert.equal(
    montarQuery({ periodo: "2026-01", produtos: ["a", "b"], turmas: ["t1"] }),
    "?periodo=2026-01&produto=a&produto=b&turma=t1",
  ));
t("tudo sem filtro dá query vazia", () =>
  assert.equal(montarQuery({ periodo: "tudo", produtos: [], turmas: [] }), ""));
t("status inválido volta para todas", () =>
  assert.equal(lerStatusFiltro({ status: "outro" }), "todas"));
t("query de vendas combina status com os outros filtros", () => {
  const query = montarQueryVendas({ periodo: "2026-09", produtos: ["p1", "p2"], turmas: ["t1"] }, "pendentes");
  assert.equal(query, "?periodo=2026-09&produto=p1&produto=p2&turma=t1&status=pendentes");
  const params = Object.fromEntries(new URLSearchParams(query.slice(1)));
  assert.equal(lerStatusFiltro(params), "pendentes");
});
t("vendas sem filtros não geram query", () =>
  assert.equal(montarQueryVendas({ periodo: "tudo", produtos: [], turmas: [] }, "todas"), ""));
t("ida e volta da query", () => {
  const f = { periodo: "2026-02", produtos: ["p1"], turmas: ["t1", "t2"] };
  const sp = Object.fromEntries(
    [...new URLSearchParams(montarQuery(f).slice(1))].reduce((m, [k, v]) => {
      m.set(k, m.has(k) ? [...[m.get(k)!].flat(), v] : v);
      return m;
    }, new Map<string, string | string[]>()),
  );
  assert.deepEqual(lerFiltros(sp), f);
});
t("alternar adiciona e remove", () => {
  assert.deepEqual(alternar([], "a"), ["a"]);
  assert.deepEqual(alternar(["a"], "a"), []);
});

/* ---------- filtragem combinada ---------- */
const venda = (o: Partial<Venda>): Venda => ({
  id: o.id ?? "v",
  comprador_nome: "N",
  comprador_telefone: "",
  comprador_email: "",
  produto_id: o.produto_id ?? "p1",
  turma_id: o.turma_id ?? "t1",
  produto_nome: "P",
  turma_nome: "T",
  valor: o.valor ?? 100,
  valor_bruto: o.valor_bruto ?? o.valor ?? 100,
  desconto_tipo: o.desconto_tipo ?? "nenhum",
  desconto_valor: o.desconto_valor ?? 0,
  desconto_observacao: o.desconto_observacao ?? null,
  itens: o.itens ?? [{ produto_id: o.produto_id ?? "p1", produto_nome: "P", preco_unitario: o.valor ?? 100, ordem: 1 }],
  status: o.status ?? "comprovante_nao_anexado",
  pagamento_status: o.pagamento_status ?? "nao_monitorado",
  asaas_checkout_id: null,
  asaas_checkout_url: null,
  asaas_checkout_expira_em: null,
  asaas_pagamento_id: null,
  asaas_comprovante_url: null,
  comprovante_path: null,
  comprovante_nome: null,
  created_at: o.created_at ?? "2026-01-15T12:00:00Z",
});

const base = [
  venda({ id: "1", produto_id: "p1", turma_id: "t1", valor: 100, created_at: "2026-01-15T12:00:00Z" }),
  venda({ id: "2", produto_id: "p2", turma_id: "t1", valor: 200, created_at: "2026-01-20T12:00:00Z" }),
  venda({ id: "3", produto_id: "p1", turma_id: "t2", valor: 300, created_at: "2026-02-05T12:00:00Z", status: "comprovante_anexado" }),
];

t("tudo devolve tudo", () =>
  assert.equal(aplicarFiltros(base, { periodo: "tudo", produtos: [], turmas: [] }).length, 3));
t("filtra por mês", () =>
  assert.deepEqual(aplicarFiltros(base, { periodo: "2026-01", produtos: [], turmas: [] }).map(v => v.id), ["1", "2"]));
t("filtra por vários produtos", () =>
  assert.deepEqual(aplicarFiltros(base, { periodo: "tudo", produtos: ["p1", "p2"], turmas: [] }).map(v => v.id), ["1", "2", "3"]));
t("combina mês + produto + turma", () =>
  assert.deepEqual(aplicarFiltros(base, { periodo: "2026-01", produtos: ["p1"], turmas: ["t1"] }).map(v => v.id), ["1"]));
t("combinação sem resultado", () =>
  assert.equal(aplicarFiltros(base, { periodo: "2026-02", produtos: ["p2"], turmas: [] }).length, 0));
t("produto secundário também aparece no filtro", () => {
  const multi = venda({ id: "multi", produto_id: "p1", itens: [
    { produto_id: "p1", produto_nome: "P1", preco_unitario: 100, ordem: 1 },
    { produto_id: "p2", produto_nome: "P2", preco_unitario: 200, ordem: 2 },
  ] });
  assert.deepEqual(aplicarFiltros([multi], { periodo: "tudo", produtos: ["p2"], turmas: [] }).map(v => v.id), ["multi"]);
});

/* ---------- totais ---------- */
t("totaliza", () => {
  const r = totalizar(base);
  assert.equal(r.total, 600);
  assert.equal(r.quantidade, 3);
  assert.equal(r.ticketMedio, 200);
  assert.equal(r.pendentes, 2);
});
t("totaliza lista vazia sem dividir por zero", () => {
  const r = totalizar([]);
  assert.equal(r.total, 0);
  assert.equal(r.ticketMedio, 0);
});

console.log(`\n${ok} testes de lógica passaram.`);
