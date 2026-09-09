import { CabecalhoPagina } from "@/components/ui";
import { listarProdutos, listarTurmas, listarVendas } from "@/lib/dados";
import { ListaVendas } from "./lista";

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
        descricao="Cada venda fechada pelo link de pagamento, com comprador, turma e comprovante."
      />
      <ListaVendas vendas={vendas} produtos={produtos} turmas={turmas} />
    </div>
  );
}
