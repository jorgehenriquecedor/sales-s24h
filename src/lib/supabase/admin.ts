import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseEnv } from "./env";

/** Exclusivo de ações e webhooks no servidor. Nunca importar no navegador. */
export function adminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada.");
  return createClient(supabaseEnv().url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
