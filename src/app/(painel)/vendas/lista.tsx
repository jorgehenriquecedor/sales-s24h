"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { criarVenda, type ResultadoVenda } from "@/actions/vendas";
import { IconeMais, IconeVazio } from "@/components/icones";
import { Modal } from "@/components/modal";
import {
  Botao,
  BotaoLink,
  Cartao,
  Campo,
  EstadoVazio,
  EtiquetaPagamento,
  EtiquetaStatus,
  Aviso,
  pilulaClasses,
} from "@/components/ui";
import { formatarData, formatarMoeda } from "@/lib/format";
import type { Produto, Turma, Venda } from "@/lib/types";
import { FormularioVenda } from "./formulario-venda";
import { DetalheVenda } from "./detalhe";

const VAZIO_VENDA: ResultadoVenda = {};

type FiltroStatus = "todas" | "pendentes" | "expiradas" | "aprovadas";

const FILTROS: { chave: FiltroStatus; rotulo: string }[] = [
  { chave: "todas", rotulo: "Todas" },
  { chave: "pendentes", rotulo: "Aguardando pagamento" },
  { chave: "expiradas", rotulo: "Expiradas" },
  { chave: "aprovadas", rotulo: "Aprovadas" },
];

export function ListaVendas({
  vendas,
  produtos,
  turmas,
  asaasAtivo,
}: {
  vendas: Venda[];
  produtos: Produto[];
  turmas: Turma[];
  asaasAtivo: boolean;
}) {
  const [novaAberta, setNovaAberta] = useState(false);
  const [abertaId, setAbertaId] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<FiltroStatus>("todas");
  const [busca, setBusca] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!vendas.some((v) => v.pagamento_status === "pendente" ||
      v.pagamento_status === "expirada" ||
      (v.pagamento_status === "aprovada" && !v.comprovante_path && !v.asaas_comprovante_url))) return;
    const timer = window.setInterval(() => router.refresh(), 30_000);
    return () => window.clearInterval(timer);
  }, [router, vendas]);

  // A venda aberta vem sempre da lista fresca do servidor, para o modal
  // refletir na hora o que uma ação acabou de mudar.
  const vendaAberta = abertaId
    ? (vendas.find((v) => v.id === abertaId) ?? null)
    : null;

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();

    return vendas.filter((venda) => {
      if (filtro === "pendentes" && venda.pagamento_status !== "pendente") {
        return false;
      }
      if (filtro === "expiradas" && venda.pagamento_status !== "expirada") {
        return false;
      }
      if (filtro === "aprovadas" && venda.pagamento_status !== "aprovada") {
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
    (v) => v.pagamento_status === "pendente",
  ).length;

  const semCadastros = produtos.length === 0;

  return (
    <div className="space-y-5">
      {!asaasAtivo && <Aviso tom="info">O Asaas ainda não está configurado. Você pode registrar vendas e descontos agora; elas ficarão sem checkout até a ativação.</Aviso>}
      {aviso && <Aviso tom="info">{aviso}</Aviso>}
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
              semCadastros ? "Cadastre ao menos um produto antes" : undefined
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
                ? "Antes de registrar a primeira venda, cadastre pelo menos um produto."
                : asaasAtivo
                  ? "Registre a primeira venda para gerar um checkout Asaas e acompanhar o pagamento."
                  : "Registre a primeira venda. Você poderá gerar o checkout nela após configurar o Asaas."
            }
            acao={
              semCadastros ? (
                <div className="flex gap-2">
                  {produtos.length === 0 && (
                    <BotaoLink href="/produtos">Cadastrar produto</BotaoLink>
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
                  <th className="px-5 py-3 font-medium text-neutro">Pagamento</th>
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
                    <td className="px-5 py-3.5 text-tinta">
                      <span className="block">{venda.produto_nome}</span>
                      {venda.itens.length > 1 && <span className="text-xs text-neutro">{venda.itens.length} produtos</span>}
                    </td>
                    <td className="px-5 py-3.5 text-neutro">{venda.turma_nome}</td>
                    <td className="px-5 py-3.5 text-right font-medium tabular-nums text-tinta">
                      {formatarMoeda(venda.valor)}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap tabular-nums text-neutro">
                      {formatarData(venda.created_at)}
                    </td>
                    <td className="px-5 py-3.5">
                      <EtiquetaPagamento status={venda.pagamento_status} />
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
          Clique em uma linha para abrir o checkout, ver o comprovante ou gerar outro link após a expiração.
        </p>
      )}

      <ModalNovaVenda
        aberto={novaAberta}
        aoFechar={() => setNovaAberta(false)}
        aoCriar={(id, mensagem) => { setNovaAberta(false); setAbertaId(id); setAviso(mensagem ?? null); router.refresh(); }}
        asaasAtivo={asaasAtivo}
        produtos={produtos}
        turmas={turmas}
      />

      <DetalheVenda
        key={vendaAberta?.id ?? "nenhuma"}
        venda={vendaAberta}
        produtos={produtos}
        turmas={turmas}
        asaasAtivo={asaasAtivo}
        aoFechar={() => setAbertaId(null)}
      />
    </div>
  );
}

function ModalNovaVenda({
  aberto,
  aoFechar,
  aoCriar,
  asaasAtivo,
  produtos,
  turmas,
}: {
  aberto: boolean;
  aoFechar: () => void;
  aoCriar: (id: string, aviso?: string) => void;
  asaasAtivo: boolean;
  produtos: Produto[];
  turmas: Turma[];
}) {
  const [estado, acao] = useActionState(
    async (anterior: ResultadoVenda, dados: FormData) => {
      const resultado = await criarVenda(anterior, dados);
      if (resultado.ok && resultado.vendaId) aoCriar(resultado.vendaId, resultado.aviso);
      return resultado;
    },
    VAZIO_VENDA,
  );

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Nova venda"
      descricao={asaasAtivo
        ? "Ao registrar, geramos um checkout Asaas válido por 24 horas para esta venda."
        : "O registro será salvo sem checkout. O link poderá ser gerado após configurar o Asaas."}
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
          rotuloEnvio={asaasAtivo ? "Registrar e gerar checkout" : "Registrar venda"}
        />
      )}
    </Modal>
  );
}
