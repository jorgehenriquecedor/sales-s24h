export type StatusVenda = "comprovante_nao_anexado" | "comprovante_anexado";
export type StatusPagamento = "nao_monitorado" | "pendente" | "expirada" | "aprovada";
export type ModoVenda = "manual" | "checkout";

export type Produto = {
  id: string;
  nome: string;
  preco: number;
  arquivado: boolean;
  created_at: string;
};

export type Turma = {
  id: string;
  nome: string;
  arquivado: boolean;
  created_at: string;
};

export type ItemVenda = {
  produto_id: string | null;
  produto_nome: string;
  preco_unitario: number;
  ordem: number;
};

export type Venda = {
  id: string;
  comprador_nome: string;
  comprador_telefone: string;
  comprador_email: string;
  produto_id: string | null;
  turma_id: string | null;
  produto_nome: string;
  turma_nome: string;
  valor: number;
  valor_bruto: number;
  desconto_tipo: "nenhum" | "percentual" | "fixo";
  desconto_valor: number;
  desconto_observacao: string | null;
  itens: ItemVenda[];
  status: StatusVenda;
  pagamento_status: StatusPagamento;
  modo_venda: ModoVenda;
  asaas_checkout_id: string | null;
  asaas_checkout_url: string | null;
  asaas_checkout_expira_em: string | null;
  asaas_pagamento_id: string | null;
  asaas_comprovante_url: string | null;
  comprovante_path: string | null;
  comprovante_nome: string | null;
  created_at: string;
};

/** Colunas selecionadas em toda consulta de venda. */
export const COLUNAS_VENDA =
  "id, comprador_nome, comprador_telefone, comprador_email, produto_id, turma_id, produto_nome, turma_nome, valor, valor_bruto, desconto_tipo, desconto_valor, desconto_observacao, itens:venda_itens(produto_id, produto_nome, preco_unitario, ordem), status, pagamento_status, modo_venda, asaas_checkout_id, asaas_checkout_url, asaas_checkout_expira_em, asaas_pagamento_id, asaas_comprovante_url, comprovante_path, comprovante_nome, created_at";
