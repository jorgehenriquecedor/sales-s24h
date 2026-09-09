import { CabecalhoPagina } from "@/components/ui";
import { contarVinculos, listarTurmas } from "@/lib/dados";
import { GerenciadorTurmas } from "./gerenciador";

export const metadata = { title: "Turmas | Controle de Vendas" };
export const dynamic = "force-dynamic";

export default async function PaginaTurmas() {
  const [turmas, vinculos] = await Promise.all([
    listarTurmas(),
    contarVinculos(),
  ]);

  return (
    <div className="space-y-7">
      <CabecalhoPagina
        titulo="Turmas"
        descricao="Turmas usadas para agrupar as vendas nos relatórios e no dashboard."
      />
      <GerenciadorTurmas turmas={turmas} vendasPorTurma={vinculos.porTurma} />
    </div>
  );
}
