/**
 * Lê as variáveis do Supabase apenas quando uma requisição realmente precisa
 * delas — nunca no topo do módulo. Assim `next build` funciona mesmo em um
 * ambiente sem as variáveis configuradas, e o erro (quando existe) aparece
 * com uma mensagem clara em vez de um "undefined" no meio do stack.
 */
export function supabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Supabase não configurado. Defina NEXT_PUBLIC_SUPABASE_URL e " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY (veja o .env.example e o README).",
    );
  }

  return { url, anonKey };
}

export function supabaseConfigurado() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
