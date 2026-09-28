# Integração Asaas no Sales-S24H

## Ativação no Sandbox

1. Crie uma conta em [sandbox.asaas.com](https://sandbox.asaas.com/) e, como administrador, gere uma chave em **Integrações → Chaves de API**. Ela aparece apenas uma vez. Não a coloque no código ou em mensagens.
2. Na Vercel, configure `ASAAS_API_KEY` como **Secret** no ambiente Production. `ASAAS_AMBIENTE=sandbox`, `ASAAS_CALLBACK_BASE_URL=https://controle-vendas-s24h.vercel.app` e `SUPABASE_SERVICE_ROLE_KEY` já estão preparados no projeto.
3. Gere um token aleatório de pelo menos 32 caracteres, sem espaços, e configure o mesmo valor como **Secret** `ASAAS_WEBHOOK_TOKEN` na Vercel e como **Auth Token** do webhook no Asaas.
4. No Asaas Sandbox, crie um webhook para `https://controle-vendas-s24h.vercel.app/api/asaas/webhook`, API v3, envio sequencial, com os eventos `CHECKOUT_PAID`, `CHECKOUT_EXPIRED`, `CHECKOUT_CANCELED`, `PAYMENT_CONFIRMED` e `PAYMENT_RECEIVED`.
5. Faça um novo deploy da Vercel após adicionar as variáveis. Cadastre produto e uma venda de teste. Abra o checkout, simule o pagamento no Sandbox e verifique o status e o comprovante no painel.

O Supabase Auth deste projeto não aceita cadastro público. É necessário ter ao menos um usuário criado ou convidado no projeto Sales-S24H para entrar no painel e testar o fluxo.

## Comportamento

- Cada nova venda gera um Checkout único, com Pix e cartão, válido por 1440 minutos.
- O Asaas envia eventos para o servidor. O navegador não precisa permanecer aberto. O painel aberto consulta o banco a cada 30 segundos para mostrar alterações que já chegaram pelo webhook.
- Ao expirar, o registro da venda permanece. **Gerar checkout novamente** cria outra tentativa vinculada à mesma venda.
- Um evento de expiração de tentativa antiga não altera o status da tentativa atual.
- `CHECKOUT_PAID` aprova a venda. Eventos de cobrança complementam o comprovante. Se a URL do Asaas devolver PDF ou imagem, o arquivo é salvo no bucket privado da venda; quando devolver página HTML, a URL fica disponível no detalhe da venda.
- O token `asaas-access-token` é comparado antes de processar o webhook. IDs de eventos processados são guardados para idempotência.

## Produção

Depois de homologar o Sandbox, gere **outra** chave na conta Asaas de produção. Configure `ASAAS_AMBIENTE=producao`, substitua `ASAAS_API_KEY`, crie um webhook de produção com token próprio e execute novo deploy. Chaves, webhooks e pagamentos do Sandbox não são transferidos para produção.

Referências: [Checkout](https://docs.asaas.com/reference/criar-novo-checkout), [eventos de Checkout](https://docs.asaas.com/docs/eventos-para-checkout), [webhook de cobranças](https://docs.asaas.com/docs/webhook-para-cobrancas), [chaves de API](https://docs.asaas.com/docs/chaves-de-api).
