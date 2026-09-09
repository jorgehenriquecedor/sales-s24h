import { Suspense } from "react";
import { Logo } from "@/components/logo";
import { FormularioLogin } from "./formulario";

export const metadata = { title: "Entrar | Controle de Vendas" };

export default async function PaginaLogin({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const { redirect: destino } = await searchParams;

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-navy px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-7 flex justify-center">
          <Logo />
        </div>

        <div className="rounded-2xl bg-white p-7 shadow-lg">
          <h1 className="serif text-2xl text-tinta">Acessar o painel</h1>
          <p className="mt-1.5 text-sm text-neutro">
            Área restrita de controle de vendas.
          </p>

          <Suspense>
            <FormularioLogin destino={destino} />
          </Suspense>
        </div>

        <p className="mt-6 text-center text-xs text-navy-texto">
          Prova Oral — Suporte 24h
        </p>
      </div>
    </main>
  );
}
