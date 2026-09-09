import type { NextRequest } from "next/server";
import { atualizarSessao } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return atualizarSessao(request);
}

export const config = {
  matcher: [
    /*
     * Todas as rotas, menos assets estáticos e imagens.
     */
    "/((?!_next/static|_next/image|favicon.ico|logo.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
