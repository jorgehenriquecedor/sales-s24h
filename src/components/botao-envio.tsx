"use client";

import { useFormStatus } from "react-dom";
import { Botao } from "./ui";

export function BotaoEnvio({
  children,
  carregando = "Salvando…",
  variante = "primario",
  className = "",
}: {
  children: React.ReactNode;
  carregando?: string;
  variante?: "primario" | "secundario" | "fantasma" | "perigo";
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Botao type="submit" variante={variante} disabled={pending} className={className}>
      {pending ? carregando : children}
    </Botao>
  );
}
