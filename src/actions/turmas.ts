"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Resultado } from "./produtos";

function revalidarTudo() {
  revalidatePath("/", "layout");
}

export async function criarTurma(
  _anterior: Resultado,
  formData: FormData,
): Promise<Resultado> {
  const nome = String(formData.get("nome") ?? "").trim();
  if (!nome) return { erro: "Informe o nome da turma." };

  const supabase = await createClient();
  const { error } = await supabase.from("turmas").insert({ nome });

  if (error) return { erro: `Não foi possível salvar: ${error.message}` };

  revalidarTudo();
  return { ok: true };
}

export async function atualizarTurma(
  _anterior: Resultado,
  formData: FormData,
): Promise<Resultado> {
  const id = String(formData.get("id") ?? "");
  const nome = String(formData.get("nome") ?? "").trim();

  if (!id) return { erro: "Turma não identificada." };
  if (!nome) return { erro: "Informe o nome da turma." };

  const supabase = await createClient();
  const { error } = await supabase.from("turmas").update({ nome }).eq("id", id);

  if (error) return { erro: `Não foi possível salvar: ${error.message}` };

  revalidarTudo();
  return { ok: true };
}

/** Mesma proteção de histórico aplicada aos produtos. */
export async function excluirTurma(
  _anterior: Resultado,
  formData: FormData,
): Promise<Resultado> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { erro: "Turma não identificada." };

  const supabase = await createClient();

  const { count, error: erroContagem } = await supabase
    .from("vendas")
    .select("id", { count: "exact", head: true })
    .eq("turma_id", id);

  if (erroContagem) {
    return { erro: `Não foi possível verificar as vendas: ${erroContagem.message}` };
  }

  if ((count ?? 0) > 0) {
    return {
      erro:
        `Esta turma está em ${count} venda(s) registrada(s) e não pode ser ` +
        "excluída sem apagar histórico. Arquive-a para tirá-la do formulário " +
        "de novas vendas mantendo os relatórios intactos.",
    };
  }

  const { error } = await supabase.from("turmas").delete().eq("id", id);
  if (error) return { erro: `Não foi possível excluir: ${error.message}` };

  revalidarTudo();
  return { ok: true };
}

export async function alternarArquivoTurma(
  _anterior: Resultado,
  formData: FormData,
): Promise<Resultado> {
  const id = String(formData.get("id") ?? "");
  const arquivar = String(formData.get("arquivar") ?? "") === "1";
  if (!id) return { erro: "Turma não identificada." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("turmas")
    .update({ arquivado: arquivar })
    .eq("id", id);

  if (error) return { erro: `Não foi possível atualizar: ${error.message}` };

  revalidarTudo();
  return { ok: true };
}
