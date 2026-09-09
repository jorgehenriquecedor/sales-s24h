import { CabecalhoPagina } from "@/components/ui";
import { contarVinculos, listarProdutos } from "@/lib/dados";
import { GerenciadorProdutos } from "./gerenciador";

export const metadata = { title: "Produtos | Controle de Vendas" };
export const dynamic = "force-dynamic";

export default async function PaginaProdutos() {
  const [produtos, vinculos] = await Promise.all([
    listarProdutos(),
    contarVinculos(),
  ]);

  return (
    <div className="space-y-7">
      <CabecalhoPagina
        titulo="Produtos"
        descricao="Cursos e produtos vendidos. O preço cadastrado aqui preenche o valor de cada nova venda."
      />
      <GerenciadorProdutos
        produtos={produtos}
        vendasPorProduto={vinculos.porProduto}
      />
    </div>
  );
}
