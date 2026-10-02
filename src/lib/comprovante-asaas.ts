import { TAMANHO_MAXIMO, urlReciboAsaasConfiavel } from "./comprovante";

const FORMATOS: Record<string, string> = {
  "application/pdf": "pdf", "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp",
};

/** Usa o endereço de download publicado na página, sem reconstruir URLs do Asaas. */
export function localizarPdfRecibo(html: string, paginaUrl: string): string | null {
  if (!urlReciboAsaasConfiavel(paginaUrl)) return null;
  for (const ancora of html.matchAll(/<a\b[^>]*\bhref\s*=\s*(["'])(.*?)\1[^>]*>/gi)) {
    const href = ancora[2].replace(/&amp;/gi, "&").replace(/&#0*38;/g, "&");
    try {
      const url = new URL(href, paginaUrl);
      if (urlReciboAsaasConfiavel(url.href) && url.origin === new URL(paginaUrl).origin &&
          (/(?:^|\/)pdf(?:\/|$)/i.test(url.pathname) || /\.pdf$/i.test(url.pathname))) return url.href;
    } catch { /* Ignora links inválidos da página. */ }
  }
  return null;
}

async function lerLimitado(resposta: Response, limite: number) {
  if (Number(resposta.headers.get("content-length") ?? 0) > limite) {
    await resposta.body?.cancel();
    throw new Error("O comprovante do Asaas excede o tamanho permitido.");
  }
  const leitor = resposta.body?.getReader();
  if (!leitor) throw new Error("O comprovante do Asaas está vazio.");
  const partes: Uint8Array[] = [];
  let tamanho = 0;
  while (true) {
    const { done, value } = await leitor.read();
    if (done) break;
    tamanho += value.byteLength;
    if (tamanho > limite) {
      await leitor.cancel();
      throw new Error("O comprovante do Asaas excede o tamanho permitido.");
    }
    partes.push(value);
  }
  const bytes = new Uint8Array(tamanho);
  let offset = 0;
  for (const parte of partes) { bytes.set(parte, offset); offset += parte.length; }
  return bytes;
}

/** Baixa somente o documento original. HTML nunca é salvo como PDF. */
export async function baixarComprovanteAsaas(url: string, requisitar: typeof fetch = fetch) {
  const sinal = AbortSignal.timeout(20000);
  let atual = url;
  const visitados = new Set<string>();
  for (let passo = 0; passo < 6; passo++) {
    if (!urlReciboAsaasConfiavel(atual) || visitados.has(atual)) throw new Error("Link de comprovante inválido.");
    visitados.add(atual);
    const resposta = await requisitar(atual, { redirect: "manual", cache: "no-store", signal: sinal });
    if ([301, 302, 303, 307, 308].includes(resposta.status)) {
      const destino = resposta.headers.get("location");
      await resposta.body?.cancel();
      if (!destino) throw new Error("Redirecionamento do comprovante sem destino.");
      atual = new URL(destino, atual).href;
      continue;
    }
    if (!resposta.ok) {
      await resposta.body?.cancel();
      throw new Error(`O comprovante do Asaas ainda não está disponível (HTTP ${resposta.status}).`);
    }
    const tipo = resposta.headers.get("content-type")?.split(";")[0].trim().toLowerCase() ?? "";
    if (tipo === "text/html") {
      const html = new TextDecoder().decode(await lerLimitado(resposta, 2 * 1024 * 1024));
      const download = localizarPdfRecibo(html, atual);
      if (!download) throw new Error("O Asaas ainda não disponibilizou o download do comprovante.");
      atual = download;
      continue;
    }
    const extensao = FORMATOS[tipo];
    if (!extensao) {
      await resposta.body?.cancel();
      throw new Error("Formato de comprovante não disponibilizado pelo Asaas.");
    }
    const bytes = await lerLimitado(resposta, TAMANHO_MAXIMO);
    if (!bytes.length || (extensao === "pdf" && new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-")) {
      throw new Error("O arquivo retornado pelo Asaas não é um comprovante válido.");
    }
    return { bytes, tipo, extensao };
  }
  throw new Error("O comprovante do Asaas excedeu o limite de redirecionamentos.");
}
