"use client";

import { useActionState, useMemo, useState } from "react";
import { criarVenda } from "@/actions/vendas";
import type { Resultado } from "@/actions/produtos";
import { IconeMais, IconeVazio } from "@/components/icones";
import { Modal } from "@/components/modal";
import {
  Botao,
  BotaoLink,
  Cartao,
  Campo,
  EstadoVazio,
  EtiquetaStatus,
  pilulaClasses,
} from "@/components/ui";
import { formatarData, formatarMoeda } from "@/lib/format";
import type { Produto, Turma, Venda } from "@/lib/types";
import { FormularioVenda } from "./formulario-venda";
import { DetalheVenda } from "./detalhe";

const VAZIO: Resultado = {};

type FiltroStatus = "todas" | "pendentes" | "anexadas";

const FILTROS: { chave: FiltroStatus; rotulo: string }[] = [
  { chave: "todas", rotulo: "Todas" },
  { chave: "pendentes", rotulo: "Comprovante pendente" },
  { chave: "anexadas", rotulo: "Comprovante anexado" },
];

export function ListaVendas({
  vendas,
  produtos,
  turmas,
}: {
  vendas: Venda[];
  produtos: Produto[];
  turmas: Turma[];
}) {
  const [novaAberta, setNovaAberta] = useState(false);
  const [abertaId, setAbertaId] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<FiltroStatus>("todas");
  const [busca, setBusca] = useState("");

  // A venda aberta vem sempre da lista fresca do servidor, para o modal
  // refletir na hora o que uma ação acabou de mudar.
  const vendaAberta = abertaId
    ? (vendas.find((v) => v.id === abertaId) ?? null)
    : null;

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();

    return vendas.filter((venda) => {
      if (filtro === "pendentes" && venda.status !== "comprovante_nao_anexado") {
        return false;
      }
      if (filtro === "anexadas" && venda.status !== "comprovante_anexado") {
        return false;
      }
      if (!termo) return true;

      return [
        venda.comprador_nome,
        venda.comprador_email,
        venda.comprador_telefone,
        venda.produto_nome,
        venda.turma_nome,
      ]
        .join(" ")
        .toLowerCase()
        .includes(termo);
    });
  }, [vendas, filtro, busca]);

  const pendentes = vendas.filter(
    (v) => v.status === "comprovante_nao_anexado",
  ).length;

  const semCadastros = produtos.length === 0 || turmas.length === 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {FILTROS.map((item) => (
            <button
              key={item.chave}
              type="button"
              onClick={() => setFiltro(item.chave)}
              className={pilulaClasses(filtro === item.chave)}
            >
              {item.rotulo}
              {item.chave === "pendentes" && pendentes > 0 && (
                <span
                  className={`rounded-full px-1.5 text-xs font-semibold ${
                    filtro === "pendentes"
                      ? "bg-white/20 text-white"
                      : "bg-pendente-fraco text-pendente"
                  }`}
                >
                  {pendentes}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Campo
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar comprador, produto…"
            aria-label="Buscar vendas"
            className="w-56"
          />
          <Botao
            onClick={() => setNovaAberta(true)}
            disabled={semCadastros}
            title={
              semCadastros
                ? "Cadastre ao menos um produto e uma turma antes"
                : undefined
            }
          >
            <IconeMais className="h-4 w-4" />
            Nova venda
          </Botao>
        </div>
      </div>

      <Cartao>
        {vendas.length === 0 ? (
          <EstadoVazio
            icone={<IconeVazio className="h-6 w-6" />}
            titulo="Nenhuma venda registrada"
            descricao={
              semCadastros
                ? "Antes de registrar a primeira venda, cadastre pelo menos um produto e uma turma."
                : "Registre a primeira venda fechada pelo link de pagamento para começar a acompanhar os comprovantes."
            }
            acao={
              semCadastros ? (
                <div className="flex gap-2">
                  {produtos.length === 0 && (
                    <BotaoLink href="/produtos">Cadastrar produto</BotaoLink>
                  )}
                  {turmas.length === 0 && (
                    <BotaoLink
                      href="/turmas"
                      variante={produtos.length === 0 ? "secundario" : "primario"}
                    >
                      Cadastrar turma
                    </BotaoLink>
                  )}
                </div>
              ) : (
                <Botao onClick={() => setNovaAberta(true)}>
                  <IconeMais className="h-4 w-4" />
                  Registrar venda
                </Botao>
              )
            }
          />
        ) : visiveis.length === 0 ? (
          <EstadoVazio
            icone={<IconeVazio className="h-6 w-6" />}
            titulo="Nenhuma venda com esses filtros"
            descricao="Ajuste a busca ou volte para “Todas” para ver a lista completa."
            acao={
              <Botao
                variante="secundario"
                onClick={() => {
                  setFiltro("todas");
                  setBusca("");
                }}
              >
                Limpar filtros
              </Botao>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b border-borda text-left">
                  <th className="px-5 py-3 font-medium text-neutro">Comprador</th>
                  <th className="px-5 py-3 font-medium text-neutro">Produto</th>
                  <th className="px-5 py-3 font-medium text-neutro">Turma</th>
                  <th className="px-5 py-3 text-right font-medium text-neutro">
                    Valor
                  </th>
                  <th className="px-5 py-3 font-medium text-neutro">Data</th>
                  <th className="px-5 py-3 font-medium text-neutro">Comprovante</th>
                </tr>
              </thead>
              <tbody>
                {visiveis.map((venda) => (
                  <tr
                    key={venda.id}
                    tabIndex={0}
                    role="button"
                    onClick={() => setAbertaId(venda.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setAbertaId(venda.id);
                      }
                    }}
                    className="cursor-pointer border-b border-borda transition-colors last:border-0 hover:bg-papel"
                  >
                    <td className="px-5 py-3.5">
                      <span className="font-medium text-tinta">
                        {venda.comprador_nome}
                      </span>
                      {venda.comprador_email && (
                        <span className="mt-0.5 block text-xs text-neutro">
                          {venda.comprador_email}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-tinta">{venda.produto_nome}</td>
                    <td className="px-5 py-3.5 text-neutro">{venda.turma_nome}</td>
                    <td className="px-5 py-3.5 text-right font-medium tabular-nums text-tinta">
                      {formatarMoeda(venda.valor)}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap tabular-nums text-neutro">
                      {formatarData(venda.created_at)}
                    </td>
                    <td className="px-5 py-3.5">
                      <EtiquetaStatus status={venda.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Cartao>

      {visiveis.length > 0 && (
        <p className="text-xs text-neutro">
          Clique em uma linha para ver todos os dados, anexar o comprovante ou
          editar a venda.
        </p>
      )}

      <ModalNovaVenda
        aberto={novaAberta}
        aoFechar={() => setNovaAberta(false)}
        produtos={produtos}
        turmas={turmas}
      />

      <DetalheVenda
        key={vendaAberta?.id ?? "nenhuma"}
        venda={vendaAberta}
        produtos={produtos}
        turmas={turmas}
        aoFechar={() => setAbertaId(null)}
      />
    </div>
  );
}

function ModalNovaVenda({
  aberto,
  aoFechar,
  produtos,
  turmas,
}: {
  aberto: boolean;
  aoFechar: () => void;
  produtos: Produto[];
  turmas: Turma[];
}) {
  const [estado, acao] = useActionState(
    async (anterior: Resultado, dados: FormData) => {
      const resultado = await criarVenda(anterior, dados);
      if (resultado.ok) aoFechar();
      return resultado;
    },
    VAZIO,
  );

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Nova venda"
      descricao="A venda entra como comprovante pendente. O anexo é feito na tela de detalhes."
      largura="max-w-2xl"
    >
      {aberto && (
        <FormularioVenda
          acao={acao}
          estado={estado}
          venda={null}
          produtos={produtos}
          turmas={turmas}
          aoCancelar={aoFechar}
          rotuloEnvio="Registrar venda"
        />
      )}
    </Modal>
  );
}
