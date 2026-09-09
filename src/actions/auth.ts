"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type EstadoLogin = { erro?: string };

export async function entrar(
  _anterior: EstadoLogin,
  formData: FormData,
): Promise<EstadoLogin> {
  const email = String(formData.get("email") ?? "").trim();
  const senha = String(formData.get("senha") ?? "");
  const destinoBruto = String(formData.get("redirect") ?? "");

  if (!email || !senha) {
    return { erro: "Informe e-mail e senha." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: senha,
  });

  if (error) {
    return {
      erro:
        error.message === "Invalid login credentials"
          ? "E-mail ou senha incorretos."
          : `Não foi possível entrar: ${error.message}`,
    };
  }

  // Só aceita caminho interno — nunca redireciona para fora do painel.
  const destino =
    destinoBruto.startsWith("/") && !destinoBruto.startsWith("//")
      ? destinoBruto
      : "/";

  revalidatePath("/", "layout");
  redirect(destino);
}

export async function sair() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
