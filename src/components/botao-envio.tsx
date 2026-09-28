"use client";

import { useFormStatus } from "react-dom";
import { Botao } from "./ui";

export function BotaoEnvio({
  children,
  carregando = "Salvando…",
  variante = "primario",
  className = "",
  disabled = false,
}: {
  children: React.ReactNode;
  carregando?: string;
  variante?: "primario" | "secundario" | "fantasma" | "perigo";
  className?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <Botao type="submit" variante={variante} disabled={pending || disabled} className={className}>
      {pending ? carregando : children}
    </Botao>
  );
}
