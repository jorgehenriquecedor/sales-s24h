"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { converterParaNumero } from "@/lib/format";

export type Resultado = { erro?: string; ok?: boolean };

function revalidarTudo() {
  revalidatePath("/", "layout");
}

function lerCampos(formData: FormData) {
  const nome = String(formData.get("nome") ?? "").trim();
  const preco = converterParaNumero(formData.get("preco"));
  return { nome, preco };
}

function validar(nome: string, preco: number): string | null {
  if (!nome) return "Informe o nome do produto.";
  if (!Number.isFinite(preco)) return "Informe um preço válido.";
  if (preco < 0) return "O preço não pode ser negativo.";
  return null;
}

export async function criarProduto(
  _anterior: Resultado,
  formData: FormData,
): Promise<Resultado> {
  const { nome, preco } = lerCampos(formData);
  const invalido = validar(nome, preco);
  if (invalido) return { erro: invalido };

  const supabase = await createClient();
  const { error } = await supabase.from("produtos").insert({ nome, preco });

  if (error) return { erro: `Não foi possível salvar: ${error.message}` };

  revalidarTudo();
  return { ok: true };
}

export async function atualizarProduto(
  _anterior: Resultado,
  formData: FormData,
): Promise<Resultado> {
  const id = String(formData.get("id") ?? "");
  const { nome, preco } = lerCampos(formData);

  if (!id) return { erro: "Produto não identificado." };
  const invalido = validar(nome, preco);
  if (invalido) return { erro: invalido };

  const supabase = await createClient();
  const { error } = await supabase
    .from("produtos")
    .update({ nome, preco })
    .eq("id", id);

  if (error) return { erro: `Não foi possível salvar: ${error.message}` };

  revalidarTudo();
  return { ok: true };
}

/**
 * Só apaga de verdade quando não há nenhuma venda apontando para o produto.
 * Com vendas vinculadas o caminho é arquivar: o histórico e os filtros do
 * dashboard continuam íntegros.
 */
export async function excluirProduto(
  _anterior: Resultado,
  formData: FormData,
): Promise<Resultado> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { erro: "Produto não identificado." };

  const supabase = await createClient();

  const { count, error: erroContagem } = await supabase
    .from("vendas")
    .select("id", { count: "exact", head: true })
    .eq("produto_id", id);

  if (erroContagem) {
    return { erro: `Não foi possível verificar as vendas: ${erroContagem.message}` };
  }

  if ((count ?? 0) > 0) {
    return {
      erro:
        `Este produto está em ${count} venda(s) registrada(s) e não pode ser ` +
        "excluído sem apagar histórico. Arquive-o para tirá-lo do formulário " +
        "de novas vendas mantendo os relatórios intactos.",
    };
  }

  const { error } = await supabase.from("produtos").delete().eq("id", id);
  if (error) return { erro: `Não foi possível excluir: ${error.message}` };

  revalidarTudo();
  return { ok: true };
}

export async function alternarArquivoProduto(
  _anterior: Resultado,
  formData: FormData,
): Promise<Resultado> {
  const id = String(formData.get("id") ?? "");
  const arquivar = String(formData.get("arquivar") ?? "") === "1";
  if (!id) return { erro: "Produto não identificado." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("produtos")
    .update({ arquivado: arquivar })
    .eq("id", id);

  if (error) return { erro: `Não foi possível atualizar: ${error.message}` };

  revalidarTudo();
  return { ok: true };
}
