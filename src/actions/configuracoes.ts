"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { adminClient } from "@/lib/supabase/admin";
import { exigirAdministrador } from "@/lib/administrador";
import { cifrar, decifrar } from "@/lib/segredos";
import type { CredenciaisAsaas } from "@/lib/integracoes";
import { chamarAsaasConfig, gravarWebhookAsaas, type WebhookAsaas } from "@/lib/asaas-webhook-config";

export type ResultadoConfiguracao = { ok?: boolean; erro?: string; senha?: string; email?: string };

export async function criarLogin(_anterior: ResultadoConfiguracao, dados: FormData): Promise<ResultadoConfiguracao> {
  await exigirAdministrador();
  const email = String(dados.get("email") ?? "").trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { erro: "Informe um e-mail válido." };
  const senha = String(dados.get("senha") ?? "") || `Aa1!${randomBytes(16).toString("base64url")}`;
  if (senha.length < 12 || senha.length > 72) return { erro: "Gere uma senha de pelo menos 12 caracteres." };
  const { data, error } = await adminClient().auth.admin.createUser({ email, password: senha, email_confirm: true });
  if (error || !data.user) {
    if (error?.code === "email_exists" || error?.message?.toLowerCase().includes("already")) return { erro: "Este e-mail já possui acesso." };
    return { erro: "Não foi possível criar o login. Confira o e-mail e tente novamente." };
  }
  revalidatePath("/configuracoes/logins");
  return { ok: true, senha, email };
}

export async function salvarIntegracaoAsaas(_anterior: ResultadoConfiguracao, dados: FormData): Promise<ResultadoConfiguracao> {
  await exigirAdministrador();
  const chaveInformada = String(dados.get("api_key") ?? "").trim();
  const tokenInformado = String(dados.get("webhook_token") ?? "").trim();
  const ambiente = String(dados.get("ambiente") ?? "sandbox");
  const email = String(dados.get("email") ?? "").trim();
  if (ambiente !== "sandbox" && ambiente !== "producao") return { erro: "Escolha um ambiente válido." };
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { erro: "Informe o e-mail que receberá os avisos da integração." };
  if (tokenInformado && (tokenInformado.length < 32 || tokenInformado.length > 255 || /\s/.test(tokenInformado))) return { erro: "O token do webhook deve ter de 32 a 255 caracteres e não conter espaços." };
  const origem = new URL(process.env.ASAAS_CALLBACK_BASE_URL || "https://controle-vendas-s24h.vercel.app").origin;
  if (!origem.startsWith("https://")) return { erro: "O endereço do painel precisa usar HTTPS." };
  const admin = adminClient();
  const reserva = new Date().toISOString();
  const { data: atual, error: erroReserva } = await admin.from("integracoes")
    .update({ configurando_em: reserva }).eq("provedor", "asaas")
    .or(`configurando_em.is.null,configurando_em.lt.${new Date(Date.now() - 120000).toISOString()}`)
    .select("*").maybeSingle();
  if (erroReserva) return { erro: "Não foi possível acessar as configurações da integração." };
  if (!atual) return { erro: "Uma configuração está em andamento. Aguarde e tente novamente." };
  try {
    const anterior: CredenciaisAsaas | null = atual.segredo ? JSON.parse(decifrar(atual.segredo)) : null;
    const pendente: CredenciaisAsaas | null = atual.segredo_pendente ? JSON.parse(decifrar(atual.segredo_pendente)) : null;
    const chave = chaveInformada || anterior?.key || "";
    if (chave.length < 20 || chave.length > 4096 || /\s/.test(chave)) return { erro: "Informe a chave de API do Asaas." };
    const token = tokenInformado || anterior?.token || pendente?.token || `whsec_${randomBytes(32).toString("base64url")}`;
    if (token === chave) return { erro: "O token do webhook deve ser diferente da chave de API." };
    // Recupera também um webhook criado antes de uma eventual falha local.
    const lista = await chamarAsaasConfig<{ data: WebhookAsaas[] }>(ambiente, chave, "/webhooks?limit=100");
    if (!Array.isArray(lista.data)) throw new Error("O Asaas retornou uma resposta inválida.");
    const existente = lista.data.find((w) => w.url === `${origem}/api/asaas/webhook`);
    const { count, error: erroContagem } = await admin.from("asaas_checkouts").select("id", { count: "exact", head: true });
    if (erroContagem) throw new Error("Não foi possível conferir os checkouts existentes.");
    if (count && anterior && (anterior.ambiente !== ambiente || (chave !== anterior.key && !lista.data.some((w) => w.id === atual.webhook_id)))) {
      return { erro: "Há checkouts vinculados à integração atual. A troca de conta ou ambiente exige migração para preservar o acompanhamento dessas vendas." };
    }
    const segredo = cifrar(JSON.stringify({ key: chave, token, ambiente, origem }));
    const { error: erroPendente } = await admin.from("integracoes").update({ segredo_pendente: segredo })
      .eq("provedor", "asaas").eq("configurando_em", reserva);
    if (erroPendente) throw new Error("Não foi possível salvar as credenciais com segurança.");
    const webhook = await gravarWebhookAsaas({ ambiente, chave, token, origem, email, existente });
    const { data: salva, error } = await admin.from("integracoes").update({
      segredo, segredo_pendente: null, ambiente, email, webhook_id: webhook.id, ativa: true, updated_at: new Date().toISOString(),
    }).eq("provedor", "asaas").eq("configurando_em", reserva).select("provedor").maybeSingle();
    if (error || !salva) throw new Error("O Asaas respondeu, mas o painel não conseguiu concluir o registro. Confirme novamente para finalizar.");
    revalidatePath("/vendas");
    revalidatePath("/configuracoes/integracoes");
    return { ok: true };
  } catch (erro) {
    return { erro: erro instanceof Error && !["TimeoutError", "TypeError", "AbortError"].includes(erro.name)
      ? erro.message : "A conexão com o Asaas não foi concluída. Tente novamente." };
  } finally {
    await admin.from("integracoes").update({ configurando_em: null }).eq("provedor", "asaas").eq("configurando_em", reserva);
  }
}
