# Controle de Vendas — Prova Oral Suporte 24h

Painel interno para registrar vendas de um ou mais produtos, aplicar descontos
com valor calculado no banco e acompanhar Checkout e comprovante do Asaas.

Cinco telas: **Início** (dashboard com filtros e exportação), **Vendas**,
**Produtos**, **Turmas** e **login**.

---

## Stack

| Camada | Escolha |
| --- | --- |
| Framework | Next.js 16 (App Router, Server Components e Server Actions) |
| Estilo | Tailwind CSS v4 |
| Banco | Supabase (Postgres) com Row Level Security |
| Arquivos | Supabase Storage — bucket **privado** `comprovantes` |
| Autenticação | Supabase Auth (e-mail + senha), sem cadastro público |
| Deploy | Vercel |

Nada é guardado em `localStorage` nem em memória do servidor: toda leitura e
escrita vai para o Postgres do Supabase, e o painel roda bem em ambiente
serverless.

---

## Como colocar no ar

### 1. Criar o projeto no Supabase

Em <https://supabase.com/dashboard>, **New project**. Guarde a senha do banco.

### 2. Criar as tabelas, as políticas e o bucket

No projeto criado, abra **SQL Editor → New query** e execute, nesta ordem,
[`supabase/schema.sql`](supabase/schema.sql),
[`20260928150000_asaas_checkout.sql`](supabase/migrations/20260928150000_asaas_checkout.sql)
[`20260928170000_venda_multiplos_produtos.sql`](supabase/migrations/20260928170000_venda_multiplos_produtos.sql)
e [`20260928190000_modos_venda.sql`](supabase/migrations/20260928190000_modos_venda.sql).
Esses scripts criam as tabelas, políticas, funções de venda, histórico de
checkouts e bucket privado de comprovantes. São idempotentes.

### 3. Criar o usuário de acesso

**Authentication → Users → Add user → Create new user**. Preencha e-mail e
senha e marque **Auto Confirm User**.

Como o painel é de uso próprio, não existe tela de cadastro: novos acessos são
criados aqui, à mão.

> Em **Authentication → Sign In / Providers**, deixe *Allow new users to sign up*
> desligado. Assim ninguém cria conta sozinho.

### 4. Pegar as variáveis de ambiente

Em **Project Settings → API**:

| Variável | Onde fica |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon / public key |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role; segredo exclusivo do servidor para webhooks |

As duas variáveis `NEXT_PUBLIC_` são públicas por natureza; quem protege os
dados é o RLS. A chave `service_role` nunca deve ser enviada ao navegador.
Para ativar o Checkout, configure também `ASAAS_API_KEY`,
`ASAAS_WEBHOOK_TOKEN`, `ASAAS_AMBIENTE` e `ASAAS_CALLBACK_BASE_URL` conforme
[`docs/integracao-asaas.md`](docs/integracao-asaas.md).

### 5. Rodar local

```bash
npm install
cp .env.example .env.local   # preencha as duas variáveis
npm run dev                  # http://localhost:3000
```

### 6. Publicar na Vercel

1. <https://vercel.com/new> → importe este repositório.
2. Em **Environment Variables**, adicione as variáveis da seção anterior para
   os ambientes desejados. Marque as chaves de serviço e do Asaas como segredo.
3. **Deploy**.

Se o painel abrir na tela “Configuração pendente”, as variáveis não chegaram ao
ambiente — confira o passo 2 e refaça o deploy.

---

## Comandos

```bash
npm run dev        # desenvolvimento
npm run build      # build de produção
npm start          # sobe o build
npm run lint       # ESLint
npm run typecheck  # TypeScript
npm test           # suíte de testes (ver abaixo)
```

`npm test` roda as suítes sem precisar de rede nem de banco externo:

- **lógica** — leitura e escrita dos filtros na URL, agrupamento por mês no
  fuso de São Paulo, entrada de valores em pt-BR, totais e ticket médio;
- **PDF** — assinatura e tamanho A4 do arquivo, paginação, o bloco de total
  que nunca fica órfão, produtos completos em várias linhas, resistência a emoji e
  caracteres fora do latim, nome do arquivo;
- **schema** — o `schema.sql` é executado em um Postgres de verdade (PGlite),
  conferindo os triggers, as restrições e a proteção do histórico.
- **itens e descontos** — as migrações e funções do banco são executadas em
  PGlite; testam preços somados, desconto, permissões e vendas antigas.
- **modos de venda** — testa a aprovação manual pelo comprovante, a reversão
  quando ele é removido e a separação da confirmação do Asaas.
