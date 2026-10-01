# Integração Asaas no Sales-S24H

## Ativação pelo painel

1. Crie uma conta em [sandbox.asaas.com](https://sandbox.asaas.com/) e, como administrador, gere uma chave em **Integrações → Chaves de API**. Ela aparece apenas uma vez. Não a coloque no código ou em mensagens.
2. Na conta administradora do painel, abra **Configurações → Integrações → Adicionar nova integração → Asaas**.
3. Escolha Sandbox ou Produção, informe a chave e o e-mail de avisos. O token do webhook é opcional: se vazio, o sistema gera um token seguro automaticamente.
4. Ao confirmar, o painel valida a chave, cadastra ou atualiza o webhook para `/api/asaas/webhook`, API v3, envio sequencial, com os eventos `CHECKOUT_PAID`, `CHECKOUT_EXPIRED`, `CHECKOUT_CANCELED`, `PAYMENT_CONFIRMED` e `PAYMENT_RECEIVED`. A confirmação só aparece após salvar a integração.
5. Em Sandbox, cadastre uma venda de teste e simule o pagamento para validar a confirmação e o comprovante. É necessário ter a chave real para testar a conexão completa. A configuração pelo painel não exige novo deploy.

### Preparação do servidor

Execute `supabase/migrations/20261001150000_configuracoes.sql`. A tabela `integracoes` é acessível apenas pelo serviço do servidor. As credenciais usam AES-256-GCM com `INTEGRACOES_CHAVE` (32 bytes aleatórios em hexadecimal, segredo exclusivo da Vercel). Preserve essa chave; trocá-la exige recifrar os dados existentes. `SUPABASE_SERVICE_ROLE_KEY` e `ASAAS_CALLBACK_BASE_URL` continuam no servidor. Variáveis Asaas legadas são usadas somente quando não existe integração ativa no banco.

`PAINEL_ADMIN_ID` pode definir o UUID do proprietário; o valor padrão é a conta proprietária do Sales-S24H. Páginas e ações administrativas verificam esse ID no servidor. Em **Configurações → Logins**, o proprietário cria usuários confirmados com senha gerada, exibida apenas na resposta da criação. Não há envio automático de e-mail. Os usuários adicionais acessam vendas, cadastros e relatórios, mas não Logins nem Integrações.

Logo oficial obtida de [asaas.com](https://www.asaas.com), recurso `https://cdn-boto.asaas.com/_next/static/media/header-logo.32m21jo32rre9.svg`, em 01/10/2026.

O Supabase Auth deste projeto não aceita cadastro público. É necessário ter ao menos um usuário criado ou convidado no projeto Sales-S24H para entrar no painel e testar o fluxo.

## Comportamento

- Na venda com Checkout, somente produtos e turma são obrigatórios no painel. Nome, e-mail e telefone são preenchidos pelo comprador no Asaas: a criação não envia `customer` nem `customerData`. Até a confirmação, a venda exibe **Aguardando dados do comprador**. Os eventos de pagamento consultam `/customers/{id}` e atualizam os dados da venda vinculada; o celular tem preferência sobre o telefone fixo. Se a consulta falhar, o evento não é marcado como processado e poderá ser reenviado. A migração `20261001180000_comprador_checkout.sql` aplica essas regras também no banco.
- Ao clicar em **Nova venda**, escolha **Com Checkout** ou **Sem Checkout**. Com a integração configurada, o primeiro modo gera um Checkout único, com Pix e cartão, válido por 1440 minutos. Sem a integração, apenas o modo manual fica disponível.
- No modo manual, a venda começa **Pendente** e passa a **Aprovada** ao anexar o comprovante. Se o comprovante for removido, volta a **Pendente**. Um anexo manual em venda com Checkout não confirma o pagamento Asaas.
- Uma venda pode conter até 20 produtos. O banco soma os preços cadastrados, aplica um desconto percentual ou fixo e guarda preços, valor bruto, desconto, observação e valor final. O valor não é aceito do formulário. O Checkout recebe os itens com o desconto rateado em centavos, de modo que sua soma corresponde ao valor final da venda.
- O Asaas envia eventos para o servidor. O navegador não precisa permanecer aberto. O painel aberto consulta o banco a cada 30 segundos para mostrar alterações que já chegaram pelo webhook.
- Ao expirar, o registro da venda permanece. **Gerar checkout novamente** cria outra tentativa vinculada à mesma venda.
- Um evento de expiração de tentativa antiga não altera o status da tentativa atual.
- `CHECKOUT_PAID` aprova a venda. Eventos de cobrança complementam o comprovante. Se a URL do Asaas devolver PDF ou imagem, o arquivo é salvo no bucket privado da venda; quando devolver página HTML, a URL fica disponível no detalhe da venda.
- O token `asaas-access-token` é comparado antes de processar o webhook. IDs de eventos processados são guardados para idempotência.

## Produção

Gere a chave na conta Asaas de produção e escolha **Produção** no formulário. Chaves, webhooks e pagamentos do Sandbox não são transferidos para produção. Se já houver checkouts vinculados no painel, a troca de conta ou ambiente é bloqueada e exige migração do histórico; a rotação de chave na mesma conta é permitida quando o webhook atual continua acessível.

Referências: [Checkout](https://docs.asaas.com/reference/criar-novo-checkout), [eventos de Checkout](https://docs.asaas.com/docs/eventos-para-checkout), [webhook de cobranças](https://docs.asaas.com/docs/webhook-para-cobrancas), [chaves de API](https://docs.asaas.com/docs/chaves-de-api).
