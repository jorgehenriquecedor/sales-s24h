import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listarVendas } from "@/lib/dados";
import { aplicarFiltros, lerFiltros } from "@/lib/filtros";
import { gerarCsv, nomeArquivoRelatorio } from "@/lib/csv";

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
  const vendas = aplicarFiltros(await listarVendas(), filtros);

  return new NextResponse(gerarCsv(vendas), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nomeArquivoRelatorio(filtros.periodo)}"`,
      "Cache-Control": "no-store",
    },
  });
}
