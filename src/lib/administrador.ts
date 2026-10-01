import "server-only";
import { redirect } from "next/navigation";
import { getUsuario } from "./supabase/server";
import { administrador } from "./permissoes";

export async function exigirAdministrador() {
  const usuario = await getUsuario();
  if (!usuario || !administrador(usuario)) throw new Error("Acesso restrito ao administrador.");
  return usuario;
}
export async function exigirAdministradorPagina() {
  const usuario = await getUsuario();
  if (!usuario || !administrador(usuario)) redirect("/");
  return usuario;
}
