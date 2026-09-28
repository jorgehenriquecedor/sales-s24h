"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { converterParaNumero } from "@/lib/format";
import { BUCKET_COMPROVANTES } from "@/lib/comprovante";
import { asaasConfigurado } from "@/lib/asaas";
import { gerarCheckout } from "@/lib/asaas-fluxo";
import type { Resultado } from "./produtos";

const BUCKET = BUCKET_COMPROVANTES;

export type ResultadoVenda = Resultado & { vendaId?: string; aviso?: string };

function revalidarTudo() {
  revalidatePath("/", "layout");
}

type CamposVenda = {
  comprador_nome: string;
  comprador_telefone: string;
  comprador_email: string;
  produto_ids: string[];
  turma_id: string | null;
  desconto_tipo: "nenhum" | "percentual" | "fixo";
  desconto_valor: number;
  desconto_observacao: string | null;
};

function lerCampos(formData: FormData): CamposVenda {
  const tipo = String(formData.get("desconto_tipo") ?? "nenhum");
  return {
    comprador_nome: String(formData.get("comprador_nome") ?? "").trim(),
    comprador_telefone: String(formData.get("comprador_telefone") ?? "").trim(),
    comprador_email: String(formData.get("comprador_email") ?? "").trim(),
    produto_ids: formData.getAll("produto_ids").map(String),
    turma_id: String(formData.get("turma_id") ?? "") || null,
    desconto_tipo: tipo as CamposVenda["desconto_tipo"],
    desconto_valor: tipo === "nenhum" ? 0 : converterParaNumero(formData.get("desconto_valor")),
    desconto_observacao: String(formData.get("desconto_observacao") ?? "").trim() || null,
  };
}

function validar(campos: CamposVenda): string | null {
  if (!campos.comprador_nome) return "Informe o nome completo do comprador.";
  if (campos.produto_ids.length < 1 || campos.produto_ids.length > 20) return "Selecione entre 1 e 20 produtos.";
  if (new Set(campos.produto_ids).size !== campos.produto_ids.length) return "Um produto não pode aparecer duas vezes.";
  if (campos.produto_ids.some((id) => !/^[0-9a-f-]{36}$/i.test(id))) return "Produto inválido.";
  if (!["nenhum", "percentual", "fixo"].includes(campos.desconto_tipo)) return "Tipo de desconto inválido.";
  if (!Number.isFinite(campos.desconto_valor) || campos.desconto_valor < 0) return "Informe um desconto válido.";
  if (campos.desconto_tipo !== "nenhum" && campos.desconto_valor <= 0) return "Informe um desconto maior que zero.";
  if (campos.desconto_tipo === "percentual" && campos.desconto_valor > 100) return "O desconto percentual não pode passar de 100%.";
  if ((campos.desconto_observacao?.length ?? 0) > 1000) return "A observação deve ter até 1000 caracteres.";
  return null;
}

function parametros(campos: CamposVenda) {
  return {
    p_comprador_nome: campos.comprador_nome,
    p_comprador_telefone: campos.comprador_telefone,
    p_comprador_email: campos.comprador_email,
    p_produto_ids: campos.produto_ids,
    p_turma_id: campos.turma_id,
    p_desconto_tipo: campos.desconto_tipo,
    p_desconto_valor: campos.desconto_valor,
    p_desconto_observacao: campos.desconto_observacao,
  };
}

export async function criarVenda(
  _anterior: ResultadoVenda,
  formData: FormData,
): Promise<ResultadoVenda> {
  const campos = lerCampos(formData);
  const invalido = validar(campos);
  if (invalido) return { erro: invalido };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { erro: "Faça login novamente para criar a venda." };
  const { data: id, error } = await supabase.rpc("criar_venda_com_produtos", parametros(campos));
  if (error || !id) return { erro: `Não foi possível registrar a venda: ${error?.message ?? "erro desconhecido"}` };

  if (!asaasConfigurado()) {
    revalidarTudo();
    return {
      ok: true,
      vendaId: id,
      aviso: "Venda salva sem checkout. A integração Asaas ainda não está configurada; gere o checkout nesta mesma venda depois da ativação.",
    };
  }

  try {
    await gerarCheckout(id);
  } catch (falha) {
    revalidarTudo();
    return {
      ok: true,
      vendaId: id,
      aviso: `Venda salva, mas o checkout não foi criado: ${falha instanceof Error ? falha.message : "erro inesperado"}. Abra a venda e tente novamente.`,
    };
  }

  revalidarTudo();
  return { ok: true, vendaId: id };
}

export async function gerarCheckoutNovamente(
  _anterior: Resultado,
  formData: FormData,
): Promise<Resultado> {
  const id = String(formData.get("id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { erro: "Venda inválida." };
  if (!asaasConfigurado()) return { erro: "A integração Asaas ainda não foi configurada." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { erro: "Faça login novamente." };
  const { data: venda } = await supabase.from("vendas").select("id").eq("id", id).maybeSingle();
  if (!venda) return { erro: "Venda não encontrada." };
  try {
    await gerarCheckout(id);
  } catch (falha) {
    return { erro: falha instanceof Error ? falha.message : "Não foi possível gerar o checkout." };
  }
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

  const supabase = await createClient();
  const { error } = await supabase.rpc("atualizar_venda_com_produtos", {
    p_id: id,
    ...parametros(campos),
  });

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
