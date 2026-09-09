import Link from "next/link";
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
  EtiquetaStatus,
  PilulaLink,
  pilulaClasses,
} from "@/components/ui";
import { listarProdutos, listarTurmas, listarVendas } from "@/lib/dados";
import {
  alternar,
  aplicarFiltros,
  href,
  lerFiltros,
  mesesDisponiveis,
  montarQuery,
  rotularMes,
  temFiltroAtivo,
  totalizar,
  type Filtros,
} from "@/lib/filtros";
import { formatarData, formatarMoeda } from "@/lib/format";

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
  const resumo = totalizar(filtradas);

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
        descricao="Total de vendas do período selecionado, com os filtros combináveis por produto e turma."
        acoes={
          vendas.length > 0 ? (
            <a
              href={`/api/relatorio${montarQuery(filtros)}`}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-borda-forte bg-white px-4 py-2 text-sm font-medium text-tinta shadow-sm transition-colors hover:border-neutro-fraco hover:bg-papel"
            >
              <IconeBaixar className="h-4 w-4" />
              Exportar relatório
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
          <Filtragem
            filtros={filtros}
            meses={meses}
            produtos={produtosComVenda}
            turmas={turmasComVenda}
          />

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <CartaoMetrica
              tom="azul"
              icone={<IconeDinheiro />}
              rotulo="Valor total"
              valor={formatarMoeda(resumo.total)}
              apoio={`Soma das vendas em ${rotuloPeriodo}`}
            />
            <CartaoMetrica
              tom="verde"
              icone={<IconeVendas />}
              rotulo="Vendas"
              valor={String(resumo.quantidade)}
              apoio="Registros no recorte atual"
            />
            <CartaoMetrica
              tom="roxo"
              icone={<IconeTicket />}
              rotulo="Ticket médio"
              valor={formatarMoeda(resumo.ticketMedio)}
              apoio="Valor médio por venda"
            />
            <CartaoMetrica
              tom="vermelho"
              icone={<IconeAlerta />}
              rotulo="Comprovantes pendentes"
              valor={String(resumo.pendentes)}
              apoio={
                resumo.pendentes === 0
                  ? "Tudo em dia neste recorte"
                  : "Vendas esperando anexo"
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

function Filtragem({
  filtros,
  meses,
  produtos,
  turmas,
}: {
  filtros: Filtros;
  meses: string[];
  produtos: { id: string; nome: string }[];
  turmas: { id: string; nome: string }[];
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <PilulaLink
          ativa={filtros.periodo === "tudo"}
          href={href("/", { ...filtros, periodo: "tudo" })}
        >
          Tudo
        </PilulaLink>
        {meses.map((mes) => (
          <PilulaLink
            key={mes}
            ativa={filtros.periodo === mes}
            href={href("/", { ...filtros, periodo: mes })}
          >
            {rotularMes(mes)}
          </PilulaLink>
        ))}
      </div>

      {produtos.length > 0 && (
        <GrupoFiltro
          titulo="Produtos"
          itens={produtos}
          selecionados={filtros.produtos}
          hrefDe={(id) =>
            href("/", { ...filtros, produtos: alternar(filtros.produtos, id) })
          }
          hrefLimpar={href("/", { ...filtros, produtos: [] })}
        />
      )}

      {turmas.length > 0 && (
        <GrupoFiltro
          titulo="Turmas"
          itens={turmas}
          selecionados={filtros.turmas}
          hrefDe={(id) =>
            href("/", { ...filtros, turmas: alternar(filtros.turmas, id) })
          }
          hrefLimpar={href("/", { ...filtros, turmas: [] })}
        />
      )}

      {temFiltroAtivo(filtros) && (
        <Link
          href="/"
          scroll={false}
          className="inline-block text-sm font-medium text-brasa hover:text-brasa-escuro"
        >
          Limpar todos os filtros
        </Link>
      )}
    </div>
  );
}

function GrupoFiltro({
  titulo,
  itens,
  selecionados,
  hrefDe,
  hrefLimpar,
}: {
  titulo: string;
  itens: { id: string; nome: string }[];
  selecionados: string[];
  hrefDe: (id: string) => string;
  hrefLimpar: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="rotulo-metrica mr-1">{titulo}</span>
      <Link
        href={hrefLimpar}
        scroll={false}
        className={pilulaClasses(selecionados.length === 0)}
      >
        Todos
      </Link>
      {itens.map((item) => (
        <PilulaLink
          key={item.id}
          ativa={selecionados.includes(item.id)}
          href={hrefDe(item.id)}
        >
          {item.nome}
        </PilulaLink>
      ))}
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
            As {vendas.length} venda{vendas.length === 1 ? "" : "s"} que compõem
            o total acima.
          </p>
        </div>
        {vendas.length > 0 && (
          <a
            href={`/api/relatorio${montarQuery(filtros)}`}
            className="text-sm font-medium text-brasa hover:text-brasa-escuro"
          >
            Exportar em CSV
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
