import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseConfigurado, supabaseEnv } from "./env";

/** Rotas acessíveis sem sessão. */
const ROTAS_PUBLICAS = ["/login", "/auth", "/pagamento", "/api/asaas/webhook"];

function ehRotaPublica(pathname: string) {
  return ROTAS_PUBLICAS.some(
    (rota) => pathname === rota || pathname.startsWith(`${rota}/`),
  );
}

export async function atualizarSessao(request: NextRequest) {
  // Sem variáveis configuradas não há como validar sessão. Deixa passar:
  // o layout do painel mostra uma tela de configuração pendente, que é
  // muito mais útil do que um erro 500 opaco.
  if (!supabaseConfigurado()) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });
  const { url, anonKey } = supabaseEnv();

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // getUser() revalida o token no servidor do Supabase. Não trocar por
  // getSession(), que apenas lê o cookie e é falsificável.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;

  if (!user && !ehRotaPublica(pathname)) {
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.search = "";
    if (pathname !== "/") {
      login.searchParams.set("redirect", `${pathname}${search}`);
    }
    return NextResponse.redirect(login);
  }

  if (user && pathname === "/login") {
    const painel = request.nextUrl.clone();
    painel.pathname = "/";
    painel.search = "";
    return NextResponse.redirect(painel);
  }

  return response;
}
