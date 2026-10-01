export const BUCKET_COMPROVANTES = "comprovantes";

export function urlReciboAsaasConfiavel(url: string | null): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && !parsed.username && !parsed.password &&
      (parsed.hostname === "asaas.com" || parsed.hostname.endsWith(".asaas.com"));
  } catch { return false; }
}

export const TIPOS_ACEITOS = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/heic",
  "application/pdf",
] as const;

/** Mesmo limite configurado no bucket do Supabase. */
export const TAMANHO_MAXIMO = 20 * 1024 * 1024; // 20 MB

export const ACCEPT_ARQUIVO = ".png,.jpg,.jpeg,.webp,.heic,.pdf,image/*,application/pdf";

/** Retorna a mensagem de erro, ou null se o arquivo serve. */
export function validarArquivo(arquivo: File): string | null {
  if (arquivo.size === 0) return "O arquivo está vazio.";
  if (arquivo.size > TAMANHO_MAXIMO) {
    return "O arquivo passa de 20 MB. Envie uma versão menor.";
  }
  if (arquivo.type && !TIPOS_ACEITOS.includes(arquivo.type as never)) {
    return "Formato não aceito. Envie uma imagem (PNG, JPG, WEBP) ou PDF.";
  }
  return null;
}

/** Caminho do arquivo dentro do bucket, sempre na pasta da venda. */
export function caminhoComprovante(vendaId: string, nomeArquivo: string): string {
  const extensao = (nomeArquivo.split(".").pop() ?? "").toLowerCase();
  const sufixo = /^[a-z0-9]{1,5}$/.test(extensao) ? `.${extensao}` : "";
  return `${vendaId}/${Date.now()}${sufixo}`;
}
