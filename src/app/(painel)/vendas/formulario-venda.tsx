"use client";

import { useState } from "react";
import { Aviso, Botao, Campo, Rotulo, Selecao } from "@/components/ui";
import { BotaoEnvio } from "@/components/botao-envio";
import { converterParaNumero, formatarMoeda, paraCampoValor } from "@/lib/format";
import { calcularTotal, type TipoDesconto } from "@/lib/descontos";
import type { Produto, Turma, Venda } from "@/lib/types";
import type { Resultado } from "@/actions/produtos";

function opcoesVisiveis<T extends { id: string; arquivado: boolean }>(
  itens: T[], selecionados: string[],
): T[] {
  return itens.filter((item) => !item.arquivado || selecionados.includes(item.id));
}

type Desconto = { tipo: TipoDesconto; valor: number; observacao: string };

export function FormularioVenda({
  acao, estado, venda, produtos, turmas, aoCancelar, rotuloEnvio, modoVenda,
}: {
  acao: (formData: FormData) => void;
  estado: Resultado;
  venda: Venda | null;
  produtos: Produto[];
  turmas: Turma[];
  aoCancelar: () => void;
  rotuloEnvio: string;
  modoVenda?: "manual" | "checkout";
}) {
  const [selecionados, setSelecionados] = useState<string[]>(
    venda?.itens?.length
      ? venda.itens.map((item) => item.produto_id).filter((id): id is string => !!id)
      : venda?.produto_id ? [venda.produto_id] : [],
  );
  const [desconto, setDesconto] = useState<Desconto>({
    tipo: venda?.desconto_tipo ?? "nenhum",
    valor: venda?.desconto_valor ?? 0,
    observacao: venda?.desconto_observacao ?? "",
  });
  const [editor, setEditor] = useState<"fechado" | "escolher" | "percentual" | "fixo">("fechado");
  const [valorDigitado, setValorDigitado] = useState("");
  const [observacao, setObservacao] = useState("");
  const [erroDesconto, setErroDesconto] = useState<string | null>(null);

  const produtosVisiveis = opcoesVisiveis(produtos, selecionados);
  const turmasVisiveis = opcoesVisiveis(turmas, venda?.turma_id ? [venda.turma_id] : []);
  const selecionadosOrdenados = produtosVisiveis.filter((p) => selecionados.includes(p.id));
  const precos = selecionadosOrdenados.map((p) => p.preco);
  const bruto = precos.reduce((soma, preco) => soma + preco, 0);
  const calculo = calcularTotal(precos, desconto.tipo, desconto.valor);
  const total = calculo.ok ? calculo.final : bruto;
  const prefixo = venda?.id ?? "nova";
  const comCheckout = (venda?.modo_venda ?? modoVenda) === "checkout";

  function alternarProduto(id: string) {
    setSelecionados((atual) => atual.includes(id)
      ? atual.filter((item) => item !== id) : [...atual, id]);
  }

  function escolherTipo(tipo: "percentual" | "fixo") {
    setEditor(tipo);
    setValorDigitado(desconto.tipo === tipo ? paraCampoValor(desconto.valor) : "");
    setObservacao(desconto.observacao);
    setErroDesconto(null);
  }

  function aplicarDesconto() {
    if (editor !== "percentual" && editor !== "fixo") return;
    const numero = converterParaNumero(valorDigitado);
    const previa = calcularTotal(precos, editor, numero);
    if (!previa.ok) {
      setErroDesconto(previa.erro);
      return;
    }
    setDesconto({ tipo: editor, valor: numero, observacao: observacao.trim() });
    setEditor("fechado");
    setErroDesconto(null);
  }

  return (
    <form action={acao} className="space-y-4">
      {venda && <input type="hidden" name="id" value={venda.id} />}
      {!venda && <input type="hidden" name="modo_venda" value={modoVenda ?? ""} />}
      <input type="hidden" name="desconto_tipo" value={desconto.tipo} />
      <input type="hidden" name="desconto_valor" value={desconto.valor} />
      <input type="hidden" name="desconto_observacao" value={desconto.observacao} />

      {comCheckout ? (
        <p className="rounded-xl border border-borda bg-papel p-3 text-sm text-neutro">
          O comprador preencherá nome, e-mail e telefone no Checkout Asaas.
          Esses dados serão trazidos automaticamente após a confirmação do pagamento.
        </p>
      ) : <>
      <div>
        <Rotulo htmlFor={`nome-${prefixo}`}>Nome completo do comprador</Rotulo>
        <Campo id={`nome-${prefixo}`} name="comprador_nome" required maxLength={200}
          autoComplete="off" defaultValue={venda?.comprador_nome ?? ""}
          placeholder="Ex.: Maria Souza Lima" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Rotulo htmlFor={`tel-${prefixo}`} dica="opcional">Telefone</Rotulo>
          <Campo id={`tel-${prefixo}`} name="comprador_telefone" inputMode="tel"
            maxLength={40} autoComplete="off" defaultValue={venda?.comprador_telefone ?? ""}
            placeholder="(11) 90000-0000" />
        </div>
        <div>
          <Rotulo htmlFor={`email-${prefixo}`} dica="opcional">E-mail</Rotulo>
          <Campo id={`email-${prefixo}`} name="comprador_email" type="email"
            maxLength={200} autoComplete="off" defaultValue={venda?.comprador_email ?? ""}
            placeholder="maria@exemplo.com" />
        </div>
      </div>

      </>}
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-tinta">Produtos</legend>
        <div className="grid max-h-48 gap-2 overflow-y-auto rounded-xl border border-borda-forte p-2 sm:grid-cols-2">
          {produtosVisiveis.map((produto) => (
            <label key={produto.id} className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-2 hover:bg-papel">
              <input type="checkbox" name="produto_ids" value={produto.id}
                checked={selecionados.includes(produto.id)}
                onChange={() => alternarProduto(produto.id)} className="mt-1 accent-brasa" />
              <span className="min-w-0 text-sm text-tinta">
                <span className="block break-words font-medium">{produto.nome}{produto.arquivado ? " (arquivado)" : ""}</span>
                <span className="text-xs text-neutro">{formatarMoeda(produto.preco)}</span>
              </span>
            </label>
          ))}
        </div>
        <p className="mt-1 text-xs text-neutro">Selecione um ou mais produtos. Os preços são somados automaticamente.</p>
        {venda && Math.abs(bruto - venda.valor_bruto) > 0.001 && (
          <p className="mt-1 text-xs text-pendente">Os preços cadastrados mudaram desde esta venda. Ao salvar, o valor será recalculado pelos preços atuais.</p>
        )}
      </fieldset>

      <div>
        <Rotulo htmlFor={`turma-${prefixo}`} dica={comCheckout ? "obrigatória" : "opcional"}>Turma</Rotulo>
        <Selecao id={`turma-${prefixo}`} name="turma_id" required={comCheckout} defaultValue={venda?.turma_id ?? ""}>
          <option value="">{comCheckout ? "Selecione a turma" : "Sem turma"}</option>
          {turmasVisiveis.map((turma) => (
            <option key={turma.id} value={turma.id}>
              {turma.nome}{turma.arquivado ? " (arquivada)" : ""}
            </option>
          ))}
        </Selecao>
      </div>

      <div>
        <Rotulo htmlFor={`valor-${prefixo}`}>Valor do registro</Rotulo>
        <Campo id={`valor-${prefixo}`} value={formatarMoeda(total)} readOnly
          aria-readonly="true" className="bg-papel font-semibold tabular-nums" />
        <div className="mt-1.5 flex items-center gap-2">
          <button type="button" onClick={() => setEditor(editor === "fechado" ? "escolher" : "fechado")}
            className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-borda-forte bg-white text-xs font-bold text-neutro hover:border-brasa hover:text-brasa"
            aria-label="Configurar desconto" title="Configurar desconto">$</button>
          <span className="text-xs text-neutro">Soma dos produtos: {formatarMoeda(bruto)}</span>
        </div>
        {desconto.tipo !== "nenhum" && (
          <p className="mt-1 text-xs text-brasa">
            Desconto aplicado: {desconto.tipo === "percentual" ? `${desconto.valor}%` : formatarMoeda(desconto.valor)}
            {desconto.observacao ? ` — ${desconto.observacao}` : ""}
          </p>
        )}
        {!calculo.ok && selecionados.length > 0 && <p className="mt-1 text-xs text-brasa">{calculo.erro}</p>}
      </div>

      {editor !== "fechado" && (
        <div className="space-y-3 rounded-xl border border-borda bg-papel p-3">
          <p className="text-sm font-medium text-tinta">Aplicar desconto</p>
          <div className="flex flex-wrap gap-2">
            <Botao type="button" variante={editor === "percentual" ? "primario" : "secundario"}
              onClick={() => escolherTipo("percentual")} className="text-xs">Aplicar desconto em %</Botao>
            <Botao type="button" variante={editor === "fixo" ? "primario" : "secundario"}
              onClick={() => escolherTipo("fixo")} className="text-xs">Aplicar em $</Botao>
            {desconto.tipo !== "nenhum" && (
              <Botao type="button" variante="fantasma" className="text-xs" onClick={() => {
                setDesconto({ tipo: "nenhum", valor: 0, observacao: "" });
                setEditor("fechado");
              }}>Remover desconto</Botao>
            )}
          </div>
          {(editor === "percentual" || editor === "fixo") && (
            <>
              <div>
                <Rotulo htmlFor={`desconto-${prefixo}`}>
                  {editor === "percentual" ? "Desconto em %" : "Desconto em R$"}
                </Rotulo>
                <Campo id={`desconto-${prefixo}`} inputMode="decimal" value={valorDigitado}
                  onChange={(e) => { setValorDigitado(e.target.value); setErroDesconto(null); }}
                  placeholder={editor === "percentual" ? "Ex.: 10" : "Ex.: 50,00"} />
              </div>
              {valorDigitado && (() => {
                const previa = calcularTotal(precos, editor, converterParaNumero(valorDigitado));
                return previa.ok ? <p className="text-sm font-medium text-tinta">O novo valor do registro será de {formatarMoeda(previa.final)}</p> : null;
              })()}
              <div>
                <Rotulo htmlFor={`obs-${prefixo}`} dica="opcional">Observação</Rotulo>
                <textarea id={`obs-${prefixo}`} value={observacao} maxLength={1000}
                  onChange={(e) => setObservacao(e.target.value)}
                  placeholder="Motivo do desconto"
                  className="min-h-20 w-full rounded-xl border border-borda-forte bg-white px-3.5 py-2.5 text-sm text-tinta focus:border-brasa focus:outline-none" />
              </div>
              {erroDesconto && <Aviso>{erroDesconto}</Aviso>}
              <Botao type="button" onClick={aplicarDesconto}>Aplicar desconto</Botao>
            </>
          )}
        </div>
      )}

      {estado.erro && <Aviso>{estado.erro}</Aviso>}
      {editor !== "fechado" && <p className="text-xs text-neutro">Confirme o desconto ou feche esta área para salvar a venda.</p>}
      <div className="flex justify-end gap-2 pt-1">
        <Botao type="button" variante="secundario" onClick={aoCancelar}>Cancelar</Botao>
        <BotaoEnvio disabled={!calculo.ok || editor !== "fechado"}>{rotuloEnvio}</BotaoEnvio>
      </div>
    </form>
  );
}