- **rateio** — confere que os itens enviados ao Asaas somam exatamente o
  valor final da venda, inclusive após arredondamento em centavos.

---

## Decisões que valem saber

**Excluir produto ou turma não apaga histórico.** Um produto com vendas
registradas não pode ser excluído — nem pelo painel, nem pelo banco (a chave
estrangeira é `on delete restrict`). Para tirá-lo do formulário de novas vendas
sem mexer nos relatórios, use **Arquivar**: ele some do formulário, continua nos
filtros do dashboard e o histórico fica intacto. A mesma regra vale para turmas.

**Os produtos e preços ficam congelados na venda.** Cada item guarda o nome e
preço do momento do registro. O formulário soma os preços automaticamente e
permite desconto em percentual ou reais, com observação opcional. O banco
calcula e grava o valor final; editar o HTML não altera esse valor. A turma
também fica congelada no registro.

**O modo é escolhido antes de registrar.** Em **Com Checkout**, o Asaas gera o
link, e o webhook aprova a venda após o pagamento, mesmo horas depois. Uma
venda expirada pode receber outro checkout no mesmo registro. Em **Sem
Checkout**, a venda fica pendente e é aprovada quando o comprovante é anexado
manualmente. Remover o comprovante devolve a venda ao estado pendente. Sem a
chave do Asaas, só o modo manual fica disponível.

**O status do comprovante é garantido pelo banco.** Um trigger mantém a regra
`status = 'comprovante_anexado'` se, e somente se, existe arquivo anexado. Não
dá para o status ficar dessincronizado do arquivo, nem por bug de tela nem por
edição manual no banco.

**O comprovante sobe do navegador direto para o Storage.** A Vercel limita o
corpo de uma requisição a cerca de 4,5 MB; um PDF ou uma foto de celular passa
disso com facilidade. O arquivo vai do navegador para o Supabase, e só o caminho
resultante passa pelo servidor.

**O bucket é privado.** Ver ou baixar um comprovante passa pela rota
`/vendas/[id]/comprovante`, que confere a sessão e devolve uma URL assinada
válida por 10 minutos. Nenhum arquivo fica acessível por URL pública.

**Os filtros do dashboard moram na URL.** Período, produtos e turmas viram
parâmetros (`?periodo=2026-01&produto=…&turma=…`). Por isso o botão de exportar
é só um link para `/api/relatorio` com os mesmos parâmetros — o relatório sai
com as vendas aprovadas do recorte, sem estado duplicado para dessincronizar.
O cabeçalho do PDF repete esse recorte por extenso, então o arquivo diz sozinho
o que está sendo mostrado.

**O relatório é um PDF paginado, não uma planilha.** Planilha de exportação é
ruim de ler e pior ainda de mandar para alguém. O PDF sai na paleta do painel:
faixa navy com a marca, fio vermelho de destaque, cabeçalho dizendo o recorte
(período, produtos e turmas), uma linha por venda que cresce para mostrar todos
os produtos — comprador, telefone, produto, turma e valor — e o total do
recorte fechando o documento.

Ele é montado com `pdf-lib` usando as fontes padrão do PDF. O WinAnsi já cobre
todo o português, então nenhum arquivo de fonte precisa ser embutido: a
exportação não depende de asset em disco no ambiente serverless, e um relatório
de 42 vendas sai com menos de 10 KB. O que a fonte não representa (emoji, por
exemplo) é descartado do texto em vez de derrubar a exportação inteira.

---

## Estrutura

```
src/
  app/
    (painel)/            # área autenticada
      page.tsx           # dashboard: filtros, métricas, tabela e exportação
      vendas/            # listagem, formulário, detalhes e comprovante
      produtos/
      turmas/
    api/relatorio/       # exportação PDF respeitando os filtros
    login/
  actions/               # Server Actions (escrita)
  components/            # sidebar, cards, modal, ícones, UI base
  lib/
    supabase/            # clientes de servidor, navegador e middleware
    filtros.ts           # períodos e filtros combináveis
    pdf.ts               # geração do relatório em PDF
    dados.ts             # leitura
supabase/schema.sql      # base do banco
supabase/migrations/     # Checkout, itens, descontos e modos de venda
tests/                   # suítes de lógica, PDF, banco e rateio
```

---

## Sobre a logo

A marca oficial está em `public/logo.png`. O componente `src/components/logo.tsx`
a usa no painel e na página de acesso; o relatório em PDF usa o mesmo arquivo.
