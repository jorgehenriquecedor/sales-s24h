import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { Logo } from "@/components/logo";
import { getUsuario } from "@/lib/supabase/server";
import { supabaseConfigurado } from "@/lib/supabase/env";
import { sair } from "@/actions/auth";

export const dynamic = "force-dynamic";

function ConfiguracaoPendente() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-navy px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="mb-7 flex justify-center">
          <Logo />
        </div>
        <div className="rounded-2xl bg-white p-7 shadow-lg">
          <h1 className="serif text-2xl text-tinta">Configuração pendente</h1>
          <p className="mt-2 text-sm text-neutro">
            O painel ainda não sabe com qual banco falar. Defina as duas
            variáveis de ambiente abaixo e reinicie a aplicação:
          </p>
          <ul className="mt-4 space-y-2 font-mono text-[13px] text-tinta">
            <li className="rounded-lg bg-papel px-3 py-2">
              NEXT_PUBLIC_SUPABASE_URL
            </li>
            <li className="rounded-lg bg-papel px-3 py-2">
              NEXT_PUBLIC_SUPABASE_ANON_KEY
            </li>
          </ul>
          <p className="mt-4 text-sm text-neutro">
            Os dois valores ficam no painel do Supabase, em{" "}
            <span className="font-medium text-tinta">
              Project Settings → API
            </span>
            . O passo a passo completo está no README do repositório.
          </p>
        </div>
      </div>
    </main>
  );
}

export default async function LayoutPainel({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!supabaseConfigurado()) {
    return <ConfiguracaoPendente />;
  }

  const usuario = await getUsuario();
  if (!usuario) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <Sidebar email={usuario.email ?? "Sessão ativa"} sair={sair} />
      <main className="min-w-0 flex-1">
        <div className="mx-auto w-full max-w-[1400px] px-5 py-8 sm:px-8 lg:py-10">
          {children}
        </div>
      </main>
    </div>
  );
}
