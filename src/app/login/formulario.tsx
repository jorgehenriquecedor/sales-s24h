"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { entrar, type EstadoLogin } from "@/actions/auth";
import { Aviso, Botao, Campo, Rotulo } from "@/components/ui";

function BotaoEntrar() {
  const { pending } = useFormStatus();
  return (
    <Botao type="submit" disabled={pending} className="w-full">
      {pending ? "Entrando…" : "Entrar"}
    </Botao>
  );
}

export function FormularioLogin({ destino }: { destino?: string }) {
  const [estado, acao] = useActionState<EstadoLogin, FormData>(entrar, {});

  return (
    <form action={acao} className="mt-6 space-y-4">
      {destino && <input type="hidden" name="redirect" value={destino} />}

      <div>
        <Rotulo htmlFor="email">E-mail</Rotulo>
        <Campo
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          placeholder="voce@exemplo.com"
        />
      </div>

      <div>
        <Rotulo htmlFor="senha">Senha</Rotulo>
        <Campo
          id="senha"
          name="senha"
          type="password"
          autoComplete="current-password"
          required
          placeholder="••••••••"
        />
      </div>

      {estado.erro && <Aviso>{estado.erro}</Aviso>}

      <BotaoEntrar />
    </form>
  );
}
