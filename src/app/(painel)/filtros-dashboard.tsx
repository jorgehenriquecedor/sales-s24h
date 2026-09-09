"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { IconeFunil } from "@/components/icones";
import { Botao } from "@/components/ui";
import { montarQuery, rotularMes, type Filtros } from "@/lib/filtros";

type Item = { id: string; nome: string };

function alternarItem(lista: string[], id: string): string[] {
  return lista.includes(id) ? lista.filter((v) => v !== id) : [...lista, id];
}

function nomeDe(itens: Item[], id: string): string {
  return itens.find((i) => i.id === id)?.nome ?? "item removido";
}

/**
 * Um botão de funil só, com o recorte atual escrito ao lado. As opções de
 * período, produto e turma ficam no painel que abre — em vez de três fileiras
 * de pílulas ocupando o topo da tela o tempo todo.
 *
 * O painel trabalha num rascunho: nada é aplicado enquanto o usuário marca as
 * caixas, e "Aplicar" navega uma única vez. Os filtros continuam morando na
 * URL, então a exportação segue reaproveitando exatamente o mesmo recorte.
 */
export function FiltrosDashboard({
  filtros,
  meses,
  produtos,
  turmas,
}: {
  filtros: Filtros;
  meses: string[];
  produtos: Item[];
  turmas: Item[];
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [rascunho, setRascunho] = useState<Filtros>(filtros);
  const caixa = useRef<HTMLDivElement>(null);

  const ativos =
    (filtros.periodo !== "tudo" ? 1 : 0) +
    filtros.produtos.length +
    filtros.turmas.length;

  // Abrir sincroniza o rascunho com o que está valendo. Feito aqui, no evento,
  // e não em um efeito reagindo a props.
  function abrir() {
    setRascunho(filtros);
    setAberto(true);
  }

  useEffect(() => {
    if (!aberto) return;

    function aoClicarFora(evento: MouseEvent) {
      if (caixa.current && !caixa.current.contains(evento.target as Node)) {
        setAberto(false);
      }
    }
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === "Escape") setAberto(false);
    }

    document.addEventListener("mousedown", aoClicarFora);
    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("mousedown", aoClicarFora);
      document.removeEventListener("keydown", aoTeclar);
    };
  }, [aberto]);

  function aplicar() {
    router.push(`/${montarQuery(rascunho)}`, { scroll: false });
    setAberto(false);
  }

  function limparTudo() {
    router.push("/", { scroll: false });
    setAberto(false);
  }

  function resumo(): string {
    const partes: string[] = [];

    if (filtros.periodo !== "tudo") partes.push(rotularMes(filtros.periodo));

    if (filtros.produtos.length === 1) {
      partes.push(nomeDe(produtos, filtros.produtos[0]));
    } else if (filtros.produtos.length > 1) {
      partes.push(`${filtros.produtos.length} produtos`);
    }

    if (filtros.turmas.length === 1) {
      partes.push(nomeDe(turmas, filtros.turmas[0]));
    } else if (filtros.turmas.length > 1) {
      partes.push(`${filtros.turmas.length} turmas`);
    }

    return partes.length > 0 ? partes.join(", ") : "Todas as vendas";
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative" ref={caixa}>
        <button
          type="button"
          onClick={() => (aberto ? setAberto(false) : abrir())}
          aria-expanded={aberto}
          aria-haspopup="dialog"
          className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
            ativos > 0 || aberto
              ? "border-brasa bg-brasa text-white"
              : "border-borda-forte bg-white text-tinta hover:border-neutro-fraco"
          }`}
        >
          <IconeFunil className="h-[18px] w-[18px]" />
          Filtros
          {ativos > 0 && (
            <span className="rounded-full bg-white/25 px-1.5 text-xs font-semibold tabular-nums">
              {ativos}
            </span>
          )}
        </button>

        {aberto && (
          <div
            role="dialog"
            aria-label="Filtrar vendas"
            className="absolute top-full left-0 z-40 mt-2 w-[min(22rem,calc(100vw-2.5rem))] rounded-2xl border border-borda bg-white shadow-xl"
          >
            <div className="max-h-[26rem] space-y-5 overflow-y-auto px-4 py-4">
              <Secao titulo="Período">
                <Opcao
                  tipo="radio"
                  nome="periodo"
                  marcada={rascunho.periodo === "tudo"}
                  aoMudar={() => setRascunho({ ...rascunho, periodo: "tudo" })}
                >
                  Tudo
                </Opcao>
                {meses.map((mes) => (
                  <Opcao
                    key={mes}
                    tipo="radio"
                    nome="periodo"
                    marcada={rascunho.periodo === mes}
                    aoMudar={() => setRascunho({ ...rascunho, periodo: mes })}
                  >
                    {rotularMes(mes)}
                  </Opcao>
                ))}
              </Secao>

              {produtos.length > 0 && (
                <Secao
                  titulo="Produtos"
                  acao={
                    rascunho.produtos.length > 0 ? (
                      <BotaoLimpar
                        aoClicar={() => setRascunho({ ...rascunho, produtos: [] })}
                      />
                    ) : undefined
                  }
                >
                  {produtos.map((produto) => (
                    <Opcao
                      key={produto.id}
                      tipo="checkbox"
                      marcada={rascunho.produtos.includes(produto.id)}
                      aoMudar={() =>
                        setRascunho({
                          ...rascunho,
                          produtos: alternarItem(rascunho.produtos, produto.id),
                        })
                      }
                    >
                      {produto.nome}
                    </Opcao>
                  ))}
                </Secao>
              )}

              {turmas.length > 0 && (
                <Secao
                  titulo="Turmas"
                  acao={
                    rascunho.turmas.length > 0 ? (
                      <BotaoLimpar
                        aoClicar={() => setRascunho({ ...rascunho, turmas: [] })}
                      />
                    ) : undefined
                  }
                >
                  {turmas.map((turma) => (
                    <Opcao
                      key={turma.id}
                      tipo="checkbox"
                      marcada={rascunho.turmas.includes(turma.id)}
                      aoMudar={() =>
                        setRascunho({
                          ...rascunho,
                          turmas: alternarItem(rascunho.turmas, turma.id),
                        })
                      }
                    >
                      {turma.nome}
                    </Opcao>
                  ))}
                </Secao>
              )}
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-borda px-4 py-3">
              <button
                type="button"
                onClick={limparTudo}
                className="text-sm font-medium text-neutro transition-colors hover:text-tinta"
              >
                Limpar tudo
              </button>
              <Botao onClick={aplicar}>Aplicar filtros</Botao>
            </div>
          </div>
        )}
      </div>

      <p className="text-sm text-neutro">{resumo()}</p>

      {ativos > 0 && (
        <button
          type="button"
          onClick={limparTudo}
          className="text-sm font-medium text-brasa transition-colors hover:text-brasa-escuro"
        >
          Limpar
        </button>
      )}
    </div>
  );
}

function Secao({
  titulo,
  acao,
  children,
}: {
  titulo: string;
  acao?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <h3 className="rotulo-metrica">{titulo}</h3>
        {acao}
      </div>
      <div className="space-y-0.5">{children}</div>
    </section>
  );
}

function BotaoLimpar({ aoClicar }: { aoClicar: () => void }) {
  return (
    <button
      type="button"
      onClick={aoClicar}
      className="text-xs font-medium text-neutro transition-colors hover:text-brasa"
    >
      Limpar
    </button>
  );
}

function Opcao({
  tipo,
  nome,
  marcada,
  aoMudar,
  children,
}: {
  tipo: "radio" | "checkbox";
  nome?: string;
  marcada: boolean;
  aoMudar: () => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-[15px] text-tinta transition-colors hover:bg-papel">
      <input
        type={tipo}
        name={nome}
        checked={marcada}
        onChange={aoMudar}
        className="h-4 w-4 shrink-0 accent-brasa"
      />
      <span className="min-w-0 truncate">{children}</span>
    </label>
  );
}
