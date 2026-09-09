import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { supabaseEnv } from "./env";

/**
 * Cliente para Server Components, Server Actions e Route Handlers.
 * Usa a sessão do usuário via cookie, então todo acesso passa pelo RLS.
 */
export async function createClient() {
  const cookieStore = await cookies();
  const { url, anonKey } = supabaseEnv();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Chamado de um Server Component: o middleware já cuida de
          // renovar a sessão, então dá para ignorar com segurança.
        }
      },
    },
  });
}

/** Retorna o usuário logado ou null. */
export async function getUsuario() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
