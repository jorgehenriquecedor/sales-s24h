import type { Venda } from "./types";

export type Filtros = {
  /** "tudo" ou "YYYY-MM" */
  periodo: string;
  produtos: string[];
  turmas: string[];
};

export type StatusFiltro = "todas" | "pendentes" | "expiradas" | "aprovadas";

export function lerStatusFiltro(params: ParametrosBrutos): StatusFiltro {
  const bruto = Array.isArray(params.status) ? params.status[0] : params.status;
  return bruto === "pendentes" || bruto === "expiradas" || bruto === "aprovadas"
    ? bruto
    : "todas";
}

export type ParametrosBrutos = Record<string, string | string[] | undefined>;

function paraLista(valor: string | string[] | undefined): string[] {
  if (!valor) return [];
  return (Array.isArray(valor) ? valor : [valor]).filter(Boolean);
}

const PERIODO_VALIDO = /^\d{4}-\d{2}$/;

export function lerFiltros(params: ParametrosBrutos): Filtros {
  const periodoBruto = Array.isArray(params.periodo)
    ? params.periodo[0]
    : params.periodo;

  return {
    periodo:
      periodoBruto && PERIODO_VALIDO.test(periodoBruto) ? periodoBruto : "tudo",
    produtos: paraLista(params.produto),
    turmas: paraLista(params.turma),
  };
}

/** Monta a query string preservando os filtros ativos. */
export function montarQuery(filtros: Filtros): string {
  const sp = new URLSearchParams();
  if (filtros.periodo !== "tudo") sp.set("periodo", filtros.periodo);
  for (const id of filtros.produtos) sp.append("produto", id);
  for (const id of filtros.turmas) sp.append("turma", id);
  const query = sp.toString();
  return query ? `?${query}` : "";
}

export function montarQueryVendas(filtros: Filtros, status: StatusFiltro): string {
  const sp = new URLSearchParams(montarQuery(filtros).slice(1));
  if (status !== "todas") sp.set("status", status);
  const query = sp.toString();
  return query ? `?${query}` : "";
}

export function href(base: string, filtros: Filtros): string {
  return `${base}${montarQuery(filtros)}`;
}

/** Alterna um id dentro de um filtro de múltipla escolha. */
export function alternar(lista: string[], id: string): string[] {
  return lista.includes(id)
    ? lista.filter((item) => item !== id)
    : [...lista, id];
}

export function temFiltroAtivo(filtros: Filtros): boolean {
  return (
    filtros.periodo !== "tudo" ||
    filtros.produtos.length > 0 ||
    filtros.turmas.length > 0
  );
}

/* ------------------------------------------------------------------ */
/* Períodos                                                            */
/* ------------------------------------------------------------------ */

const FUSO = "America/Sao_Paulo";

/**
 * Chave "YYYY-MM" da venda no fuso de São Paulo — e não em UTC, que jogaria
 * uma venda da noite do dia 31 para o mês seguinte.
 */
export function chaveMes(iso: string): string {
  const partes = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    timeZone: FUSO,
  }).format(new Date(iso));
  return partes.slice(0, 7);
}

const NOMES_MES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

export function rotularMes(chave: string): string {
  const [ano, mes] = chave.split("-");
  const indice = Number(mes) - 1;
  if (!NOMES_MES[indice]) return chave;
  return `${NOMES_MES[indice]} ${ano}`;
}

/** Meses presentes nos dados, do mais recente para o mais antigo. */
export function mesesDisponiveis(vendas: Pick<Venda, "created_at">[]): string[] {
  const chaves = new Set(vendas.map((v) => chaveMes(v.created_at)));
  return [...chaves].sort().reverse();
}

/* ------------------------------------------------------------------ */
/* Aplicação dos filtros                                               */
/* ------------------------------------------------------------------ */

export function aplicarFiltros(vendas: Venda[], filtros: Filtros): Venda[] {
  const produtos = new Set(filtros.produtos);
  const turmas = new Set(filtros.turmas);

  return vendas.filter((venda) => {
    if (filtros.periodo !== "tudo" && chaveMes(venda.created_at) !== filtros.periodo) {
      return false;
    }
    if (produtos.size > 0 && !(
      venda.itens?.some((item) => item.produto_id && produtos.has(item.produto_id)) ||
      (venda.produto_id && produtos.has(venda.produto_id))
    )) {
      return false;
    }
    if (turmas.size > 0 && !(venda.turma_id && turmas.has(venda.turma_id))) {
      return false;
    }
    return true;
  });
}

export function totalizar(vendas: Venda[]) {
  const total = vendas.reduce((soma, v) => soma + Number(v.valor), 0);
  const pendentes = vendas.filter(
    (v) => v.status === "comprovante_nao_anexado",
  ).length;

  return {
    total,
    quantidade: vendas.length,
    ticketMedio: vendas.length > 0 ? total / vendas.length : 0,
    pendentes,
  };
}
