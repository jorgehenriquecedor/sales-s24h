import "server-only";
import { distribuirValor } from "./descontos";
import { credenciaisAsaas } from "./integracoes";
import type { ClienteAsaas } from "./comprador-asaas";

export type DadosCheckout = {
  vendaId: string;
  turmaNome: string;
  valor: number;
  itens: { produtoId: string | null; nome: string; preco: number }[];
};

const BASES = {
  sandbox: "https://api-sandbox.asaas.com/v3",
  producao: "https://api.asaas.com/v3",
} as const;

async function configuracao() {
  const dados = await credenciaisAsaas();
  if (!dados) throw new Error("A integração Asaas ainda não foi configurada.");
  return { key: dados.key, base: BASES[dados.ambiente], ambiente: dados.ambiente, origem: dados.origem };
}

export async function asaasConfigurado() {
  return Boolean(await credenciaisAsaas());
}

export async function requisicaoAsaas<T>(
  caminho: string,
  init: RequestInit = {},
): Promise<T> {
  const { key, base } = await configuracao();
  const resposta = await fetch(`${base}${caminho}`, {
    ...init,
    headers: {
      accept: "application/json",
      access_token: key,
      "User-Agent": "Sales-S24H/1.0",
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...init.headers,
    },
    cache: "no-store",
    signal: init.signal ?? AbortSignal.timeout(15000),
  });
  if (!resposta.ok) {
    const corpo = await resposta.json().catch(() => null);
    const mensagem = Array.isArray(corpo?.errors)
      ? corpo.errors.map((erro: { description?: string }) => erro.description).join("; ")
      : `HTTP ${resposta.status}`;
    throw new Error(`Asaas: ${mensagem}`);
  }
  return resposta.json() as Promise<T>;
}

export async function criarCheckout(dados: DadosCheckout) {
  const { origem, ambiente } = await configuracao();
  if (!/^https:\/\//.test(origem)) {
    throw new Error("Configure ASAAS_CALLBACK_BASE_URL com a URL HTTPS do painel.");
  }
  const callback = (estado: string) =>
    `${origem.replace(/\/$/, "")}/pagamento?estado=${estado}`;
  const valores = distribuirValor(dados.itens.map((item) => item.preco), dados.valor);
  const checkout = await requisicaoAsaas<{ id: string; link?: string | null }>(
    "/checkouts",
    {
      method: "POST",
      body: JSON.stringify({
        billingTypes: ["PIX", "CREDIT_CARD"],
        chargeTypes: ["DETACHED"],
        minutesToExpire: 1440,
        externalReference: dados.vendaId,
        callback: {
          successUrl: callback("concluido"),
          cancelUrl: callback("cancelado"),
          expiredUrl: callback("expirado"),
        },
        items: dados.itens.map((item, index) => ({
          externalReference: item.produtoId ?? dados.vendaId,
          name: item.nome,
          description: dados.turmaNome || "Venda Sales-S24H",
          quantity: 1,
          value: valores[index],
        })),
      }),
    },
  );
  if (!checkout.id) throw new Error("O Asaas não retornou o ID do checkout.");
  return {
    id: checkout.id,
    url:
      checkout.link ||
      `https://${ambiente === "sandbox" ? "sandbox." : ""}asaas.com/checkoutSession/show?id=${encodeURIComponent(checkout.id)}`,
  };
}

export async function cancelarCheckout(id: string) {
  await requisicaoAsaas(`/checkouts/${encodeURIComponent(id)}/cancel`, {
    method: "POST",
  });
}

export type PagamentoAsaas = {
  id: string;
  customer?: string | null;
  status?: string;
  checkoutSession?: string | null;
  transactionReceiptUrl?: string | null;
};

export async function buscarCliente(id: string) {
  return requisicaoAsaas<ClienteAsaas>(`/customers/${encodeURIComponent(id)}`);
}

export async function buscarPagamento(checkoutId: string) {
  const resposta = await requisicaoAsaas<{ data: PagamentoAsaas[] }>(
    `/payments?checkoutSession=${encodeURIComponent(checkoutId)}&limit=10`,
  );
  return resposta.data?.find((p) =>
    ["CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH"].includes(p.status ?? ""),
  ) ?? null;
}
