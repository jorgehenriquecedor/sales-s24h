import type { Venda } from "./types";
import { rotularMes } from "./filtros";

const CABECALHO = [
  "Nome completo",
  "Telefone",
  "E-mail",
  "Produto",
  "Turma",
  "Valor",
  "Status do comprovante",
  "Data da venda",
];

const DATA_BR = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "America/Sao_Paulo",
});

/** Escapa um campo: o valor inteiro entre aspas, aspas internas dobradas. */
function campo(valor: string): string {
  return `"${valor.replace(/"/g, '""')}"`;
}

/** Valor em pt-BR, para o Excel brasileiro reconhecer como número. */
export function valorBR(valor: number): string {
  return (Number.isFinite(valor) ? valor : 0).toFixed(2).replace(".", ",");
}

function linha(venda: Venda): string {
  return [
    venda.comprador_nome,
    venda.comprador_telefone,
    venda.comprador_email,
    venda.produto_nome,
    venda.turma_nome,
    valorBR(venda.valor),
    venda.status === "comprovante_anexado"
      ? "Comprovante anexado"
      : "Comprovante pendente",
    DATA_BR.format(new Date(venda.created_at)),
  ]
    .map((v) => campo(String(v)))
    .join(";");
}

/**
 * Relatório detalhado: uma linha por venda, mais uma linha de total no fim.
 * Separador ";" e BOM UTF-8 porque é o que o Excel em português abre certo
 * com dois cliques, sem passar pelo assistente de importação.
 */
export function gerarCsv(vendas: Venda[]): string {
  const ordenadas = [...vendas].sort((a, b) =>
    a.created_at.localeCompare(b.created_at),
  );

  const total = ordenadas.reduce((soma, v) => soma + v.valor, 0);

  const linhas = [
    CABECALHO.map(campo).join(";"),
    ...ordenadas.map(linha),
    "",
    [
      campo("TOTAL"),
      "",
      "",
      "",
      "",
      campo(valorBR(total)),
      campo(`${ordenadas.length} venda(s)`),
      "",
    ].join(";"),
  ];

  return `﻿${linhas.join("\r\n")}\r\n`;
}

export function nomeArquivoRelatorio(periodo: string, hoje = new Date()): string {
  const data = hoje.toISOString().slice(0, 10);
  const trecho =
    periodo === "tudo"
      ? "completo"
      : rotularMes(periodo)
          .toLowerCase()
          .normalize("NFD")
          .replace(/[̀-ͯ]/g, "")
          .replace(/\s+/g, "-");
  return `relatorio-vendas-${trecho}-${data}.csv`;
}
