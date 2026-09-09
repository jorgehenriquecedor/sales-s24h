import "server-only";
import { createClient } from "@/lib/supabase/server";
import { COLUNAS_VENDA, type Produto, type Turma, type Venda } from "./types";

/**
 * PostgREST devolve `numeric` como número, mas coagir aqui deixa o resto do
 * app livre de checagens defensivas espalhadas.
 */
function comoNumero(valor: unknown): number {
  const n = typeof valor === "number" ? valor : Number(valor);
  return Number.isFinite(n) ? n : 0;
}

export async function listarProdutos(): Promise<Produto[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("produtos")
    .select("id, nome, preco, arquivado, created_at")
    .order("arquivado", { ascending: true })
    .order("nome", { ascending: true });

  if (error) throw new Error(`Erro ao carregar produtos: ${error.message}`);

  return (data ?? []).map((p) => ({ ...p, preco: comoNumero(p.preco) }));
}

export async function listarTurmas(): Promise<Turma[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("turmas")
    .select("id, nome, arquivado, created_at")
    .order("arquivado", { ascending: true })
    .order("nome", { ascending: true });

  if (error) throw new Error(`Erro ao carregar turmas: ${error.message}`);
  return data ?? [];
}

export async function listarVendas(): Promise<Venda[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vendas")
    .select(COLUNAS_VENDA)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Erro ao carregar vendas: ${error.message}`);

  return (data ?? []).map((v) => ({ ...v, valor: comoNumero(v.valor) }));
}

export async function buscarVenda(id: string): Promise<Venda | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vendas")
    .select(COLUNAS_VENDA)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Erro ao carregar a venda: ${error.message}`);
  if (!data) return null;

  return { ...data, valor: comoNumero(data.valor) };
}

/**
 * Quantas vendas apontam para cada produto e cada turma.
 * Alimenta a regra de proteção de histórico nas telas de cadastro.
 */
export async function contarVinculos(): Promise<{
  porProduto: Record<string, number>;
  porTurma: Record<string, number>;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vendas")
    .select("produto_id, turma_id");

  if (error) throw new Error(`Erro ao verificar vínculos: ${error.message}`);

  const porProduto: Record<string, number> = {};
  const porTurma: Record<string, number> = {};

  for (const linha of data ?? []) {
    if (linha.produto_id) {
      porProduto[linha.produto_id] = (porProduto[linha.produto_id] ?? 0) + 1;
    }
    if (linha.turma_id) {
      porTurma[linha.turma_id] = (porTurma[linha.turma_id] ?? 0) + 1;
    }
  }

  return { porProduto, porTurma };
}

/** URL temporária para abrir/baixar um comprovante do bucket privado. */
export async function urlComprovante(path: string): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from("comprovantes")
    .createSignedUrl(path, 60 * 10);

  if (error) return null;
  return data?.signedUrl ?? null;
}
