/**
 * Roda todas as suítes em sequência. `npm test`.
 */
const suites = [
  ["Lógica de filtros, períodos e valores", "./logica.test.mts"],
  ["Exportação de relatório em PDF", "./pdf.test.mts"],
  ["Schema do banco (Postgres real via PGlite)", "./schema.test.mjs"],
  ["Migração e proteção do Checkout Asaas", "./asaas-schema.test.mjs"],
  ["Itens e descontos da venda", "./venda-itens.test.mjs"],
  ["Modos de venda e aprovação manual", "./modos-venda.test.mjs"],
  ["Cálculo e rateio do desconto", "./descontos.test.mts"],
];

for (const [titulo, arquivo] of suites) {
  console.log(`\n── ${titulo} ${"─".repeat(Math.max(0, 60 - titulo.length))}`);
  await import(arquivo);
}

console.log("\nTodas as suítes passaram.\n");
