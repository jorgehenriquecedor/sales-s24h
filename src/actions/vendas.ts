"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { converterParaNumero } from "@/lib/format";
import { BUCKET_COMPROVANTES } from "@/lib/comprovante";
import type { Resultado } from "./produtos";

const BUCKET = BUCKET_COMPROVANTES;

function revalidarTudo() {
  revalidatePath("/", "layout");
}

type CamposVenda = {
  comprador_nome: string;
  comprador_telefone: string;
  comprador_email: string;
  produto_id: string;
  turma_id: string;
  valor: number;
};

function lerCampos(formData: FormData): CamposVenda {
  return {
    comprador_nome: String(formData.get("comprador_nome") ?? "").trim(),
    comprador_telefone: String(formData.get("comprador_telefone") ?? "").trim(),
    comprador_email: String(formData.get("comprador_email") ?? "").trim(),
    produto_id: String(formData.get("produto_id") ?? ""),
    turma_id: String(formData.get("turma_id") ?? ""),
    valor: converterParaNumero(formData.get("valor")),
  };
}

function validar(campos: CamposVenda): string | null {
  if (!campos.comprador_nome) return "Informe o nome completo do comprador.";
  if (!campos.produto_id) return "Selecione o produto.";
  if (!campos.turma_id) return "Selecione a turma.";
  if (!Number.isFinite(campos.valor)) return "Informe um valor válido.";
  if (campos.valor < 0) return "O valor não pode ser negativo.";
  return null;
}

/** Busca os nomes atuais para congelar na venda. */
async function nomesDeReferencia(produtoId: string, turmaId: string) {
  const supabase = await createClient();

  const [produto, turma] = await Promise.all([
    supabase.from("produtos").select("nome").eq("id", produtoId).maybeSingle(),
    supabase.from("turmas").select("nome").eq("id", turmaId).maybeSingle(),
  ]);

  if (!produto.data) return { erro: "Produto não encontrado." as const };
  if (!turma.data) return { erro: "Turma não encontrada." as const };

  return { produto_nome: produto.data.nome, turma_nome: turma.data.nome };
}

export async function criarVenda(
  _anterior: Resultado,
  formData: FormData,
): Promise<Resultado> {
  const campos = lerCampos(formData);
  const invalido = validar(campos);
  if (invalido) return { erro: invalido };

  const nomes = await nomesDeReferencia(campos.produto_id, campos.turma_id);
  if ("erro" in nomes) return { erro: nomes.erro };

  const supabase = await createClient();
  const { error } = await supabase.from("vendas").insert({
    ...campos,
    produto_nome: nomes.produto_nome,
    turma_nome: nomes.turma_nome,
    // O status inicial é garantido pelo trigger no banco.
  });

  if (error) return { erro: `Não foi possível registrar a venda: ${error.message}` };

  revalidarTudo();
  return { ok: true };
}

export async function atualizarVenda(
  _anterior: Resultado,
  formData: FormData,
): Promise<Resultado> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { erro: "Venda não identificada." };

  const campos = lerCampos(formData);
  const invalido = validar(campos);
  if (invalido) return { erro: invalido };

  const nomes = await nomesDeReferencia(campos.produto_id, campos.turma_id);
  if ("erro" in nomes) return { erro: nomes.erro };

  const supabase = await createClient();
  const { error } = await supabase
    .from("vendas")
    .update({
      ...campos,
      produto_nome: nomes.produto_nome,
      turma_nome: nomes.turma_nome,
    })
    .eq("id", id);

  if (error) return { erro: `Não foi possível salvar: ${error.message}` };

  revalidarTudo();
  return { ok: true };
}

/**
 * Registra na venda um comprovante que o navegador já subiu direto para o
 * Storage. O upload não passa pelo servidor de propósito: a Vercel limita o
 * corpo de uma requisição a ~4,5 MB, o que barraria PDFs e fotos maiores.
 *
 * O status vira "comprovante_anexado" pelo trigger no banco, não por conta
 * do cliente.
 */
export async function registrarComprovante(
  _anterior: Resultado,
  formData: FormData,
): Promise<Resultado> {
  const id = String(formData.get("id") ?? "");
  const caminho = String(formData.get("caminho") ?? "").trim();
  const nome = String(formData.get("nome") ?? "").trim();

  if (!id) return { erro: "Venda não identificada." };
  if (!caminho) return { erro: "Arquivo não identificado." };

  // O arquivo tem que estar na pasta desta venda: impede que um caminho
  // forjado aponte para o comprovante de outra venda.
  if (!caminho.startsWith(`${id}/`) || caminho.includes("..")) {
    return { erro: "Caminho de arquivo inválido." };
  }

  const supabase = await createClient();

  const { data: venda, error: erroVenda } = await supabase
    .from("vendas")
    .select("comprovante_path")
    .eq("id", id)
    .maybeSingle();

  if (erroVenda) {
    return { erro: `Não foi possível carregar a venda: ${erroVenda.message}` };
  }
  if (!venda) return { erro: "Venda não encontrada." };

  const { error: erroUpdate } = await supabase
    .from("vendas")
    .update({ comprovante_path: caminho, comprovante_nome: nome || null })
    .eq("id", id);

  if (erroUpdate) {
    // Não deixa arquivo órfão no bucket se o vínculo falhou.
    await supabase.storage.from(BUCKET).remove([caminho]);
    return { erro: `Não foi possível vincular o comprovante: ${erroUpdate.message}` };
  }

  // O comprovante anterior, se existia, deixa de ser referenciado.
  if (venda.comprovante_path && venda.comprovante_path !== caminho) {
    await supabase.storage.from(BUCKET).remove([venda.comprovante_path]);
  }

  revalidarTudo();
  return { ok: true };
}

export async function removerComprovante(
  _anterior: Resultado,
  formData: FormData,
): Promise<Resultado> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { erro: "Venda não identificada." };

  const supabase = await createClient();

  const { data: venda } = await supabase
    .from("vendas")
    .select("comprovante_path")
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabase
    .from("vendas")
    .update({ comprovante_path: null, comprovante_nome: null })
    .eq("id", id);

  if (error) return { erro: `Não foi possível remover: ${error.message}` };

  if (venda?.comprovante_path) {
    await supabase.storage.from(BUCKET).remove([venda.comprovante_path]);
  }

  revalidarTudo();
  return { ok: true };
}

export async function excluirVenda(
  _anterior: Resultado,
  formData: FormData,
): Promise<Resultado> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { erro: "Venda não identificada." };

  const supabase = await createClient();

  const { data: venda } = await supabase
    .from("vendas")
    .select("comprovante_path")
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabase.from("vendas").delete().eq("id", id);
  if (error) return { erro: `Não foi possível excluir: ${error.message}` };

  if (venda?.comprovante_path) {
    await supabase.storage.from(BUCKET).remove([venda.comprovante_path]);
  }

  revalidarTudo();
  return { ok: true };
}
