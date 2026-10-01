import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function chave() {
  const valor = process.env.INTEGRACOES_CHAVE;
  if (valor && /^[a-f0-9]{64}$/i.test(valor)) return Buffer.from(valor, "hex");
  throw new Error("Armazenamento seguro de integrações indisponível.");
}
export function cifrar(valor: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", chave(), iv);
  const corpo = Buffer.concat([cipher.update(valor, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), corpo].map((v) => v.toString("base64")).join(".");
}
export function decifrar(valor: string) {
  const partes = valor.split(".").map((p) => Buffer.from(p, "base64"));
  if (partes.length !== 3) throw new Error("Configuração inválida.");
  const cipher = createDecipheriv("aes-256-gcm", chave(), partes[0]);
  cipher.setAuthTag(partes[1]);
  return Buffer.concat([cipher.update(partes[2]), cipher.final()]).toString("utf8");
}
