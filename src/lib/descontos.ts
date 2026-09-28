export type TipoDesconto = "nenhum" | "percentual" | "fixo";
export type ResultadoCalculo =
  | { ok: true; bruto: number; abatimento: number; final: number }
  | { ok: false; erro: string };

export function centavos(valor: number): number {
  return Math.round(valor * 100);
}

export function calcularTotal(
  precos: number[],
  tipo: TipoDesconto,
  desconto: number,
): ResultadoCalculo {
  if (precos.length < 1 || precos.length > 20) {
    return { ok: false, erro: "Selecione entre 1 e 20 produtos." };
  }
  const bruto = precos.reduce((soma, preco) => soma + centavos(preco), 0);
  if (precos.some((preco) => !Number.isFinite(preco) || centavos(preco) <= 0)) {
    return { ok: false, erro: "Todos os produtos precisam ter preço maior que zero." };
  }
  if (!Number.isFinite(desconto) || desconto < 0 ||
      Math.abs(Math.round(desconto * 100) - desconto * 100) > 1e-8) {
    return { ok: false, erro: "Informe um desconto válido, com até duas casas decimais." };
  }
  if (tipo === "percentual" && desconto > 100) {
    return { ok: false, erro: "O desconto percentual não pode passar de 100%." };
  }
  if (tipo !== "nenhum" && desconto <= 0) {
    return { ok: false, erro: "Informe um desconto maior que zero." };
  }
  const abatimento = tipo === "percentual"
    ? Math.round(bruto * desconto / 100)
    : tipo === "fixo" ? centavos(desconto) : 0;
  const final = bruto - abatimento;
  if (final < precos.length || final <= 0) {
    return { ok: false, erro: "O desconto deixa o valor abaixo do mínimo de R$ 0,01 por produto." };
  }
  return { ok: true, bruto: bruto / 100, abatimento: abatimento / 100, final: final / 100 };
}

/** Distribui o valor final pelos itens em centavos, preservando a soma exata. */
export function distribuirValor(precos: number[], totalFinal: number): number[] {
  const valores = precos.map(centavos);
  const final = centavos(totalFinal);
  if (valores.some((v) => v < 1) || final < valores.length ||
      final > valores.reduce((a, b) => a + b, 0)) {
    throw new Error("Valores incompatíveis com os itens do checkout.");
  }
  const pesos = valores.map((v) => v - 1);
  const pesoTotal = pesos.reduce((a, b) => a + b, 0);
  const restante = final - valores.length;
  const parcelas = pesos.map((peso) => pesoTotal ? restante * peso / pesoTotal : 0);
  const emCentavos = parcelas.map((parte) => 1 + Math.floor(parte));
  let sobra = final - emCentavos.reduce((a, b) => a + b, 0);
  const ordem = parcelas.map((parte, i) => ({ i, fracao: parte - Math.floor(parte) }))
    .sort((a, b) => b.fracao - a.fracao || a.i - b.i);
  for (const { i } of ordem) {
    if (sobra-- <= 0) break;
    emCentavos[i]++;
  }
  return emCentavos.map((v) => v / 100);
}
