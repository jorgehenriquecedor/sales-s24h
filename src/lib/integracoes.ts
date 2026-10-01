import "server-only";
import { adminClient } from "./supabase/admin";
import { decifrar } from "./segredos";

export type CredenciaisAsaas = { key: string; token: string; ambiente: "sandbox" | "producao"; origem: string };
export async function lerIntegracao() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const { data, error } = await adminClient().from("integracoes").select("*").eq("provedor", "asaas").maybeSingle();
  if (error) throw new Error("Não foi possível carregar a integração.");
  return data;
}
export async function credenciaisAsaas(): Promise<CredenciaisAsaas | null> {
  const data = await lerIntegracao();
  if (data?.ativa && data.segredo) return JSON.parse(decifrar(data.segredo));
  const { ASAAS_API_KEY: key, ASAAS_WEBHOOK_TOKEN: token, ASAAS_AMBIENTE: ambiente, ASAAS_CALLBACK_BASE_URL: origem } = process.env;
  if (key && token && origem && (ambiente === "sandbox" || ambiente === "producao")) return { key, token, ambiente, origem };
  return null;
}
export async function tokensWebhook(): Promise<string[]> {
  const data = await lerIntegracao();
  return [data?.segredo, data?.segredo_pendente].filter(Boolean).map((valor) => (JSON.parse(decifrar(valor)) as CredenciaisAsaas).token)
    .concat(process.env.ASAAS_WEBHOOK_TOKEN ? [process.env.ASAAS_WEBHOOK_TOKEN] : []);
}
