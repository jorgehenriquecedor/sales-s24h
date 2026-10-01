export type AmbienteAsaas = "sandbox" | "producao";
export const EVENTOS_ASAAS = ["CHECKOUT_PAID", "CHECKOUT_EXPIRED", "CHECKOUT_CANCELED", "PAYMENT_CONFIRMED", "PAYMENT_RECEIVED"];

/** Corpos de erro da API podem incluir credenciais; nunca os expor na interface. */
export async function chamarAsaasConfig<T>(ambiente: AmbienteAsaas, chave: string, caminho: string, init: RequestInit = {}): Promise<T> {
  const base = ambiente === "sandbox" ? "https://api-sandbox.asaas.com/v3" : "https://api.asaas.com/v3";
  const resposta = await fetch(`${base}${caminho}`, {
    ...init,
    headers: { accept: "application/json", access_token: chave, "User-Agent": "Sales-S24H/1.0", ...(init.body ? { "content-type": "application/json" } : {}) },
    cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15000),
  });
  if (!resposta.ok) {
    if (resposta.status === 401 || resposta.status === 403) throw new Error("A chave foi recusada pelo Asaas. Confira o ambiente e as permissões da API.");
    if (resposta.status === 429) throw new Error("O Asaas limitou as tentativas. Aguarde e tente novamente.");
    throw new Error(`O Asaas não confirmou a configuração (HTTP ${resposta.status}). Confira a chave e o limite de webhooks da conta.`);
  }
  return resposta.json() as Promise<T>;
}
export type WebhookAsaas = { id: string; url: string; name?: string };
export async function gravarWebhookAsaas(dados: { ambiente: AmbienteAsaas; chave: string; token: string; origem: string; email: string; existente?: WebhookAsaas }) {
  const payload = { name: "Sales S24H", url: `${dados.origem}/api/asaas/webhook`, email: dados.email,
    enabled: true, interrupted: false, apiVersion: 3, authToken: dados.token,
    sendType: "SEQUENTIALLY", events: EVENTOS_ASAAS };
  const webhook = await chamarAsaasConfig<{ id: string }>(dados.ambiente, dados.chave,
    dados.existente ? `/webhooks/${encodeURIComponent(dados.existente.id)}` : "/webhooks",
    { method: dados.existente ? "PUT" : "POST", body: JSON.stringify(payload) });
  if (!webhook.id) throw new Error("O Asaas não retornou a confirmação do webhook. Tente novamente.");
  return webhook;
}
