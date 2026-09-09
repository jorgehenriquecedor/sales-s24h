"use client";

import { useState } from "react";
import { Aviso, Botao, Campo, Rotulo, Selecao } from "@/components/ui";
import { BotaoEnvio } from "@/components/botao-envio";
import { paraCampoValor } from "@/lib/format";
import type { Produto, Turma, Venda } from "@/lib/types";
import type { Resultado } from "@/actions/produtos";

/**
 * Mostra os itens ativos e, na edição, também o item já escolhido mesmo que
 * tenha sido arquivado depois — senão o select abriria com valor inválido.
 */
function opcoesVisiveis<T extends { id: string; arquivado: boolean }>(
  itens: T[],
  selecionado: string | null,
): T[] {
  return itens.filter((item) => !item.arquivado || item.id === selecionado);
}

export function FormularioVenda({
  acao,
  estado,
  venda,
  produtos,
  turmas,
  aoCancelar,
  rotuloEnvio,
}: {
  acao: (formData: FormData) => void;
  estado: Resultado;
  venda: Venda | null;
  produtos: Produto[];
  turmas: Turma[];
  aoCancelar: () => void;
  rotuloEnvio: string;
}) {
  const [produtoId, setProdutoId] = useState(venda?.produto_id ?? "");
  const [valor, setValor] = useState(
    venda ? paraCampoValor(venda.valor) : "",
  );

  const produtosVisiveis = opcoesVisiveis(produtos, venda?.produto_id ?? null);
  const turmasVisiveis = opcoesVisiveis(turmas, venda?.turma_id ?? null);

  // Trocar o produto repõe o preço de tabela; o campo continua editável.
  function aoTrocarProduto(id: string) {
    setProdutoId(id);
    const escolhido = produtos.find((p) => p.id === id);
    if (escolhido) setValor(paraCampoValor(escolhido.preco));
  }

  const prefixo = venda?.id ?? "nova";

  return (
    <form action={acao} className="space-y-4">
      {venda && <input type="hidden" name="id" value={venda.id} />}

      <div>
        <Rotulo htmlFor={`nome-${prefixo}`}>Nome completo do comprador</Rotulo>
        <Campo
          id={`nome-${prefixo}`}
          name="comprador_nome"
          required
          maxLength={200}
          autoComplete="off"
          defaultValue={venda?.comprador_nome ?? ""}
          placeholder="Ex.: Maria Souza Lima"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Rotulo htmlFor={`tel-${prefixo}`} dica="opcional">
            Telefone
          </Rotulo>
          <Campo
            id={`tel-${prefixo}`}
            name="comprador_telefone"
            inputMode="tel"
            maxLength={40}
            autoComplete="off"
            defaultValue={venda?.comprador_telefone ?? ""}
            placeholder="(11) 90000-0000"
          />
        </div>
        <div>
          <Rotulo htmlFor={`email-${prefixo}`} dica="opcional">
            E-mail
          </Rotulo>
          <Campo
            id={`email-${prefixo}`}
            name="comprador_email"
            type="email"
            maxLength={200}
            autoComplete="off"
            defaultValue={venda?.comprador_email ?? ""}
            placeholder="maria@exemplo.com"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Rotulo htmlFor={`produto-${prefixo}`}>Produto</Rotulo>
          <Selecao
            id={`produto-${prefixo}`}
            name="produto_id"
            required
            value={produtoId}
            onChange={(e) => aoTrocarProduto(e.target.value)}
          >
            <option value="" disabled>
              Selecione o produto
            </option>
            {produtosVisiveis.map((produto) => (
              <option key={produto.id} value={produto.id}>
                {produto.nome}
                {produto.arquivado ? " (arquivado)" : ""}
              </option>
            ))}
          </Selecao>
        </div>

        <div>
          <Rotulo htmlFor={`turma-${prefixo}`}>Turma</Rotulo>
          <Selecao
            id={`turma-${prefixo}`}
            name="turma_id"
            required
            defaultValue={venda?.turma_id ?? ""}
          >
            <option value="" disabled>
              Selecione a turma
            </option>
            {turmasVisiveis.map((turma) => (
              <option key={turma.id} value={turma.id}>
                {turma.nome}
                {turma.arquivado ? " (arquivada)" : ""}
              </option>
            ))}
          </Selecao>
        </div>
      </div>

      <div>
        <Rotulo htmlFor={`valor-${prefixo}`} dica="preenchido pelo produto, editável">
          Valor da venda
        </Rotulo>
        <Campo
          id={`valor-${prefixo}`}
          name="valor"
          inputMode="decimal"
          required
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          placeholder="2.997,00"
        />
      </div>

      {estado.erro && <Aviso>{estado.erro}</Aviso>}

      <div className="flex justify-end gap-2 pt-1">
        <Botao type="button" variante="secundario" onClick={aoCancelar}>
          Cancelar
        </Botao>
        <BotaoEnvio>{rotuloEnvio}</BotaoEnvio>
      </div>
    </form>
  );
}
