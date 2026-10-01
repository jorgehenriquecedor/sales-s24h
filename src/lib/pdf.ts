import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { PDFDocument, PDFString, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import type { Venda } from "./types";
import { rotularMes } from "./filtros";
import { formatarData, formatarMoeda } from "./format";

const LARGURA = 595.28, ALTURA = 841.89, MARGEM = 40;
const CONTEUDO = LARGURA - 2 * MARGEM, TOPO = ALTURA - 100, PISO = 65;
const NAVY = rgb(0.06, 0.09, 0.15), VERMELHO = rgb(0.83, 0.05, 0.11);
const TINTA = NAVY, NEUTRO = rgb(0.36, 0.41, 0.49), AZUL = rgb(0.09, 0.31, 0.64);
const PAPEL = rgb(0.95, 0.96, 0.98), BRANCO = rgb(1, 1, 1);

export function limparTexto(bruto: string): string {
  return bruto.normalize("NFC").replace(/\s/g, " ")
    .replace(/[^\x20-\x7E\xA0-\xFF‘’“”–—•…€™]/g, "")
    .replace(/ +/g, " ").trim();
}

/** Quebra pela largura da fonte, preservando inclusive palavras muito longas. */
export function quebrarTexto(bruto: string, fonte: PDFFont, tamanho: number, largura: number): string[] {
  const texto = limparTexto(bruto);
  if (!texto) return [""];
  const linhas: string[] = [];
  let atual = "";
  for (const palavra of texto.split(" ")) {
    const candidata = atual ? `${atual} ${palavra}` : palavra;
    if (fonte.widthOfTextAtSize(candidata, tamanho) <= largura) { atual = candidata; continue; }
    if (atual) linhas.push(atual);
    atual = "";
    for (const letra of palavra) {
      if (atual && fonte.widthOfTextAtSize(atual + letra, tamanho) > largura) {
        linhas.push(atual); atual = letra;
      } else atual += letra;
    }
  }
  if (atual) linhas.push(atual);
  return linhas;
}

export type RecorteRelatorio = { periodo: string; produtos: string[]; turmas: string[]; busca?: string };
export type OpcoesRelatorio = { origem?: string };

/** URLs permanentes do painel. Nunca grava URLs assinadas com prazo no PDF. */
export function linksRelatorio(venda: Venda, origem?: string) {
  if (!origem) return { venda: null, comprovante: null };
  const base = new URL(origem);
  if (!["https:", "http:"].includes(base.protocol) || base.username || base.password) {
    throw new Error("Origem inválida para os links do relatório.");
  }
  const detalhe = new URL("/vendas", base.origin);
  detalhe.searchParams.set("venda", venda.id);
  return {
    venda: detalhe.href,
    comprovante: venda.comprovante_path || venda.asaas_comprovante_url
      ? new URL(`/vendas/${encodeURIComponent(venda.id)}/comprovante`, base.origin).href : null,
  };
}

const DATA_HORA = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short", timeStyle: "short", timeZone: "America/Cuiaba",
});

