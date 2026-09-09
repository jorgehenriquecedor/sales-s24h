"use client";

import { useActionState, useState } from "react";
import {
  alternarArquivoProduto,
  atualizarProduto,
  criarProduto,
  excluirProduto,
  type Resultado,
} from "@/actions/produtos";
import { BotaoEnvio } from "@/components/botao-envio";
import { IconeArquivar, IconeEditar, IconeLixeira, IconeMais, IconeVazio } from "@/components/icones";
import { Modal } from "@/components/modal";
import {
  Aviso,
  Botao,
  Cartao,
  Campo,
  EstadoVazio,
  Rotulo,
} from "@/components/ui";
import { formatarMoeda, paraCampoValor } from "@/lib/format";
import type { Produto } from "@/lib/types";

const VAZIO: Resultado = {};

export function GerenciadorProdutos({
  produtos,
  vendasPorProduto,
}: {
  produtos: Produto[];
  vendasPorProduto: Record<string, number>;
}) {
  const [novoAberto, setNovoAberto] = useState(false);
  const [emEdicao, setEmEdicao] = useState<Produto | null>(null);
  const [aExcluir, setAExcluir] = useState<Produto | null>(null);

  const [estadoArquivo, acaoArquivo] = useActionState(
    alternarArquivoProduto,
    VAZIO,
  );

  const ativos = produtos.filter((p) => !p.arquivado);
  const arquivados = produtos.filter((p) => p.arquivado);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-neutro">
          {ativos.length} produto{ativos.length === 1 ? "" : "s"} ativo
          {ativos.length === 1 ? "" : "s"}
          {arquivados.length > 0 &&
            `, mais ${arquivados.length} arquivado${arquivados.length === 1 ? "" : "s"}`}
        </p>
        <Botao onClick={() => setNovoAberto(true)}>
          <IconeMais className="h-4 w-4" />
          Novo produto
        </Botao>
      </div>

      {estadoArquivo.erro && <Aviso>{estadoArquivo.erro}</Aviso>}

      <Cartao>
        {produtos.length === 0 ? (
          <EstadoVazio
            icone={<IconeVazio className="h-6 w-6" />}
            titulo="Nenhum produto cadastrado"
            descricao="Cadastre o primeiro curso ou produto para conseguir registrar vendas. O preço definido aqui vira o valor sugerido de cada venda."
            acao={
              <Botao onClick={() => setNovoAberto(true)}>
                <IconeMais className="h-4 w-4" />
                Cadastrar produto
              </Botao>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-borda text-left">
                  <th className="px-5 py-3 font-medium text-neutro">Produto</th>
                  <th className="px-5 py-3 font-medium text-neutro">Preço</th>
                  <th className="px-5 py-3 font-medium text-neutro">Vendas</th>
                  <th className="px-5 py-3 text-right font-medium text-neutro">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody>
                {produtos.map((produto) => {
                  const vendas = vendasPorProduto[produto.id] ?? 0;
                  return (
                    <tr
                      key={produto.id}
                      className="border-b border-borda last:border-0"
                    >
                      <td className="px-5 py-3.5">
                        <span className="font-medium text-tinta">
                          {produto.nome}
                        </span>
                        {produto.arquivado && (
                          <span className="ml-2 rounded-full bg-papel px-2 py-0.5 text-xs font-medium text-neutro">
                            Arquivado
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 tabular-nums text-tinta">
                        {formatarMoeda(produto.preco)}
                      </td>
                      <td className="px-5 py-3.5 tabular-nums text-neutro">
                        {vendas}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setEmEdicao(produto)}
                            title="Editar"
                            className="rounded-lg p-2 text-neutro transition-colors hover:bg-papel hover:text-tinta"
                          >
                            <IconeEditar className="h-[17px] w-[17px]" />
                            <span className="sr-only">Editar {produto.nome}</span>
                          </button>

                          <form action={acaoArquivo}>
                            <input type="hidden" name="id" value={produto.id} />
                            <input
                              type="hidden"
                              name="arquivar"
                              value={produto.arquivado ? "0" : "1"}
                            />
                            <button
                              type="submit"
                              title={produto.arquivado ? "Reativar" : "Arquivar"}
                              className="rounded-lg p-2 text-neutro transition-colors hover:bg-papel hover:text-tinta"
                            >
                              <IconeArquivar className="h-[17px] w-[17px]" />
                              <span className="sr-only">
                                {produto.arquivado ? "Reativar" : "Arquivar"}{" "}
                                {produto.nome}
                              </span>
                            </button>
                          </form>

                          <button
                            type="button"
                            onClick={() => setAExcluir(produto)}
                            title="Excluir"
                            className="rounded-lg p-2 text-neutro transition-colors hover:bg-brasa-fraco hover:text-brasa"
                          >
                            <IconeLixeira className="h-[17px] w-[17px]" />
                            <span className="sr-only">Excluir {produto.nome}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Cartao>

      {produtos.length > 0 && (
        <p className="text-xs text-neutro">
          Produtos com vendas registradas não podem ser excluídos — arquive-os
          para tirá-los do formulário de nova venda sem mexer no histórico nem
          nos relatórios.
        </p>
      )}

      <ModalProduto
        aberto={novoAberto}
        aoFechar={() => setNovoAberto(false)}
        produto={null}
      />
      <ModalProduto
        aberto={emEdicao !== null}
        aoFechar={() => setEmEdicao(null)}
        produto={emEdicao}
      />
      <ModalExcluir
        produto={aExcluir}
        vendas={aExcluir ? (vendasPorProduto[aExcluir.id] ?? 0) : 0}
        aoFechar={() => setAExcluir(null)}
      />
    </div>
  );
}

function ModalProduto({
  aberto,
  aoFechar,
  produto,
}: {
  aberto: boolean;
  aoFechar: () => void;
  produto: Produto | null;
}) {
  const editando = produto !== null;
  const [estado, acao] = useActionState(
    async (anterior: Resultado, dados: FormData) => {
      const resultado = await (editando ? atualizarProduto : criarProduto)(
        anterior,
        dados,
      );
      if (resultado.ok) aoFechar();
      return resultado;
    },
    VAZIO,
  );

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo={editando ? "Editar produto" : "Novo produto"}
      descricao={
        editando
          ? "Alterar o preço aqui não muda o valor de vendas já registradas."
          : "O preço vira o valor sugerido ao registrar uma venda deste produto."
      }
    >
      <form action={acao} className="space-y-4">
        {produto && <input type="hidden" name="id" value={produto.id} />}

        <div>
          <Rotulo htmlFor={`nome-${produto?.id ?? "novo"}`}>Nome</Rotulo>
          <Campo
            id={`nome-${produto?.id ?? "novo"}`}
            name="nome"
            required
            maxLength={160}
            defaultValue={produto?.nome ?? ""}
            placeholder="Ex.: Mentoria Prova Oral"
          />
        </div>

        <div>
          <Rotulo htmlFor={`preco-${produto?.id ?? "novo"}`} dica="em reais">
            Preço
          </Rotulo>
          <Campo
            id={`preco-${produto?.id ?? "novo"}`}
            name="preco"
            inputMode="decimal"
            required
            defaultValue={produto ? paraCampoValor(produto.preco) : ""}
            placeholder="2.997,00"
          />
        </div>

        {estado.erro && <Aviso>{estado.erro}</Aviso>}

        <div className="flex justify-end gap-2 pt-1">
          <Botao type="button" variante="secundario" onClick={aoFechar}>
            Cancelar
          </Botao>
          <BotaoEnvio>{editando ? "Salvar" : "Cadastrar"}</BotaoEnvio>
        </div>
      </form>
    </Modal>
  );
}

function ModalExcluir({
  produto,
  vendas,
  aoFechar,
}: {
  produto: Produto | null;
  vendas: number;
  aoFechar: () => void;
}) {
  const [estado, acao] = useActionState(
    async (anterior: Resultado, dados: FormData) => {
      const resultado = await excluirProduto(anterior, dados);
      if (resultado.ok) aoFechar();
      return resultado;
    },
    VAZIO,
  );

  const bloqueado = vendas > 0;

  return (
    <Modal
      aberto={produto !== null}
      aoFechar={aoFechar}
      titulo="Excluir produto"
      largura="max-w-md"
    >
      {bloqueado ? (
        <div className="space-y-4">
          <Aviso>
            <strong className="font-semibold">{produto?.nome}</strong> está em{" "}
            {vendas} venda{vendas === 1 ? "" : "s"} registrada
            {vendas === 1 ? "" : "s"}. Excluir apagaria histórico, então essa
            ação fica bloqueada.
          </Aviso>
          <p className="text-sm text-neutro">
            Para tirá-lo do formulário de novas vendas sem perder nada, use{" "}
            <span className="font-medium text-tinta">Arquivar</span> na listagem.
          </p>
          <div className="flex justify-end">
            <Botao variante="secundario" onClick={aoFechar}>
              Entendi
            </Botao>
          </div>
        </div>
      ) : (
        <form action={acao} className="space-y-4">
          <input type="hidden" name="id" value={produto?.id ?? ""} />
          <p className="text-sm text-neutro">
            Excluir <strong className="text-tinta">{produto?.nome}</strong>?
            Nenhuma venda usa este produto, então nada de histórico se perde.
          </p>
          {estado.erro && <Aviso>{estado.erro}</Aviso>}
          <div className="flex justify-end gap-2">
            <Botao type="button" variante="secundario" onClick={aoFechar}>
              Cancelar
            </Botao>
            <BotaoEnvio variante="perigo" carregando="Excluindo…">
              Excluir
            </BotaoEnvio>
          </div>
        </form>
      )}
    </Modal>
  );
}
