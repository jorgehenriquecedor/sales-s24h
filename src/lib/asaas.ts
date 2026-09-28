import "server-only";

export type DadosCheckout = {
  vendaId: string;
  produtoId: string | null;
  produtoNome: string;
  turmaNome: string;
  valor: number;
};

const BASES = {
  sandbox: "https://api-sandbox.asaas.com/v3",
  producao: "https://api.asaas.com/v3",
} as const;

function configuracao() {
  const key = process.env.ASAAS_API_KEY;
  if (!key) throw new Error("A chave ASAAS_API_KEY ainda não foi configurada.");
  const ambiente = process.env.ASAAS_AMBIENTE;
  if (ambiente !== "sandbox" && ambiente !== "producao") {
    throw new Error("Configure ASAAS_AMBIENTE como sandbox ou producao.");
  }
  return { key, base: BASES[ambiente], ambiente };
}

export function asaasConfigurado() {
  return Boolean(
    process.env.ASAAS_API_KEY &&
      process.env.SUPABASE_SERVICE_ROLE_KEY &&
      process.env.ASAAS_WEBHOOK_TOKEN &&
      (process.env.ASAAS_AMBIENTE === "sandbox" ||
        process.env.ASAAS_AMBIENTE === "producao"),
  );
}

export async function requisicaoAsaas<T>(
  caminho: string,
  init: RequestInit = {},
): Promise<T> {
  const { key, base } = configuracao();
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
  const origem = process.env.ASAAS_CALLBACK_BASE_URL;
  if (!origem || !/^https:\/\//.test(origem)) {
    throw new Error("Configure ASAAS_CALLBACK_BASE_URL com a URL HTTPS do painel.");
  }
  const callback = (estado: string) =>
    `${origem.replace(/\/$/, "")}/pagamento?estado=${estado}`;
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
        items: [
          {
            externalReference: dados.produtoId ?? dados.vendaId,
            name: dados.produtoNome,
            description: dados.turmaNome || "Venda Sales-S24H",
            quantity: 1,
            value: dados.valor,
          },
        ],
      }),
    },
  );
  if (!checkout.id) throw new Error("O Asaas não retornou o ID do checkout.");
  const { ambiente } = configuracao();
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
  status?: string;
  checkoutSession?: string | null;
  transactionReceiptUrl?: string | null;
};

export async function buscarPagamento(checkoutId: string) {
  const resposta = await requisicaoAsaas<{ data: PagamentoAsaas[] }>(
    `/payments?checkoutSession=${encodeURIComponent(checkoutId)}&limit=10`,
  );
  return resposta.data?.find((p) =>
    ["CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH"].includes(p.status ?? ""),
  ) ?? null;
}