/** Resumo cronológico, seguido de fichas completas com links clicáveis. */
export async function gerarRelatorioPdf(
  vendas: Venda[], recorte: RecorteRelatorio, geradoEm = new Date(), opcoes: OpcoesRelatorio = {},
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const corpo = await doc.embedFont(StandardFonts.Helvetica);
  const forte = await doc.embedFont(StandardFonts.HelveticaBold);
  const logo = await doc.embedPng(await readFile(join(process.cwd(), "public", "logo.png")));
  doc.setTitle("Relatório de vendas - Prova Oral Suporte 24H");
  doc.setProducer("Sales S24H");
  doc.setCreationDate(geradoEm);
  let pagina = doc.addPage([LARGURA, ALTURA]);
  let y = TOPO;

  function novaPagina() { pagina = doc.addPage([LARGURA, ALTURA]); y = TOPO; }
  function reservar(altura: number) { if (y - altura < PISO) novaPagina(); }
  function texto(valor: string, tamanho = 10, negrito = false, cor = TINTA) {
    const fonte = negrito ? forte : corpo;
    for (const linha of quebrarTexto(valor, fonte, tamanho, CONTEUDO)) {
      reservar(tamanho + 5);
      pagina.drawText(linha, { x: MARGEM, y: y - tamanho, size: tamanho, font: fonte, color: cor });
      y -= tamanho + 5;
    }
    y -= 3;
  }
  function link(rotulo: string, url: string, x: number) {
    const tamanho = 9, largura = corpo.widthOfTextAtSize(rotulo, tamanho);
    pagina.drawText(rotulo, { x, y: y - tamanho, size: tamanho, font: corpo, color: AZUL });
    pagina.drawLine({ start: { x, y: y - tamanho - 1 }, end: { x: x + largura, y: y - tamanho - 1 }, color: AZUL, thickness: 0.5 });
    pagina.node.addAnnot(doc.context.register(doc.context.obj({
      Type: "Annot", Subtype: "Link", Rect: [x, y - 12, x + largura, y + 2],
      // URI actions require byte strings. UTF-16 inserts NUL bytes that
      // PDFium readers can interpret as a truncated, invalid address.
      Border: [0, 0, 0], A: { Type: "Action", S: "URI", URI: PDFString.of(url) },
    })));
    return x + largura + 24;
  }

  const ordenadas = [...vendas].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const total = ordenadas.reduce((soma, v) => soma + Math.round(v.valor * 100), 0) / 100;
  texto("Relatório de vendas", 24, true);
  texto(recorte.periodo === "tudo" ? "Todo o período" : rotularMes(recorte.periodo), 13, true);
  texto(`Produtos: ${recorte.produtos.length ? recorte.produtos.join(", ") : "Todos"}`, 9, false, NEUTRO);
  texto(`Turmas: ${recorte.turmas.length ? recorte.turmas.join(", ") : "Todas"}`, 9, false, NEUTRO);
  if (recorte.busca) texto(`Busca: ${recorte.busca}`, 9, false, NEUTRO);
  y -= 8;
  texto(`${ordenadas.length} ${ordenadas.length === 1 ? "venda" : "vendas"} no recorte · ${formatarMoeda(total)}`, 13, true);
  texto("Datas de registro no painel. Valores finais das vendas, após descontos.", 9, false, NEUTRO);
  y -= 8;

  const larguras = [78, CONTEUDO - 181, 103];
  function cabecalhoTabela() {
    reservar(45);
    pagina.drawRectangle({ x: MARGEM, y: y - 23, width: CONTEUDO, height: 23, color: NAVY });
    let x = MARGEM + 8;
    ["DATA", "COMPRADOR", "VALOR TOTAL"].forEach((valor, i) => {
      pagina.drawText(valor, { x, y: y - 15, size: 8, font: forte, color: BRANCO });
      x += larguras[i];
    });
    y -= 23;
  }
  cabecalhoTabela();
  ordenadas.forEach((venda, indice) => {
    const campos = [formatarData(venda.created_at), venda.comprador_nome, formatarMoeda(venda.valor)]
      .map((campo, i) => quebrarTexto(campo, corpo, 9, larguras[i] - 16));
    const numeroLinhas = Math.max(...campos.map((campo) => campo.length));
    let inicio = 0;
    while (inicio < numeroLinhas) {
      if (y - 23 < PISO) { novaPagina(); cabecalhoTabela(); }
      const quantidade = Math.min(numeroLinhas - inicio, Math.max(1, Math.floor((y - PISO - 10) / 13)));
      const altura = 10 + quantidade * 13;
      if (indice % 2 === 1) pagina.drawRectangle({ x: MARGEM, y: y - altura, width: CONTEUDO, height: altura, color: PAPEL });
      let x = MARGEM + 8;
      campos.forEach((campo, coluna) => {
        campo.slice(inicio, inicio + quantidade).forEach((linha, linhaIndice) => {
          pagina.drawText(linha, { x, y: y - 14 - linhaIndice * 13, font: corpo, size: 9, color: TINTA });
        });
        x += larguras[coluna];
      });
      inicio += quantidade; y -= altura;
    }
  });
  if (!ordenadas.length) { y -= 12; texto("Nenhuma venda aprovada neste recorte."); }

  if (ordenadas.length) {
    novaPagina();
    texto("Detalhes das vendas", 22, true);
    texto("Os links abrem o painel e seus comprovantes. É necessário entrar no sistema.", 9, false, NEUTRO);
    y -= 8;
    ordenadas.forEach((venda, indice) => {
      const campos: { valor: string; tamanho: number; negrito?: boolean }[] = [
        { valor: `${String(indice + 1).padStart(2, "0")} · ${venda.comprador_nome}`, tamanho: 12, negrito: true },
        { valor: `Data do registro: ${formatarData(venda.created_at)} · Valor: ${formatarMoeda(venda.valor)}`, tamanho: 10 },
        { valor: `Situação: ${venda.pagamento_status === "aprovada" ? "Aprovada" : venda.pagamento_status === "expirada" ? "Expirada" : "Pendente"} · ${venda.modo_venda === "checkout" ? "Com Checkout Asaas" : "Sem Checkout"}`, tamanho: 9 },
        { valor: `Produtos: ${venda.itens?.length ? venda.itens.map((item) => item.produto_nome).join(" + ") : venda.produto_nome}`, tamanho: 10 },
        { valor: `Turma: ${venda.turma_nome || "Não informada"}`, tamanho: 9 },
        { valor: `Telefone: ${venda.comprador_telefone || "Não informado"} · E-mail: ${venda.comprador_email || "Não informado"}`, tamanho: 9 },
      ];
      if (venda.desconto_tipo && venda.desconto_tipo !== "nenhum") {
        campos.push({ valor: `Valor original: ${formatarMoeda(venda.valor_bruto)} · Desconto: ${venda.desconto_tipo === "percentual" ? `${venda.desconto_valor}%` : formatarMoeda(venda.desconto_valor)}`, tamanho: 9 });
        if (venda.desconto_observacao) campos.push({ valor: `Observação do desconto: ${venda.desconto_observacao}`, tamanho: 9 });
      }
      campos.push({ valor: `Registro: ${venda.id}`, tamanho: 8 });
      if (venda.asaas_pagamento_id) campos.push({ valor: `Cobrança Asaas: ${venda.asaas_pagamento_id}`, tamanho: 8 });
      const links = linksRelatorio(venda, opcoes.origem);
      if (!links.comprovante) campos.push({ valor: "Comprovante: não disponível.", tamanho: 9 });
      const altura = campos.reduce((soma, campo) => soma + quebrarTexto(campo.valor, campo.negrito ? forte : corpo, campo.tamanho, CONTEUDO).length * (campo.tamanho + 5) + 3, 0) + 42;
      // Fichas que cabem em uma página ficam inteiras; textos excepcionais
      // continuam na página seguinte sem cortes nem sobreposição do rodapé.
      reservar(Math.min(altura, TOPO - PISO));
      campos.forEach((campo) => texto(campo.valor, campo.tamanho, campo.negrito));
      if (links.venda) {
        reservar(20);
        const x = link("Abrir venda", links.venda, MARGEM);
        if (links.comprovante) link("Abrir comprovante", links.comprovante, x);
        y -= 22;
      }
      y -= 10;
      if (y > PISO) pagina.drawLine({ start: { x: MARGEM, y }, end: { x: LARGURA - MARGEM, y }, color: PAPEL, thickness: 1 });
      y -= 12;
    });
  }
  const paginas = doc.getPages();
  paginas.forEach((p, i) => {
    p.drawRectangle({ x: 0, y: ALTURA - 72, width: LARGURA, height: 72, color: NAVY });
    p.drawRectangle({ x: 0, y: ALTURA - 75, width: LARGURA, height: 3, color: VERMELHO });
    p.drawImage(logo, { x: MARGEM - 5, y: ALTURA - 62, width: 34, height: 45 });
    p.drawText("Prova Oral | Suporte 24H", { x: MARGEM + 38, y: ALTURA - 32, font: forte, size: 13, color: BRANCO });
    p.drawText(`RELATÓRIO DE VENDAS · Emitido em ${DATA_HORA.format(geradoEm)}`, { x: MARGEM + 38, y: ALTURA - 49, font: corpo, size: 8, color: BRANCO });
    p.drawText("Controle de Vendas - Prova Oral Suporte 24H", { x: MARGEM, y: 35, size: 8, font: corpo, color: NEUTRO });
    const rodape = `Página ${i + 1} de ${paginas.length}`;
    p.drawText(rodape, { x: LARGURA - MARGEM - corpo.widthOfTextAtSize(rodape, 8), y: 35, size: 8, font: corpo, color: NEUTRO });
  });
  return doc.save();
}

export function nomeArquivoRelatorio(periodo: string, hoje = new Date()): string {
  const data = hoje.toISOString().slice(0, 10);
  const trecho = periodo === "tudo" ? "completo" : rotularMes(periodo).toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "-");
  return `relatorio-vendas-${trecho}-${data}.pdf`;
}
