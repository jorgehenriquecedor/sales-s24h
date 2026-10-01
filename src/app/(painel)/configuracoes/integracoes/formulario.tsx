"use client";
import { useActionState, useEffect, useState } from "react";
import Image from "next/image";
import { salvarIntegracaoAsaas, type ResultadoConfiguracao } from "@/actions/configuracoes";
import { Botao, Campo, Cartao, Rotulo, Selecao } from "@/components/ui";
import { Modal } from "@/components/modal";

export function FormularioIntegracao({ configuracao }: { configuracao: { ativa: boolean; ambiente: string | null; email: string | null } | null }) {
  const [aberta, setAberta] = useState(false);
  const [selecionada, setSelecionada] = useState(false);
  const [aviso, setAviso] = useState(0);
  const [estado, acao, pendente] = useActionState<ResultadoConfiguracao, FormData>(async (anterior, dados) => {
    const resposta = await salvarIntegracaoAsaas(anterior, dados);
    if (resposta.ok) { setAberta(false); setAviso(Date.now()); }
    return resposta;
  }, {});
  useEffect(() => { if (!aviso) return; const timer = window.setTimeout(() => setAviso(0), 3000); return () => window.clearTimeout(timer); }, [aviso]);
  return <>
    {aviso > 0 && <div role="status" className="rounded-xl bg-ok-fraco px-4 py-3 text-sm font-medium text-ok">Integração confirmada</div>}
    <Cartao className="max-w-2xl p-6"><div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="serif text-xl text-tinta">Integrações conectadas</h2><p className="mt-1 text-sm text-neutro">{configuracao?.ativa ? `Asaas conectado (${configuracao.ambiente === "producao" ? "produção" : "sandbox"}).` : "Nenhuma integração configurada."}</p></div><Botao onClick={() => { setSelecionada(Boolean(configuracao?.ativa)); setAberta(true); }}>{configuracao?.ativa ? "Editar integração" : "Adicionar nova integração"}</Botao></div></Cartao>
    <Modal aberto={aberta} aoFechar={() => { if (!pendente) setAberta(false); }} titulo={selecionada ? "Conectar Asaas" : "Adicionar integração"} descricao={selecionada ? "Informe os dados da sua conta. O painel configurará a confirmação automática dos pagamentos." : "Selecione o serviço que deseja conectar."} largura="max-w-xl">
      {!selecionada ? <button type="button" onClick={() => setSelecionada(true)} className="flex w-full flex-wrap items-center gap-4 rounded-xl border border-borda bg-papel p-6 text-left hover:border-brasa"><Image src="/asaas.svg" alt="Asaas" width={140} height={24} className="box-content rounded-lg bg-[#0030b9] p-4" /><span className="text-sm text-neutro">Pagamentos e checkouts →</span></button> : <form action={acao} className="space-y-4">
        <Image src="/asaas.svg" alt="Asaas" width={140} height={24} className="mb-6 box-content rounded-lg bg-[#0030b9] p-4" />
        <div><Rotulo htmlFor="ambiente">Ambiente</Rotulo><Selecao id="ambiente" name="ambiente" defaultValue={configuracao?.ambiente ?? "sandbox"}><option value="sandbox">Sandbox (testes)</option><option value="producao">Produção</option></Selecao></div>
        <div><Rotulo htmlFor="api_key">Chave de API</Rotulo><Campo id="api_key" name="api_key" type="password" required={!configuracao?.ativa} placeholder={configuracao?.ativa ? "Deixe vazio para manter a chave salva" : "Cole a chave do Asaas"} autoComplete="off" /></div>
        <div><Rotulo htmlFor="webhook_token" dica="opcional">Token do webhook</Rotulo><Campo id="webhook_token" name="webhook_token" type="password" placeholder={configuracao?.ativa ? "Deixe vazio para manter o token salvo" : "Será gerado automaticamente"} autoComplete="off" /></div>
        <div><Rotulo htmlFor="email">E-mail para avisos do webhook</Rotulo><Campo id="email" name="email" type="email" required defaultValue={configuracao?.email ?? ""} placeholder="financeiro@empresa.com" /></div>
        <p className="text-xs text-neutro">Ao confirmar, o painel conecta sua conta e configura o recebimento das confirmações de pagamento. As chaves salvas não são exibidas novamente.</p>
        {estado.erro && <div role="alert" className="rounded-xl bg-brasa-fraco px-4 py-3 text-sm text-brasa-escuro">{estado.erro}</div>}
        <div className="flex justify-end gap-2"><Botao type="button" variante="secundario" disabled={pendente} onClick={() => setAberta(false)}>Cancelar</Botao><Botao type="submit" disabled={pendente}>{pendente ? "Conectando..." : "Confirmar"}</Botao></div>
      </form>}
    </Modal>
  </>;
}
