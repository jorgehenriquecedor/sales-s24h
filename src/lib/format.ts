const MOEDA = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const DATA = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "America/Sao_Paulo",
});

const DATA_HORA = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});

export function formatarMoeda(valor: number) {
  return MOEDA.format(Number.isFinite(valor) ? valor : 0);
}

export function formatarData(iso: string) {
  return DATA.format(new Date(iso));
}

export function formatarDataHora(iso: string) {
  return DATA_HORA.format(new Date(iso));
}

/**
 * Aceita "1234,56", "1.234,56", "1234.56" e devolve número.
 * O usuário digita do jeito que estiver acostumado.
 */
export function converterParaNumero(entrada: FormDataEntryValue | null): number {
  if (entrada === null) return NaN;
  const bruto = String(entrada).trim();
  if (!bruto) return NaN;

  let limpo = bruto.replace(/[^\d.,-]/g, "");

  // Sem nenhum algarismo não há número: "abc" vira "" e Number("") seria 0,
  // gravando uma venda de R$ 0,00 em vez de acusar erro de digitação.
  if (!/\d/.test(limpo)) return NaN;

  const temVirgula = limpo.includes(",");
  const temPonto = limpo.includes(".");

  if (temVirgula && temPonto) {
    // O último separador que aparece é o decimal.
    limpo =
      limpo.lastIndexOf(",") > limpo.lastIndexOf(".")
        ? limpo.replace(/\./g, "").replace(",", ".")
        : limpo.replace(/,/g, "");
  } else if (temVirgula) {
    limpo = limpo.replace(",", ".");
  }

  const numero = Number(limpo);
  return Number.isFinite(numero) ? numero : NaN;
}

/** Formata número para preencher um input de texto em pt-BR. */
export function paraCampoValor(valor: number) {
  return Number.isFinite(valor) ? valor.toFixed(2).replace(".", ",") : "";
}
