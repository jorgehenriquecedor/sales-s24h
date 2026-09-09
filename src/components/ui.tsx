import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import type { StatusVenda } from "@/lib/types";

/* ------------------------------------------------------------------ */
/* Botões                                                              */
/* ------------------------------------------------------------------ */

type Variante = "primario" | "secundario" | "fantasma" | "perigo";

const VARIANTES: Record<Variante, string> = {
  primario:
    "bg-brasa text-white border border-transparent hover:bg-brasa-escuro shadow-sm",
  secundario:
    "bg-white text-tinta border border-borda-forte hover:bg-papel hover:border-neutro-fraco",
  fantasma:
    "bg-transparent text-neutro border border-transparent hover:bg-papel hover:text-tinta",
  perigo:
    "bg-white text-brasa border border-brasa/30 hover:bg-brasa-fraco hover:border-brasa/50",
};

const BASE_BOTAO =
  "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-55";

export function Botao({
  variante = "primario",
  className = "",
  ...props
}: ComponentProps<"button"> & { variante?: Variante }) {
  return (
    <button
      {...props}
      className={`${BASE_BOTAO} ${VARIANTES[variante]} ${className}`}
    />
  );
}

export function BotaoLink({
  variante = "primario",
  className = "",
  ...props
}: ComponentProps<typeof Link> & { variante?: Variante }) {
  return (
    <Link
      {...props}
      className={`${BASE_BOTAO} ${VARIANTES[variante]} ${className}`}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Pílulas de filtro                                                   */
/* ------------------------------------------------------------------ */

const BASE_PILULA =
  "inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap";

export function pilulaClasses(ativa: boolean) {
  return ativa
    ? `${BASE_PILULA} border-brasa bg-brasa text-white`
    : `${BASE_PILULA} border-borda-forte bg-white text-neutro hover:border-neutro-fraco hover:text-tinta`;
}

export function PilulaLink({
  ativa,
  href,
  children,
}: {
  ativa: boolean;
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={ativa ? "true" : undefined}
      className={pilulaClasses(ativa)}
    >
      {children}
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/* Cartão                                                              */
/* ------------------------------------------------------------------ */

export function Cartao({
  className = "",
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`rounded-2xl border border-borda bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)] ${className}`}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Cabeçalho de página                                                 */
/* ------------------------------------------------------------------ */

export function CabecalhoPagina({
  titulo,
  descricao,
  acoes,
}: {
  titulo: string;
  descricao?: string;
  acoes?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="serif text-[2.5rem] leading-[1.1] text-tinta">
          {titulo}
        </h1>
        {descricao && (
          <p className="mt-2 max-w-2xl text-[15px] text-neutro">{descricao}</p>
        )}
      </div>
      {acoes && <div className="flex shrink-0 items-center gap-2">{acoes}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Etiqueta de status do comprovante                                   */
/* ------------------------------------------------------------------ */

export function EtiquetaStatus({ status }: { status: StatusVenda }) {
  const anexado = status === "comprovante_anexado";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${
        anexado
          ? "bg-ok-fraco text-ok"
          : "bg-pendente-fraco text-pendente"
      }`}
    >
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 rounded-full ${anexado ? "bg-ok" : "bg-pendente"}`}
      />
      {anexado ? "Comprovante anexado" : "Comprovante pendente"}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Estado vazio — sempre aponta a próxima ação                          */
/* ------------------------------------------------------------------ */

export function EstadoVazio({
  icone,
  titulo,
  descricao,
  acao,
}: {
  icone: ReactNode;
  titulo: string;
  descricao: string;
  acao?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-papel text-neutro-fraco">
        {icone}
      </div>
      <p className="serif text-xl text-tinta">{titulo}</p>
      <p className="mt-2 max-w-md text-sm text-neutro">{descricao}</p>
      {acao && <div className="mt-5">{acao}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Campos de formulário                                                */
/* ------------------------------------------------------------------ */

const BASE_CAMPO =
  "w-full rounded-xl border border-borda-forte bg-white px-3.5 py-2.5 text-[15px] text-tinta transition-colors placeholder:text-neutro-fraco hover:border-neutro-fraco focus:border-brasa focus:outline-none";

export function Rotulo({
  htmlFor,
  children,
  dica,
}: {
  htmlFor: string;
  children: ReactNode;
  dica?: string;
}) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block">
      <span className="text-sm font-medium text-tinta">{children}</span>
      {dica && <span className="ml-1.5 text-xs text-neutro">{dica}</span>}
    </label>
  );
}

export function Campo({ className = "", ...props }: ComponentProps<"input">) {
  return <input {...props} className={`${BASE_CAMPO} ${className}`} />;
}

export function Selecao({ className = "", ...props }: ComponentProps<"select">) {
  return (
    <select
      {...props}
      className={`${BASE_CAMPO} appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="%23667085" stroke-width="1.7" stroke-linecap="round"><path d="m6 8.5 4 4 4-4"/></svg>')] bg-[right_0.75rem_center] bg-no-repeat pr-10 ${className}`}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Mensagens                                                           */
/* ------------------------------------------------------------------ */

export function Aviso({
  tom = "erro",
  children,
}: {
  tom?: "erro" | "info";
  children: ReactNode;
}) {
  return (
    <div
      role="alert"
      className={`rounded-xl border px-3.5 py-3 text-sm ${
        tom === "erro"
          ? "border-brasa/25 bg-brasa-fraco text-brasa-escuro"
          : "border-borda bg-papel text-neutro"
      }`}
    >
      {children}
    </div>
  );
}
