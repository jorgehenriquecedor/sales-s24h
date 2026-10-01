import { adminClient } from "@/lib/supabase/admin";
import { CabecalhoPagina } from "@/components/ui";
import { FormularioLogin } from "./formulario";
import { exigirAdministradorPagina } from "@/lib/administrador";

export const dynamic = "force-dynamic";
export const metadata = { title: "Logins | Configurações" };

export default async function LoginsPage() {
  await exigirAdministradorPagina();
  const { data, error } = await adminClient().auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw new Error("Não foi possível listar os acessos.");
  const usuarios = (data.users ?? []).map((user) => ({ id: user.id, email: user.email ?? "", criado: user.created_at }));
  return <div className="space-y-7">
    <CabecalhoPagina titulo="Logins" descricao="Libere o acesso de pessoas autorizadas ao painel." />
    <FormularioLogin usuarios={usuarios} />
  </div>;
}
