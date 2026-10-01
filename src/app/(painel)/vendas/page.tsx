import { CabecalhoPagina } from "@/components/ui";
import { listarProdutos, listarTurmas, listarVendas } from "@/lib/dados";
import { ListaVendas } from "./lista";
import { asaasConfigurado } from "@/lib/asaas";
import { lerFiltros, lerStatusFiltro } from "@/lib/filtros";

export const metadata = { title: "Vendas | Controle de Vendas" };
export const dynamic = "force-dynamic";

export default async function PaginaVendas({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const filtros = lerFiltros(params);
  const status = lerStatusFiltro(params);
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
      <ListaVendas vendas={vendas} produtos={produtos} turmas={turmas} filtros={filtros} status={status} asaasAtivo={asaasConfigurado()}
        vendaInicialId={typeof params.venda === "string" ? params.venda : null} />
    </div>
  );
}
