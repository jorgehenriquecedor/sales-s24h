# Controle de Vendas — Prova Oral Suporte 24h

Painel interno para registrar as vendas fechadas pelo link de pagamento do
Asaas, com o controle que o Asaas não dá: comprador, produto, turma, valor
negociado e comprovante de pagamento anexado.

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

No projeto criado, abra **SQL Editor → New query**, cole o conteúdo inteiro de
[`supabase/schema.sql`](supabase/schema.sql) e clique em **Run**.

Esse único script cria as tabelas `produtos`, `turmas` e `vendas`, os índices,
os triggers, as políticas de RLS e o bucket privado `comprovantes` com as
políticas de acesso. Ele é idempotente: rodar de novo não quebra nada e não
apaga dados.

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

As duas são públicas por natureza — quem protege os dados é o RLS, não o
segredo da chave. Nenhuma `service_role key` é usada neste projeto.

### 5. Rodar local

```bash
npm install
cp .env.example .env.local   # preencha as duas variáveis
npm run dev                  # http://localhost:3000
```

### 6. Publicar na Vercel

1. <https://vercel.com/new> → importe este repositório.
2. Em **Environment Variables**, adicione `NEXT_PUBLIC_SUPABASE_URL` e
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` (marque Production, Preview e Development).
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

`npm test` roda três suítes, sem precisar de rede nem de banco externo:

- **lógica** — leitura e escrita dos filtros na URL, agrupamento por mês no
  fuso de São Paulo, entrada de valores em pt-BR, totais e ticket médio;
- **PDF** — assinatura e tamanho A4 do arquivo, paginação, o bloco de total
  que nunca fica órfão, truncamento de nomes longos, resistência a emoji e
  caracteres fora do latim, nome do arquivo;
- **schema** — o `schema.sql` é executado em um Postgres de verdade (PGlite),
  conferindo os triggers, as restrições e a proteção do histórico.

---

## Decisões que valem saber

**Excluir produto ou turma não apaga histórico.** Um produto com vendas
registradas não pode ser excluído — nem pelo painel, nem pelo banco (a chave
estrangeira é `on delete restrict`). Para tirá-lo do formulário de novas vendas
sem mexer nos relatórios, use **Arquivar**: ele some do formulário, continua nos
filtros do dashboard e o histórico fica intacto. A mesma regra vale para turmas.

**O nome do produto e da turma fica congelado na venda.** Cada venda guarda
`produto_nome` e `turma_nome` como estavam no momento do registro. Renomear um
produto depois não reescreve o passado, e o relatório continua legível.

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
sempre com o recorte que está na tela, sem estado duplicado para dessincronizar.
O cabeçalho do PDF repete esse recorte por extenso, então o arquivo diz sozinho
o que está sendo mostrado.

**O relatório é um PDF paginado, não uma planilha.** Planilha de exportação é
ruim de ler e pior ainda de mandar para alguém. O PDF sai na paleta do painel:
faixa navy com a marca, fio vermelho de destaque, cabeçalho dizendo o recorte
(período, produtos e turmas), uma linha compacta por venda — comprador,
telefone, produto, turma e valor — e o total do recorte fechando o documento.

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
supabase/schema.sql      # provisionamento completo do banco
tests/                   # suítes de lógica, PDF e schema
```

---

## Sobre a logo

O arquivo original da logo não chegou junto com o briefing, então o símbolo em
`src/components/logo.tsx` é uma reconstrução vetorial a partir do painel de
referência. Para usar o arquivo oficial, coloque-o em `public/logo.svg` e troque
o `<svg>` do componente por:

```tsx
<img src="/logo.svg" alt="Prova Oral" className="h-8 w-8" />
```

Nada mais precisa mudar.
