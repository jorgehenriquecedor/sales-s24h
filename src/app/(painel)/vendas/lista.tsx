"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { criarVenda, type ResultadoVenda } from "@/actions/vendas";
import { IconeMais, IconeVazio } from "@/components/icones";
import { Modal } from "@/components/modal";
import { FiltrosPainel } from "@/components/filtros-painel";
import {
  Botao,
  BotaoLink,
  Cartao,
  Campo,
  EstadoVazio,
  EtiquetaPagamento,
  EtiquetaStatus,
  Aviso,
} from "@/components/ui";
import { aplicarFiltros, mesesDisponiveis, type Filtros, type StatusFiltro } from "@/lib/filtros";
import { formatarData, formatarMoeda } from "@/lib/format";
import type { Produto, Turma, Venda } from "@/lib/types";
import { FormularioVenda } from "./formulario-venda";
import { DetalheVenda } from "./detalhe";

const VAZIO_VENDA: ResultadoVenda = {};

type ModoNova = "escolher" | "checkout" | "manual" | null;

export function ListaVendas({
  vendas,
  produtos,
  turmas,
  filtros,
  status,
  asaasAtivo,
}: {
  vendas: Venda[];
  produtos: Produto[];
  turmas: Turma[];
  filtros: Filtros;
  status: StatusFiltro;
  asaasAtivo: boolean;
}) {
  const [modoNova, setModoNova] = useState<ModoNova>(null);
  const [abertaId, setAbertaId] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!vendas.some((v) => (v.modo_venda === "checkout" && v.pagamento_status === "pendente") ||
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

    return aplicarFiltros(vendas, filtros).filter((venda) => {
      if (status === "pendentes" && venda.pagamento_status !== "pendente") {
        return false;
      }
      if (status === "expiradas" && venda.pagamento_status !== "expirada") {
        return false;
      }
      if (status === "aprovadas" && venda.pagamento_status !== "aprovada") {
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
  }, [vendas, filtros, status, busca]);

  const meses = mesesDisponiveis(vendas);
  const produtosComVenda = produtos.filter((produto) =>
    vendas.some((venda) =>
      venda.produto_id === produto.id || venda.itens.some((item) => item.produto_id === produto.id),
    ),
  );
  const turmasComVenda = turmas.filter((turma) =>
    vendas.some((venda) => venda.turma_id === turma.id),
  );

  const semCadastros = produtos.length === 0;

  return (
    <div className="space-y-5">
      {!asaasAtivo && <Aviso tom="info">O Asaas ainda não está configurado. Vendas sem Checkout continuam disponíveis e são aprovadas ao anexar o comprovante.</Aviso>}
      {aviso && <Aviso tom="info">{aviso}</Aviso>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FiltrosPainel
          base="/vendas"
          filtros={filtros}
          status={status}
          meses={meses}
          produtos={produtosComVenda}
          turmas={turmasComVenda}
        />

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
            onClick={() => setModoNova("escolher")}
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
                : "Registre a primeira venda com Checkout Asaas ou com comprovante manual."
            }
            acao={
              semCadastros ? (
                <div className="flex gap-2">
                  {produtos.length === 0 && (
                    <BotaoLink href="/produtos">Cadastrar produto</BotaoLink>
                  )}
                </div>
              ) : (
                <Botao onClick={() => setModoNova("escolher")}>
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
            descricao="Ajuste a busca ou limpe os filtros para ver a lista completa."
            acao={
              <Botao
                variante="secundario"
                onClick={() => {
                  router.push("/vendas", { scroll: false });
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
        modo={modoNova}
        aoEscolher={setModoNova}
        aoFechar={() => setModoNova(null)}
        aoCriar={(id, mensagem) => { setModoNova(null); setAbertaId(id); setAviso(mensagem ?? null); router.refresh(); }}
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
  modo,
  aoEscolher,
  aoFechar,
  aoCriar,
  asaasAtivo,
  produtos,
  turmas,
}: {
  modo: ModoNova;
  aoEscolher: (modo: ModoNova) => void;
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
      aberto={modo !== null}
      aoFechar={aoFechar}
      titulo={modo === "escolher" ? "Nova venda" : modo === "checkout" ? "Nova venda com Checkout" : "Nova venda sem Checkout"}
      descricao={modo === "escolher" ? "Escolha como esta venda será aprovada."
        : modo === "checkout" ? "O Checkout Asaas será gerado ao registrar a venda."
          : "A venda ficará pendente até você anexar o comprovante."}
      largura="max-w-2xl"
    >
      {modo === "escolher" && (
        <div className="space-y-3">
          <button type="button" disabled={!asaasAtivo} onClick={() => aoEscolher("checkout")}
            className="block w-full rounded-xl border border-borda-forte p-4 text-left transition-colors hover:border-brasa hover:bg-papel disabled:cursor-not-allowed disabled:opacity-55">
            <span className="block font-semibold text-tinta">Com Checkout</span>
            <span className="mt-1 block text-sm text-neutro">Gera o link Asaas. O pagamento aprova a venda e vincula o comprovante automaticamente.</span>
          </button>
          <button type="button" onClick={() => aoEscolher("manual")}
            className="block w-full rounded-xl border border-borda-forte p-4 text-left transition-colors hover:border-brasa hover:bg-papel">
            <span className="block font-semibold text-tinta">Sem Checkout</span>
            <span className="mt-1 block text-sm text-neutro">A venda fica pendente. Anexe o comprovante para aprová-la.</span>
          </button>
          {!asaasAtivo && <Aviso tom="info">Com Checkout estará disponível após configurar a chave e o webhook do Asaas.</Aviso>}
        </div>
      )}
      {(modo === "checkout" || modo === "manual") && (
        <FormularioVenda
          acao={acao}
          estado={estado}
          venda={null}
          produtos={produtos}
          turmas={turmas}
          aoCancelar={aoFechar}
          rotuloEnvio={modo === "checkout" ? "Registrar e gerar checkout" : "Registrar venda"}
          modoVenda={modo}
        />
      )}
    </Modal>
  );
}
