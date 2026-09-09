"use client";

import { useActionState, useRef, useState, startTransition } from "react";
import {
  atualizarVenda,
  excluirVenda,
  registrarComprovante,
  removerComprovante,
} from "@/actions/vendas";
import type { Resultado } from "@/actions/produtos";
import { BotaoEnvio } from "@/components/botao-envio";
import {
  IconeAnexo,
  IconeBaixar,
  IconeLixeira,
  IconeRecibo,
} from "@/components/icones";
import { Modal } from "@/components/modal";
import { Aviso, Botao, EtiquetaStatus } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import {
  ACCEPT_ARQUIVO,
  BUCKET_COMPROVANTES,
  caminhoComprovante,
  validarArquivo,
} from "@/lib/comprovante";
import { formatarDataHora, formatarMoeda } from "@/lib/format";
import type { Produto, Turma, Venda } from "@/lib/types";
import { FormularioVenda } from "./formulario-venda";

const VAZIO: Resultado = {};

type Modo = "detalhe" | "editar" | "excluir";

export function DetalheVenda({
  venda,
  produtos,
  turmas,
  aoFechar,
}: {
  venda: Venda | null;
  produtos: Produto[];
  turmas: Turma[];
  aoFechar: () => void;
}) {
  const [modo, setModo] = useState<Modo>("detalhe");

  // Voltar para os detalhes e fechar o modal são consequências da ação, então
  // acontecem dentro dela — não em um efeito reagindo ao estado.
  const [estadoEdicao, acaoEdicao] = useActionState(
    async (anterior: Resultado, dados: FormData) => {
      const resultado = await atualizarVenda(anterior, dados);
      if (resultado.ok) setModo("detalhe");
      return resultado;
    },
    VAZIO,
  );

  const [estadoExclusao, acaoExclusao] = useActionState(
    async (anterior: Resultado, dados: FormData) => {
      const resultado = await excluirVenda(anterior, dados);
      if (resultado.ok) aoFechar();
      return resultado;
    },
    VAZIO,
  );

  if (!venda) return null;

  const titulos: Record<Modo, string> = {
    detalhe: "Detalhes da venda",
    editar: "Editar venda",
    excluir: "Excluir venda",
  };

  return (
    <Modal
      aberto
      aoFechar={aoFechar}
      titulo={titulos[modo]}
      descricao={modo === "detalhe" ? venda.comprador_nome : undefined}
      largura="max-w-2xl"
    >
      {modo === "editar" && (
        <FormularioVenda
          acao={acaoEdicao}
          estado={estadoEdicao}
          venda={venda}
          produtos={produtos}
          turmas={turmas}
          aoCancelar={() => setModo("detalhe")}
          rotuloEnvio="Salvar alterações"
        />
      )}

      {modo === "excluir" && (
        <form action={acaoExclusao} className="space-y-4">
          <input type="hidden" name="id" value={venda.id} />
          <Aviso>
            Excluir a venda de{" "}
            <strong className="font-semibold">{venda.comprador_nome}</strong>{" "}
            apaga o registro e o comprovante anexado. Não dá para desfazer.
          </Aviso>
          {estadoExclusao.erro && <Aviso>{estadoExclusao.erro}</Aviso>}
          <div className="flex justify-end gap-2">
            <Botao
              type="button"
              variante="secundario"
              onClick={() => setModo("detalhe")}
            >
              Cancelar
            </Botao>
            <BotaoEnvio variante="perigo" carregando="Excluindo…">
              Excluir venda
            </BotaoEnvio>
          </div>
        </form>
      )}

      {modo === "detalhe" && (
        <div className="space-y-6">
          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <Dado rotulo="Comprador" valor={venda.comprador_nome} />
            <Dado rotulo="Telefone" valor={venda.comprador_telefone || "—"} />
            <Dado rotulo="E-mail" valor={venda.comprador_email || "—"} />
            <Dado rotulo="Produto" valor={venda.produto_nome} />
            <Dado rotulo="Turma" valor={venda.turma_nome} />
            <Dado
              rotulo="Valor"
              valor={formatarMoeda(venda.valor)}
              destaque
            />
            <Dado
              rotulo="Registrada em"
              valor={formatarDataHora(venda.created_at)}
            />
            <div>
              <dt className="rotulo-metrica">Status</dt>
              <dd className="mt-1.5">
                <EtiquetaStatus status={venda.status} />
              </dd>
            </div>
          </dl>

          <BlocoComprovante venda={venda} />

          <div className="flex flex-wrap justify-between gap-2 border-t border-borda pt-4">
            <Botao variante="perigo" onClick={() => setModo("excluir")}>
              <IconeLixeira className="h-4 w-4" />
              Excluir venda
            </Botao>
            <div className="flex gap-2">
              <Botao variante="secundario" onClick={aoFechar}>
                Fechar
              </Botao>
              <Botao onClick={() => setModo("editar")}>Editar dados</Botao>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

function Dado({
  rotulo,
  valor,
  destaque = false,
}: {
  rotulo: string;
  valor: string;
  destaque?: boolean;
}) {
  return (
    <div>
      <dt className="rotulo-metrica">{rotulo}</dt>
      <dd
        className={
          destaque
            ? "serif mt-1 text-xl text-tinta tabular-nums"
            : "mt-1 text-[15px] break-words text-tinta"
        }
      >
        {valor}
      </dd>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Comprovante                                                         */
/* ------------------------------------------------------------------ */

function BlocoComprovante({ venda }: { venda: Venda }) {
  const entrada = useRef<HTMLInputElement>(null);
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [estadoRegistro, acaoRegistro] = useActionState(
    async (anterior: Resultado, dados: FormData) => {
      const resultado = await registrarComprovante(anterior, dados);
      if (resultado.ok) {
        setSelecionado(null);
        if (entrada.current) entrada.current.value = "";
      }
      return resultado;
    },
    VAZIO,
  );

  const [estadoRemocao, acaoRemocao] = useActionState(removerComprovante, VAZIO);

  const anexado = venda.status === "comprovante_anexado";

  /**
   * O upload vai do navegador direto para o Storage do Supabase. Só o
   * caminho resultante passa pelo servidor — assim o limite de corpo de
   * requisição da Vercel (~4,5 MB) não barra PDFs e fotos grandes.
   */
  async function enviarArquivo() {
    const arquivo = entrada.current?.files?.[0];
    if (!arquivo) {
      setErro("Escolha um arquivo de imagem ou PDF.");
      return;
    }

    const invalido = validarArquivo(arquivo);
    if (invalido) {
      setErro(invalido);
      return;
    }

    setErro(null);
    setEnviando(true);

    try {
      const supabase = createClient();
      const caminho = caminhoComprovante(venda.id, arquivo.name);

      const { error } = await supabase.storage
        .from(BUCKET_COMPROVANTES)
        .upload(caminho, arquivo, {
          contentType: arquivo.type || "application/octet-stream",
          upsert: false,
        });

      if (error) {
        setErro(`Falha ao enviar o arquivo: ${error.message}`);
        return;
      }

      const dados = new FormData();
      dados.set("id", venda.id);
      dados.set("caminho", caminho);
      dados.set("nome", arquivo.name);
      startTransition(() => acaoRegistro(dados));
    } catch (falha) {
      setErro(
        falha instanceof Error
          ? `Falha ao enviar o arquivo: ${falha.message}`
          : "Falha ao enviar o arquivo.",
      );
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className="rounded-xl border border-borda bg-papel p-4">
      <div className="flex items-center gap-2">
        <IconeRecibo className="h-[18px] w-[18px] text-neutro" />
        <h3 className="text-sm font-semibold text-tinta">
          Comprovante de pagamento
        </h3>
      </div>

      {anexado ? (
        <div className="mt-3 space-y-3">
          <p className="text-sm text-neutro">
            Arquivo anexado:{" "}
            <span className="font-medium break-all text-tinta">
              {venda.comprovante_nome ?? "comprovante"}
            </span>
          </p>

          <div className="flex flex-wrap gap-2">
            <a
              href={`/vendas/${venda.id}/comprovante`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-borda-forte bg-white px-4 py-2 text-sm font-medium text-tinta transition-colors hover:border-neutro-fraco hover:bg-papel"
            >
              <IconeAnexo className="h-4 w-4" />
              Abrir
            </a>
            <a
              href={`/vendas/${venda.id}/comprovante?download=1`}
              className="inline-flex items-center gap-2 rounded-full border border-borda-forte bg-white px-4 py-2 text-sm font-medium text-tinta transition-colors hover:border-neutro-fraco hover:bg-papel"
            >
              <IconeBaixar className="h-4 w-4" />
              Baixar
            </a>
            <form action={acaoRemocao}>
              <input type="hidden" name="id" value={venda.id} />
              <BotaoEnvio variante="perigo" carregando="Removendo…">
                Remover
              </BotaoEnvio>
            </form>
          </div>

          {estadoRemocao.erro && <Aviso>{estadoRemocao.erro}</Aviso>}

          <details className="text-sm">
            <summary className="cursor-pointer text-neutro hover:text-tinta">
              Substituir por outro arquivo
            </summary>
            <div className="mt-3">
              <SeletorArquivo
                entrada={entrada}
                selecionado={selecionado}
                setSelecionado={setSelecionado}
                enviando={enviando}
                aoEnviar={enviarArquivo}
                rotulo="Substituir comprovante"
              />
            </div>
          </details>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <p className="text-sm text-neutro">
            Anexe a imagem ou o PDF do pagamento. Ao anexar, o status da venda
            muda para <span className="font-medium text-tinta">comprovante anexado</span>.
          </p>
          <SeletorArquivo
            entrada={entrada}
            selecionado={selecionado}
            setSelecionado={setSelecionado}
            enviando={enviando}
            aoEnviar={enviarArquivo}
            rotulo="Anexar comprovante"
          />
        </div>
      )}

      {erro && (
        <div className="mt-3">
          <Aviso>{erro}</Aviso>
        </div>
      )}
      {estadoRegistro.erro && (
        <div className="mt-3">
          <Aviso>{estadoRegistro.erro}</Aviso>
        </div>
      )}
    </section>
  );
}

function SeletorArquivo({
  entrada,
  selecionado,
  setSelecionado,
  enviando,
  aoEnviar,
  rotulo,
}: {
  entrada: React.RefObject<HTMLInputElement | null>;
  selecionado: string | null;
  setSelecionado: (nome: string | null) => void;
  enviando: boolean;
  aoEnviar: () => void;
  rotulo: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <input
        ref={entrada}
        type="file"
        accept={ACCEPT_ARQUIVO}
        onChange={(e) => setSelecionado(e.target.files?.[0]?.name ?? null)}
        className="block max-w-full text-sm text-neutro file:mr-3 file:cursor-pointer file:rounded-full file:border file:border-borda-forte file:bg-white file:px-4 file:py-2 file:text-sm file:font-medium file:text-tinta hover:file:border-neutro-fraco"
      />
      <Botao onClick={aoEnviar} disabled={enviando || !selecionado}>
        {enviando ? "Enviando…" : rotulo}
      </Botao>
    </div>
  );
}
