import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
    .select("comprovante_path, comprovante_nome, comprador_nome")
    .eq("id", id)
    .maybeSingle();

  if (error || !venda?.comprovante_path) {
    return NextResponse.json(
      { erro: "Comprovante não encontrado." },
      { status: 404 },
    );
  }

  const baixar = request.nextUrl.searchParams.get("download") === "1";

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

  return NextResponse.redirect(data.signedUrl);
}
