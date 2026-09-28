import assert from "node:assert/strict";
import { calcularTotal, distribuirValor } from "../src/lib/descontos.ts";

assert.deepEqual(calcularTotal([100, 50], "nenhum", 0), {
  ok: true, bruto: 150, abatimento: 0, final: 150,
});
assert.deepEqual(calcularTotal([100, 50], "percentual", 10), {
  ok: true, bruto: 150, abatimento: 15, final: 135,
});
assert.deepEqual(calcularTotal([100, 50], "fixo", 20), {
  ok: true, bruto: 150, abatimento: 20, final: 130,
});
assert.equal(calcularTotal([100, 50], "fixo", 150).ok, false);
assert.equal(calcularTotal([100, 50], "percentual", 101).ok, false);
assert.equal(calcularTotal([100, 50], "fixo", 0).ok, false);
console.log("✓ Soma, desconto percentual e fixo respeitam limites");

const rateio = distribuirValor([100, 50], 130);
assert.equal(Math.round(rateio.reduce((a, b) => a + b, 0) * 100), 13000);
assert(rateio.every((v) => v > 0));
assert.deepEqual(distribuirValor([0.02, 0.01], 0.02), [0.01, 0.01]);
assert.deepEqual(distribuirValor([100, 50], 150), [100, 50]);
console.log("✓ Itens do Asaas somam exatamente o valor final, até em centavos");
