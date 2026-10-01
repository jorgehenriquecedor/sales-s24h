import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listarProdutos, listarTurmas, listarVendas } from "@/lib/dados";
import { aplicarFiltros, buscarVendas, lerFiltros } from "@/lib/filtros";
import { gerarRelatorioPdf, nomeArquivoRelatorio } from "@/lib/pdf";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  }

  // Lê exatamente os mesmos parâmetros que o dashboard usa na URL, então o
  // relatório sai com o mesmo recorte que está na tela.
  const params: Record<string, string | string[]> = {};
  for (const chave of new Set(request.nextUrl.searchParams.keys())) {
    const valores = request.nextUrl.searchParams.getAll(chave);
    params[chave] = valores.length > 1 ? valores : valores[0];
  }

  const filtros = lerFiltros(params);

  const [todasVendas, produtos, turmas] = await Promise.all([
    listarVendas(),
    listarProdutos(),
    listarTurmas(),
  ]);

  const busca = request.nextUrl.searchParams.get("busca")?.trim() ?? "";
  const vendas = buscarVendas(aplicarFiltros(todasVendas, filtros), busca)
    .filter((venda) => venda.pagamento_status === "aprovada");

  // Nomes, e não ids, para o cabeçalho do relatório dizer o recorte por extenso.
  const nomesDe = (itens: { id: string; nome: string }[], ids: string[]) =>
    ids.map((id) => itens.find((i) => i.id === id)?.nome ?? "item removido");

  const pdf = await gerarRelatorioPdf(vendas, {
    periodo: filtros.periodo,
    produtos: nomesDe(produtos, filtros.produtos),
    turmas: nomesDe(turmas, filtros.turmas),
    busca,
  }, new Date(), { origem: request.nextUrl.origin });

  return new NextResponse(pdf as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${nomeArquivoRelatorio(filtros.periodo)}"`,
      "Cache-Control": "no-store",
    },
  });
}
