"use client";

import { useEffect, useRef, type ReactNode } from "react";

export function Modal({
  aberto,
  aoFechar,
  titulo,
  descricao,
  largura = "max-w-lg",
  children,
}: {
  aberto: boolean;
  aoFechar: () => void;
  titulo: string;
  descricao?: string;
  largura?: string;
  children: ReactNode;
}) {
  const painel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;

    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === "Escape") aoFechar();
    }

    document.addEventListener("keydown", aoTeclar);
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Foco no primeiro campo, para o formulário já sair digitável.
    const primeiro = painel.current?.querySelector<HTMLElement>(
      "input:not([type=hidden]), select, textarea, button",
    );
    primeiro?.focus();

    return () => {
      document.removeEventListener("keydown", aoTeclar);
      document.body.style.overflow = overflowAnterior;
    };
  }, [aberto, aoFechar]);

  if (!aberto) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <button
        type="button"
        aria-label="Fechar"
        onClick={aoFechar}
        className="fixed inset-0 bg-tinta/45"
      />
      <div className="relative flex min-h-full items-start justify-center p-4 sm:p-6">
        <div
          ref={painel}
          role="dialog"
          aria-modal="true"
          aria-label={titulo}
          className={`relative my-6 w-full ${largura} rounded-2xl border border-borda bg-white shadow-xl`}
        >
          <div className="flex items-start justify-between gap-4 border-b border-borda px-6 py-4">
            <div className="min-w-0">
              <h2 className="serif text-xl text-tinta">{titulo}</h2>
              {descricao && (
                <p className="mt-1 text-sm text-neutro">{descricao}</p>
              )}
            </div>
            <button
              type="button"
              onClick={aoFechar}
              aria-label="Fechar"
              className="-mt-1 shrink-0 rounded-lg p-1.5 text-neutro transition-colors hover:bg-papel hover:text-tinta"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                strokeLinecap="round"
              >
                <path d="m6 6 12 12M18 6 6 18" />
              </svg>
            </button>
          </div>
          <div className="px-6 py-5">{children}</div>
        </div>
      </div>
    </div>
  );
}
