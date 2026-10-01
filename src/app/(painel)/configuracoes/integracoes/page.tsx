import { CabecalhoPagina } from "@/components/ui";
import { lerIntegracao } from "@/lib/integracoes";
import { FormularioIntegracao } from "./formulario";
import { exigirAdministradorPagina } from "@/lib/administrador";

export const dynamic = "force-dynamic";
export const metadata = { title: "Integrações | Configurações" };
export default async function IntegracoesPage() {
  await exigirAdministradorPagina();
  const configuracao = await lerIntegracao();
  return <div className="space-y-7"><CabecalhoPagina titulo="Integrações" descricao="Conecte o painel aos serviços usados no seu processo de vendas." />
    <FormularioIntegracao configuracao={configuracao ? { ativa: configuracao.ativa, ambiente: configuracao.ambiente, email: configuracao.email } : null} />
  </div>;
}
