import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { processarEventoAsaas } from "@/lib/asaas-fluxo";
import { tokensWebhook } from "@/lib/integracoes";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const recebido = request.headers.get("asaas-access-token") ?? "";
  const esperados = await tokensWebhook();
  const autorizado = esperados.some((esperado) => recebido &&
    Buffer.byteLength(esperado) === Buffer.byteLength(recebido) &&
    timingSafeEqual(Buffer.from(esperado), Buffer.from(recebido)));
  if (!autorizado) {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  }
  if (Number(request.headers.get("content-length") ?? 0) > 128_000) {
    return NextResponse.json({ erro: "Evento muito grande." }, { status: 413 });
  }
  try {
    const texto = await request.text();
    if (texto.length > 128_000) return NextResponse.json({ erro: "Evento muito grande." }, { status: 413 });
    const evento = JSON.parse(texto);
    await processarEventoAsaas(evento);
    return NextResponse.json({ ok: true });
  } catch (erro) {
    console.error("Falha no webhook Asaas", erro);
    return NextResponse.json({ erro: "Falha ao processar evento." }, { status: 500 });
  }
}
