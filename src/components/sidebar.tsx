"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Logo } from "./logo";
import {
  IconePainel,
  IconeProduto,
  IconeSair,
  IconeTurma,
  IconeVendas,
} from "./icones";

type Item = { href: string; rotulo: string; icone: ReactNode };

const GRUPOS: { titulo: string | null; itens: Item[] }[] = [
  {
    titulo: null,
    itens: [
      { href: "/", rotulo: "Início", icone: <IconePainel /> },
    ],
  },
  {
    titulo: "Vendas e Atendimento",
    itens: [{ href: "/vendas", rotulo: "Vendas", icone: <IconeVendas /> }],
  },
  {
    titulo: "Cadastros",
    itens: [
      { href: "/produtos", rotulo: "Produtos", icone: <IconeProduto /> },
      { href: "/turmas", rotulo: "Turmas", icone: <IconeTurma /> },
    ],
  },
];

function estaAtivo(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function Sidebar({
  email,
  sair,
}: {
  email: string;
  sair: () => Promise<void>;
}) {
  const pathname = usePathname();
  const [aberta, setAberta] = useState(false);

  const navegacao = (
    <nav className="flex-1 space-y-6 px-3 py-5">
      {GRUPOS.map((grupo, i) => (
        <div key={grupo.titulo ?? `grupo-${i}`}>
          {grupo.titulo && (
            <p className="mb-1.5 px-3 text-[10px] font-semibold tracking-[0.13em] text-navy-texto/60 uppercase">
              {grupo.titulo}
            </p>
          )}
          <ul className="space-y-0.5">
            {grupo.itens.map((item) => {
              const ativo = estaAtivo(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setAberta(false)}
                    aria-current={ativo ? "page" : undefined}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                      ativo
                        ? "bg-brasa/12 text-brasa-claro"
                        : "text-navy-texto hover:bg-navy-alto hover:text-white"
                    }`}
                  >
                    <span className="shrink-0">{item.icone}</span>
                    {item.rotulo}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  const rodape = (
    <div className="border-t border-navy-borda px-4 py-4">
      <p className="truncate text-xs text-navy-texto" title={email}>
        {email}
      </p>
      <form action={sair} className="mt-2">
        <button
          type="submit"
          className="flex items-center gap-2 text-xs font-medium text-navy-texto transition-colors hover:text-white"
        >
          <IconeSair className="h-4 w-4" />
          Sair da conta
        </button>
      </form>
    </div>
  );

  return (
    <>
      {/* Barra superior — apenas em telas pequenas */}
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-navy-borda bg-navy px-4 py-3 lg:hidden">
        <button
          type="button"
          onClick={() => setAberta(true)}
          aria-label="Abrir menu"
          className="rounded-lg p-1.5 text-navy-texto hover:bg-navy-alto hover:text-white"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
          >
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
        <Logo />
      </header>

      {/* Drawer em telas pequenas */}
      {aberta && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Fechar menu"
            onClick={() => setAberta(false)}
            className="absolute inset-0 bg-tinta/50"
          />
          <aside className="rolagem-sidebar absolute inset-y-0 left-0 flex w-64 flex-col overflow-y-auto bg-navy">
            <div className="border-b border-navy-borda px-5 py-5">
              <Logo />
            </div>
            {navegacao}
            {rodape}
          </aside>
        </div>
      )}

      {/* Sidebar fixa no desktop */}
      <aside className="rolagem-sidebar sticky top-0 hidden h-dvh w-64 shrink-0 flex-col overflow-y-auto bg-navy lg:flex">
        <div className="border-b border-navy-borda px-5 py-5">
          <Logo />
        </div>
        {navegacao}
        {rodape}
      </aside>
    </>
  );
}
