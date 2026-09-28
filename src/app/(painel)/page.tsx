import { CartaoMetrica } from "@/components/cartao-metrica";
import {
  IconeAlerta,
  IconeBaixar,
  IconeDinheiro,
  IconeMais,
  IconeTicket,
  IconeVazio,
  IconeVendas,
} from "@/components/icones";
import {
  BotaoLink,
  CabecalhoPagina,
  Cartao,
  EstadoVazio,
  EtiquetaPagamento,
  EtiquetaStatus,
} from "@/components/ui";
import { listarProdutos, listarTurmas, listarVendas } from "@/lib/dados";
import {
  aplicarFiltros,
  lerFiltros,
  mesesDisponiveis,
  montarQuery,
  rotularMes,
  totalizar,
  type Filtros,
} from "@/lib/filtros";
import { formatarData, formatarMoeda } from "@/lib/format";
import { FiltrosDashboard } from "./filtros-dashboard";

export const metadata = { title: "Início | Controle de Vendas" };
export const dynamic = "force-dynamic";

export default async function PaginaInicio({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const filtros = lerFiltros(params);

  const [vendas, produtos, turmas] = await Promise.all([
    listarVendas(),
    listarProdutos(),
    listarTurmas(),
  ]);

  const meses = mesesDisponiveis(vendas);
  const filtradas = aplicarFiltros(vendas, filtros);
  const aprovadas = filtradas.filter((v) => v.pagamento_status === "aprovada");
  const resumo = totalizar(aprovadas);
  const aguardando = filtradas.filter((v) => v.pagamento_status === "pendente").length;

  // Só oferece como filtro o que realmente aparece em alguma venda.
  const produtosComVenda = produtos.filter((p) =>
    vendas.some((v) => v.produto_id === p.id),
  );
  const turmasComVenda = turmas.filter((t) =>
    vendas.some((v) => v.turma_id === t.id),
  );

  const rotuloPeriodo =
    filtros.periodo === "tudo" ? "todo o período" : rotularMes(filtros.periodo);

  return (
    <div className="space-y-7">
      <CabecalhoPagina
        titulo="Visão geral"
        descricao="Pagamentos aprovados no período selecionado, com filtros por produto e turma."
        acoes={
          aprovadas.length > 0 ? (
            <a
              href={`/api/relatorio${montarQuery(filtros)}`}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-borda-forte bg-white px-4 py-2 text-sm font-medium text-tinta shadow-sm transition-colors hover:border-neutro-fraco hover:bg-papel"
            >
              <IconeBaixar className="h-4 w-4" />
              Exportar aprovadas
            </a>
          ) : undefined
        }
      />

      {vendas.length === 0 ? (
        <Cartao>
          <EstadoVazio
            icone={<IconeVazio className="h-6 w-6" />}
            titulo="Nenhuma venda registrada ainda"
            descricao="Assim que a primeira venda for registrada, o total, os filtros por mês e a exportação aparecem aqui."
            acao={
              <BotaoLink href="/vendas">
                <IconeMais className="h-4 w-4" />
                Registrar primeira venda
              </BotaoLink>
            }
          />
        </Cartao>
      ) : (
        <>
          <FiltrosDashboard
            filtros={filtros}
            meses={meses}
            produtos={produtosComVenda}
            turmas={turmasComVenda}
          />

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <CartaoMetrica
              tom="azul"
              icone={<IconeDinheiro />}
              rotulo="Valor aprovado"
              valor={formatarMoeda(resumo.total)}
              apoio={`Pagamentos confirmados em ${rotuloPeriodo}`}
            />
            <CartaoMetrica
              tom="verde"
              icone={<IconeVendas />}
              rotulo="Vendas aprovadas"
              valor={String(resumo.quantidade)}
              apoio="Pagamentos confirmados no recorte"
            />
            <CartaoMetrica
              tom="roxo"
              icone={<IconeTicket />}
              rotulo="Ticket médio"
              valor={formatarMoeda(resumo.ticketMedio)}
              apoio="Valor médio das vendas aprovadas"
            />
            <CartaoMetrica
              tom="vermelho"
              icone={<IconeAlerta />}
              rotulo="Aguardando pagamento"
              valor={String(aguardando)}
              apoio={
                aguardando === 0
                  ? "Tudo em dia neste recorte"
                  : "Vendas com checkout pendente"
              }
            />
          </div>

          <TabelaComposicao vendas={filtradas} filtros={filtros} />
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function TabelaComposicao({
  vendas,
  filtros,
}: {
  vendas: Awaited<ReturnType<typeof listarVendas>>;
  filtros: Filtros;
}) {
  return (
    <Cartao>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-borda px-5 py-4">
        <div>
          <h2 className="serif text-lg text-tinta">Vendas do recorte</h2>
          <p className="mt-0.5 text-sm text-neutro">
            {vendas.length} registro{vendas.length === 1 ? "" : "s"} no recorte. O valor acima considera somente as vendas aprovadas.
          </p>
        </div>
        {vendas.some((v) => v.pagamento_status === "aprovada") && (
          <a
            href={`/api/relatorio${montarQuery(filtros)}`}
            className="text-sm font-medium text-brasa hover:text-brasa-escuro"
          >
            Exportar aprovadas
          </a>
        )}
      </div>

      {vendas.length === 0 ? (
        <EstadoVazio
          icone={<IconeVazio className="h-6 w-6" />}
          titulo="Nenhuma venda neste recorte"
          descricao="Nenhuma venda combina com os filtros ativos. Volte para “Tudo” ou tire algum filtro de produto ou turma."
          acao={
            <BotaoLink href="/" variante="secundario">
              Limpar filtros
            </BotaoLink>
          }
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
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
              {vendas.map((venda) => (
                <tr key={venda.id} className="border-b border-borda last:border-0">
                  <td className="px-5 py-3.5 font-medium text-tinta">
                    {venda.comprador_nome}
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
  );
}
