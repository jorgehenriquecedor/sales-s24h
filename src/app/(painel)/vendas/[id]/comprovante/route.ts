import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { urlReciboAsaasConfiavel } from "@/lib/comprovante";

/**
 * Redireciona para uma URL assinada e temporária do comprovante.
 * O bucket é privado: o arquivo nunca fica exposto por URL pública.
 *
 * ?download=1 força o download em vez de abrir no navegador.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  }

  const { data: venda, error } = await supabase
    .from("vendas")
    .select("comprovante_path, comprovante_nome, comprador_nome, asaas_comprovante_url")
    .eq("id", id)
    .maybeSingle();

  if (error || !venda) {
    return NextResponse.json(
      { erro: "Comprovante não encontrado." },
      { status: 404 },
    );
  }

  const baixar = request.nextUrl.searchParams.get("download") === "1";

  // O endereço permanente também atende os recibos fornecidos como página
  // pelo Asaas, após autenticação e consulta com as permissões do usuário.
  if (!venda.comprovante_path) {
    if (urlReciboAsaasConfiavel(venda.asaas_comprovante_url)) {
      return NextResponse.redirect(venda.asaas_comprovante_url!, {
        headers: { "Cache-Control": "private, no-store" },
      });
    }
    return NextResponse.json({ erro: "Comprovante não encontrado." }, { status: 404 });
  }

  const { data, error: erroUrl } = await supabase.storage
    .from("comprovantes")
    .createSignedUrl(
      venda.comprovante_path,
      600,
      baixar
        ? { download: venda.comprovante_nome ?? `comprovante-${id}` }
        : undefined,
    );

  if (erroUrl || !data) {
    return NextResponse.json(
      { erro: "Não foi possível gerar o link do arquivo." },
      { status: 500 },
    );
  }

  return NextResponse.redirect(data.signedUrl, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
