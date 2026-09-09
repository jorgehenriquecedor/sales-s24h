export type StatusVenda = "comprovante_nao_anexado" | "comprovante_anexado";

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
  status: StatusVenda;
  comprovante_path: string | null;
  comprovante_nome: string | null;
  created_at: string;
};

/** Colunas selecionadas em toda consulta de venda. */
export const COLUNAS_VENDA =
  "id, comprador_nome, comprador_telefone, comprador_email, produto_id, turma_id, produto_nome, turma_nome, valor, status, comprovante_path, comprovante_nome, created_at";
