"use client";

import { useActionState, useState } from "react";
import {
  alternarArquivoTurma,
  atualizarTurma,
  criarTurma,
  excluirTurma,
} from "@/actions/turmas";
import type { Resultado } from "@/actions/produtos";
import { BotaoEnvio } from "@/components/botao-envio";
import {
  IconeArquivar,
  IconeEditar,
  IconeLixeira,
  IconeMais,
  IconeVazio,
} from "@/components/icones";
import { Modal } from "@/components/modal";
import { Aviso, Botao, Cartao, Campo, EstadoVazio, Rotulo } from "@/components/ui";
import type { Turma } from "@/lib/types";

const VAZIO: Resultado = {};

export function GerenciadorTurmas({
  turmas,
  vendasPorTurma,
}: {
  turmas: Turma[];
  vendasPorTurma: Record<string, number>;
}) {
  const [novaAberta, setNovaAberta] = useState(false);
  const [emEdicao, setEmEdicao] = useState<Turma | null>(null);
  const [aExcluir, setAExcluir] = useState<Turma | null>(null);

  const [estadoArquivo, acaoArquivo] = useActionState(
    alternarArquivoTurma,
    VAZIO,
  );

  const ativas = turmas.filter((t) => !t.arquivado);
  const arquivadas = turmas.filter((t) => t.arquivado);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-neutro">
          {ativas.length} turma{ativas.length === 1 ? "" : "s"} ativa
          {ativas.length === 1 ? "" : "s"}
          {arquivadas.length > 0 &&
            `, mais ${arquivadas.length} arquivada${arquivadas.length === 1 ? "" : "s"}`}
        </p>
        <Botao onClick={() => setNovaAberta(true)}>
          <IconeMais className="h-4 w-4" />
          Nova turma
        </Botao>
      </div>

      {estadoArquivo.erro && <Aviso>{estadoArquivo.erro}</Aviso>}

      <Cartao>
        {turmas.length === 0 ? (
          <EstadoVazio
            icone={<IconeVazio className="h-6 w-6" />}
            titulo="Nenhuma turma cadastrada"
            descricao="Cadastre a primeira turma para conseguir registrar vendas e separar os relatórios por turma."
            acao={
              <Botao onClick={() => setNovaAberta(true)}>
                <IconeMais className="h-4 w-4" />
                Cadastrar turma
              </Botao>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-borda text-left">
                  <th className="px-5 py-3 font-medium text-neutro">Turma</th>
                  <th className="px-5 py-3 font-medium text-neutro">Vendas</th>
                  <th className="px-5 py-3 text-right font-medium text-neutro">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody>
                {turmas.map((turma) => (
                  <tr key={turma.id} className="border-b border-borda last:border-0">
                    <td className="px-5 py-3.5">
                      <span className="font-medium text-tinta">{turma.nome}</span>
                      {turma.arquivado && (
                        <span className="ml-2 rounded-full bg-papel px-2 py-0.5 text-xs font-medium text-neutro">
                          Arquivada
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 tabular-nums text-neutro">
                      {vendasPorTurma[turma.id] ?? 0}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setEmEdicao(turma)}
                          title="Editar"
                          className="rounded-lg p-2 text-neutro transition-colors hover:bg-papel hover:text-tinta"
                        >
                          <IconeEditar className="h-[17px] w-[17px]" />
                          <span className="sr-only">Editar {turma.nome}</span>
                        </button>

                        <form action={acaoArquivo}>
                          <input type="hidden" name="id" value={turma.id} />
                          <input
                            type="hidden"
                            name="arquivar"
                            value={turma.arquivado ? "0" : "1"}
                          />
                          <button
                            type="submit"
                            title={turma.arquivado ? "Reativar" : "Arquivar"}
                            className="rounded-lg p-2 text-neutro transition-colors hover:bg-papel hover:text-tinta"
                          >
                            <IconeArquivar className="h-[17px] w-[17px]" />
                            <span className="sr-only">
                              {turma.arquivado ? "Reativar" : "Arquivar"} {turma.nome}
                            </span>
                          </button>
                        </form>

                        <button
                          type="button"
                          onClick={() => setAExcluir(turma)}
                          title="Excluir"
                          className="rounded-lg p-2 text-neutro transition-colors hover:bg-brasa-fraco hover:text-brasa"
                        >
                          <IconeLixeira className="h-[17px] w-[17px]" />
                          <span className="sr-only">Excluir {turma.nome}</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Cartao>

      {turmas.length > 0 && (
        <p className="text-xs text-neutro">
          Turmas com vendas registradas não podem ser excluídas — arquive-as para
          tirá-las do formulário de nova venda sem mexer no histórico nem nos
          relatórios.
        </p>
      )}

      <ModalTurma
        aberto={novaAberta}
        aoFechar={() => setNovaAberta(false)}
        turma={null}
      />
      <ModalTurma
        aberto={emEdicao !== null}
        aoFechar={() => setEmEdicao(null)}
        turma={emEdicao}
      />
      <ModalExcluirTurma
        turma={aExcluir}
        vendas={aExcluir ? (vendasPorTurma[aExcluir.id] ?? 0) : 0}
        aoFechar={() => setAExcluir(null)}
      />
    </div>
  );
}

function ModalTurma({
  aberto,
  aoFechar,
  turma,
}: {
  aberto: boolean;
  aoFechar: () => void;
  turma: Turma | null;
}) {
  const editando = turma !== null;
  const [estado, acao] = useActionState(
    async (anterior: Resultado, dados: FormData) => {
      const resultado = await (editando ? atualizarTurma : criarTurma)(
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
      titulo={editando ? "Editar turma" : "Nova turma"}
      largura="max-w-md"
    >
      <form action={acao} className="space-y-4">
        {turma && <input type="hidden" name="id" value={turma.id} />}

        <div>
          <Rotulo htmlFor={`nome-turma-${turma?.id ?? "nova"}`}>Nome</Rotulo>
          <Campo
            id={`nome-turma-${turma?.id ?? "nova"}`}
            name="nome"
            required
            maxLength={160}
            defaultValue={turma?.nome ?? ""}
            placeholder="Ex.: Turma Janeiro 2026"
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

function ModalExcluirTurma({
  turma,
  vendas,
  aoFechar,
}: {
  turma: Turma | null;
  vendas: number;
  aoFechar: () => void;
}) {
  const [estado, acao] = useActionState(
    async (anterior: Resultado, dados: FormData) => {
      const resultado = await excluirTurma(anterior, dados);
      if (resultado.ok) aoFechar();
      return resultado;
    },
    VAZIO,
  );

  const bloqueado = vendas > 0;

  return (
    <Modal
      aberto={turma !== null}
      aoFechar={aoFechar}
      titulo="Excluir turma"
      largura="max-w-md"
    >
      {bloqueado ? (
        <div className="space-y-4">
          <Aviso>
            <strong className="font-semibold">{turma?.nome}</strong> está em{" "}
            {vendas} venda{vendas === 1 ? "" : "s"} registrada
            {vendas === 1 ? "" : "s"}. Excluir apagaria histórico, então essa
            ação fica bloqueada.
          </Aviso>
          <p className="text-sm text-neutro">
            Para tirá-la do formulário de novas vendas sem perder nada, use{" "}
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
          <input type="hidden" name="id" value={turma?.id ?? ""} />
          <p className="text-sm text-neutro">
            Excluir <strong className="text-tinta">{turma?.nome}</strong>? Nenhuma
            venda usa esta turma, então nada de histórico se perde.
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
