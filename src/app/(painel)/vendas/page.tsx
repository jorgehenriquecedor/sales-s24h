import { CabecalhoPagina } from "@/components/ui";
import { listarProdutos, listarTurmas, listarVendas } from "@/lib/dados";
import { ListaVendas } from "./lista";
import { asaasConfigurado } from "@/lib/asaas";

export const metadata = { title: "Vendas | Controle de Vendas" };
export const dynamic = "force-dynamic";

export default async function PaginaVendas() {
  const [vendas, produtos, turmas] = await Promise.all([
    listarVendas(),
    listarProdutos(),
    listarTurmas(),
  ]);

  return (
    <div className="space-y-7">
      <CabecalhoPagina
        titulo="Vendas"
        descricao="Acompanhe cada checkout, aprovação e comprovante de pagamento."
      />
      <ListaVendas vendas={vendas} produtos={produtos} turmas={turmas} asaasAtivo={asaasConfigurado()} />
    </div>
  );
}
