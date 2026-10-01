"use client";
import { useActionState, useEffect, useState } from "react";
import { criarLogin, type ResultadoConfiguracao } from "@/actions/configuracoes";
import { Botao, Campo, Cartao, Rotulo } from "@/components/ui";
import { IconeCadeado } from "@/components/icones";

export function FormularioLogin({ usuarios }: { usuarios: { id: string; email: string; criado: string }[] }) {
  const [senha, setSenha] = useState("");
  const [aviso, setAviso] = useState(0);
  const [estado, acao, pendente] = useActionState<ResultadoConfiguracao, FormData>(async (anterior, dados) => {
    const resposta = await criarLogin(anterior, dados);
    if (resposta.ok) { setAviso(Date.now()); setSenha(""); }
    return resposta;
  }, {});
  useEffect(() => { if (!aviso) return; const timer = window.setTimeout(() => setAviso(0), 3000); return () => window.clearTimeout(timer); }, [aviso]);
  return <div className="space-y-5">
    {aviso > 0 && <div role="status" className="rounded-xl bg-ok-fraco px-4 py-3 text-sm font-medium text-ok">Login confirmado</div>}
    {estado.erro && <div role="alert" className="rounded-xl bg-brasa-fraco px-4 py-3 text-sm text-brasa-escuro">{estado.erro}</div>}
    {estado.senha && <div className="rounded-xl border border-borda bg-white px-4 py-3 text-sm text-tinta"><p>Acesso criado para {estado.email}</p><strong>Senha:</strong> <code className="select-all break-all">{estado.senha}</code><br /><span className="text-xs text-neutro">Copie e envie esta senha à pessoa. Ela não será exibida novamente ao sair desta página.</span></div>}
    <Cartao className="max-w-2xl p-6">
      <div className="mb-5 flex items-center gap-3"><IconeCadeado className="h-6 w-6 text-brasa" /><div><h2 className="serif text-xl text-tinta">Liberar novo acesso</h2><p className="text-sm text-neutro">A senha é gerada automaticamente se você deixar o campo vazio.</p></div></div>
      <form action={acao} className="space-y-4">
        <div><Rotulo htmlFor="email">E-mail</Rotulo><Campo id="email" name="email" type="email" required placeholder="secretaria@exemplo.com" /></div>
        <div><Rotulo htmlFor="senha">Senha inicial</Rotulo><div className="flex flex-wrap gap-2"><Campo id="senha" name="senha" type="text" readOnly value={senha} className="min-w-48 flex-1" placeholder="Gerada ao confirmar" autoComplete="off" /><Botao type="button" variante="secundario" disabled={pendente} onClick={() => setSenha(`Aa1!${crypto.randomUUID().replaceAll("-", "")}`)}>Gerar senha</Botao></div></div>
        <Botao type="submit" disabled={pendente}>{pendente ? "Confirmando..." : "Confirmar login"}</Botao>
      </form>
    </Cartao>
    <Cartao className="p-6"><h2 className="serif text-xl text-tinta">Acessos liberados</h2><div className="mt-4 divide-y divide-borda">{usuarios.map((u) => <div className="flex flex-wrap justify-between gap-2 py-3 text-sm" key={u.id}><span className="text-tinta">{u.email}</span><span className="text-neutro">Criado em {new Date(u.criado).toLocaleDateString("pt-BR")}</span></div>)}</div></Cartao>
  </div>;
}
