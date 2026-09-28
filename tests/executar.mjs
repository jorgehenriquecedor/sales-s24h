/**
 * Roda todas as suítes em sequência. `npm test`.
 */
const suites = [
  ["Lógica de filtros, períodos e valores", "./logica.test.mts"],
  ["Exportação de relatório em PDF", "./pdf.test.mts"],
  ["Schema do banco (Postgres real via PGlite)", "./schema.test.mjs"],
  ["Migração e proteção do Checkout Asaas", "./asaas-schema.test.mjs"],
];

for (const [titulo, arquivo] of suites) {
  console.log(`\n── ${titulo} ${"─".repeat(Math.max(0, 60 - titulo.length))}`);
  await import(arquivo);
}

console.log("\nTodas as suítes passaram.\n");
