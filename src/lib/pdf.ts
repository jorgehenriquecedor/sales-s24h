import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFImage,
  type PDFPage,
  type RGB,
} from "pdf-lib";
import type { Venda } from "./types";
import { rotularMes } from "./filtros";

/* ------------------------------------------------------------------ */
/* Paleta — os mesmos hexadecimais do painel (src/app/globals.css)      */
/* ------------------------------------------------------------------ */

function cor(hex: string): RGB {
  const n = parseInt(hex.slice(1), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

const NAVY = cor("#0f1626");
const BRASA = cor("#d40c1b");
const TINTA = cor("#101828");
const NEUTRO = cor("#667085");
const BORDA = cor("#e6e8ee");
const PAPEL = cor("#f7f8fb");
const BRANCO = cor("#ffffff");

/* ------------------------------------------------------------------ */
/* Medidas                                                             */
/* ------------------------------------------------------------------ */

const PAGINA = { largura: 595.28, altura: 841.89 }; // A4 retrato
const MARGEM = 40;
const CONTEUDO = PAGINA.largura - MARGEM * 2;

const FAIXA_CAPA = 80;
const FAIXA_SEGUINTE = 46;
const ALTURA_LINHA = 19;
const ALTURA_CABECALHO_TABELA = 20;
const ALTURA_TOTAL = 56;
const PISO = 66; // espaço reservado para o rodapé

type Alinhamento = "esquerda" | "direita";

const COLUNAS: {
  rotulo: string;
  largura: number;
  alinhamento: Alinhamento;
  valor: (v: Venda) => string;
}[] = [
  { rotulo: "Comprador", largura: 132, alinhamento: "esquerda", valor: (v) => v.comprador_nome },
  { rotulo: "Telefone", largura: 87, alinhamento: "esquerda", valor: (v) => v.comprador_telefone || "—" },
  { rotulo: "Produto", largura: 132, alinhamento: "esquerda", valor: (v) => v.itens?.length
    ? v.itens.map((item) => item.produto_nome).join(" + ") : v.produto_nome },
  { rotulo: "Turma", largura: 84, alinhamento: "esquerda", valor: (v) => v.turma_nome },
  { rotulo: "Valor", largura: 80, alinhamento: "direita", valor: (v) => moeda(v.valor) },
];

/* ------------------------------------------------------------------ */
/* Texto                                                               */
/* ------------------------------------------------------------------ */

/**
 * As fontes padrão do PDF usam WinAnsi, que cobre todo o português mas não
 * emoji nem alfabetos fora do latim. Como o nome do comprador é digitado à
 * mão, o que não for representável sai fora — senão a exportação inteira
 * quebraria por causa de um caractere.
 */
const NAO_REPRESENTAVEL =
  /[^\x20-\x7E\xA0-\xFF‘’“”–—•…€™]/g;

export function limparTexto(bruto: string): string {
  // A ordem importa: primeiro toda quebra de linha e tabulação vira espaço
  // (senão elas seriam apagadas junto com o resto e colariam as palavras),
  // depois cai o que a fonte não representa, e só então os espaços que
  // sobraram no lugar do que saiu são colapsados.
  return bruto
    .normalize("NFC")
    .replace(/\s/g, " ")
    .replace(NAO_REPRESENTAVEL, "")
    .replace(/ +/g, " ")
    .trim();
}

const MOEDA = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function moeda(valor: number): string {
  return MOEDA.format(Number.isFinite(valor) ? valor : 0);
}

const DATA_HORA = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});

/** Corta com reticências quando não cabe na largura da coluna. */
function caber(texto: string, fonte: PDFFont, tamanho: number, largura: number): string {
  if (fonte.widthOfTextAtSize(texto, tamanho) <= largura) return texto;

  let corte = texto;
  while (corte.length > 1 && fonte.widthOfTextAtSize(`${corte}…`, tamanho) > largura) {
    corte = corte.slice(0, -1);
  }
  return `${corte}…`;
}

/** Quebra o texto pela largura real da fonte, sem descartar nenhum produto. */
export function quebrarTexto(
  bruto: string, fonte: PDFFont, tamanho: number, largura: number,
): string[] {
  const texto = limparTexto(bruto);
  if (!texto) return [""];
  const linhas: string[] = [];
  let atual = "";
  for (const palavra of texto.split(" ")) {
    const candidata = atual ? `${atual} ${palavra}` : palavra;
    if (fonte.widthOfTextAtSize(candidata, tamanho) <= largura) {
      atual = candidata;
      continue;
    }
    if (atual) linhas.push(atual);
    atual = "";
    for (const letra of Array.from(palavra)) {
      if (atual && fonte.widthOfTextAtSize(atual + letra, tamanho) > largura) {
        linhas.push(atual);
        atual = letra;
      } else {
        atual += letra;
      }
    }
  }
  if (atual) linhas.push(atual);
  return linhas;
}

type OpcoesTexto = {
  x: number;
  y: number;
  fonte: PDFFont;
  tamanho: number;
  cor: RGB;
  largura?: number;
  alinhamento?: Alinhamento;
  opacidade?: number;
};

function escrever(pagina: PDFPage, bruto: string, o: OpcoesTexto) {
  const texto = o.largura
    ? caber(limparTexto(bruto), o.fonte, o.tamanho, o.largura)
    : limparTexto(bruto);

  const x =
    o.alinhamento === "direita" && o.largura
      ? o.x + o.largura - o.fonte.widthOfTextAtSize(texto, o.tamanho)
      : o.x;

  pagina.drawText(texto, {
    x,
    y: o.y,
    size: o.tamanho,
    font: o.fonte,
    color: o.cor,
    opacity: o.opacidade,
  });
}

/* ------------------------------------------------------------------ */
/* Documento                                                           */
/* ------------------------------------------------------------------ */

type Fontes = {
  corpo: PDFFont;
  corpoForte: PDFFont;
  titulo: PDFFont;
};

export type RecorteRelatorio = {
  periodo: string;
  produtos: string[];
  turmas: string[];
};

function faixaCapa(
  pagina: PDFPage,
  fontes: Fontes,
  geradoEm: Date,
  logo: PDFImage,
): number {
  const topo = PAGINA.altura;

  pagina.drawRectangle({
    x: 0,
    y: topo - FAIXA_CAPA,
    width: PAGINA.largura,
    height: FAIXA_CAPA,
    color: NAVY,
  });

  // Fio vermelho na base da faixa, o mesmo destaque do painel.
  pagina.drawRectangle({
    x: 0,
    y: topo - FAIXA_CAPA,
    width: PAGINA.largura,
    height: 3,
    color: BRASA,
  });

  pagina.drawImage(logo, {
    x: MARGEM - 6,
    y: topo - 60,
    width: 36,
    height: 47,
  });

  escrever(pagina, "Prova Oral", {
    x: MARGEM + 34,
    y: topo - 38,
    fonte: fontes.corpoForte,
    tamanho: 13,
    cor: BRANCO,
  });
  escrever(pagina, "SUPORTE 24H", {
    x: MARGEM + 34,
    y: topo - 50,
    fonte: fontes.corpo,
    tamanho: 7,
    cor: BRANCO,
    opacidade: 0.62,
  });

  escrever(pagina, "Relatório de vendas", {
    x: MARGEM,
    y: topo - 40,
    fonte: fontes.titulo,
    tamanho: 21,
    cor: BRANCO,
    largura: CONTEUDO,
    alinhamento: "direita",
  });
  escrever(pagina, `Emitido em ${DATA_HORA.format(geradoEm)}`, {
    x: MARGEM,
    y: topo - 54,
    fonte: fontes.corpo,
    tamanho: 8,
    cor: BRANCO,
    opacidade: 0.62,
    largura: CONTEUDO,
    alinhamento: "direita",
  });

  return topo - FAIXA_CAPA;
}

function faixaContinuacao(pagina: PDFPage, fontes: Fontes): number {
  const topo = PAGINA.altura;

  pagina.drawRectangle({
    x: 0,
    y: topo - FAIXA_SEGUINTE,
    width: PAGINA.largura,
    height: FAIXA_SEGUINTE,
    color: NAVY,
  });
  pagina.drawRectangle({
    x: 0,
    y: topo - FAIXA_SEGUINTE,
    width: PAGINA.largura,
    height: 2,
    color: BRASA,
  });

  escrever(pagina, "Relatório de vendas", {
    x: MARGEM,
    y: topo - 29,
    fonte: fontes.titulo,
    tamanho: 12,
    cor: BRANCO,
  });
  escrever(pagina, "continuação", {
    x: MARGEM,
    y: topo - 29,
    fonte: fontes.corpo,
    tamanho: 8,
    cor: BRANCO,
    opacidade: 0.55,
    largura: CONTEUDO,
    alinhamento: "direita",
  });

  return topo - FAIXA_SEGUINTE;
}

/** Bloco que diz, em três campos, qual recorte gerou este relatório. */
function blocoRecorte(
  pagina: PDFPage,
  fontes: Fontes,
  recorte: RecorteRelatorio,
  y: number,
): number {
  const campos = [
    {
      rotulo: "PERÍODO",
      valor: recorte.periodo === "tudo" ? "Todo o período" : rotularMes(recorte.periodo),
    },
    {
      rotulo: "PRODUTOS",
      valor: recorte.produtos.length > 0 ? recorte.produtos.join(", ") : "Todos",
    },
    {
      rotulo: "TURMAS",
      valor: recorte.turmas.length > 0 ? recorte.turmas.join(", ") : "Todas",
    },
  ];

  const larguras = [130, 220, 165]; // período, produtos, turmas
  const topo = y - 26;

  campos.forEach((campo, i) => {
    const x = MARGEM + larguras.slice(0, i).reduce((a, b) => a + b, 0);
    const larguraCampo = larguras[i];
    escrever(pagina, campo.rotulo, {
      x,
      y: topo,
      fonte: fontes.corpoForte,
      tamanho: 7,
      cor: NEUTRO,
    });
    escrever(pagina, campo.valor, {
      x,
      y: topo - 13,
      fonte: fontes.corpo,
      tamanho: 9.5,
      cor: TINTA,
      largura: larguraCampo - 12,
    });
  });

  return topo - 28;
}

function cabecalhoTabela(pagina: PDFPage, fontes: Fontes, y: number): number {
  pagina.drawRectangle({
    x: MARGEM,
    y: y - ALTURA_CABECALHO_TABELA,
    width: CONTEUDO,
    height: ALTURA_CABECALHO_TABELA,
    color: PAPEL,
  });
  pagina.drawRectangle({
    x: MARGEM,
    y: y - ALTURA_CABECALHO_TABELA,
    width: CONTEUDO,
    height: 1,
    color: BRASA,
  });

  let x = MARGEM;
  for (const coluna of COLUNAS) {
    escrever(pagina, coluna.rotulo.toUpperCase(), {
      x: x + 8,
      y: y - 13.5,
      fonte: fontes.corpoForte,
      tamanho: 7,
      cor: NEUTRO,
      largura: coluna.largura - 16,
      alinhamento: coluna.alinhamento,
    });
    x += coluna.largura;
  }

  return y - ALTURA_CABECALHO_TABELA;
}

function linhaVenda(
  pagina: PDFPage,
  fontes: Fontes,
  venda: Venda,
  y: number,
  par: boolean,
  linhasProduto: string[],
  continuacao: boolean,
) {
  const altura = Math.max(ALTURA_LINHA, 8 + linhasProduto.length * 11);
  if (par) {
    pagina.drawRectangle({
      x: MARGEM,
      y: y - altura,
      width: CONTEUDO,
      height: altura,
      color: PAPEL,
    });
  }

  let x = MARGEM;
  for (const [i, coluna] of COLUNAS.entries()) {
    if (i === 2) {
      linhasProduto.forEach((linha, indice) => escrever(pagina, linha, {
        x: x + 8,
        y: y - 13 - indice * 11,
        fonte: fontes.corpo,
        tamanho: 8.5,
        cor: TINTA,
      }));
      x += coluna.largura;
      continue;
    }
    if (continuacao && i !== 0) {
      x += coluna.largura;
      continue;
    }
    const destaque = i === 0 || coluna.alinhamento === "direita";
    escrever(pagina, continuacao ? `${venda.comprador_nome} (cont.)` : coluna.valor(venda), {
      x: x + 8,
      y: y - 13,
      fonte: destaque ? fontes.corpoForte : fontes.corpo,
      tamanho: 8.5,
      cor: i === 1 || i === 3 ? NEUTRO : TINTA,
      largura: coluna.largura - 16,
      alinhamento: coluna.alinhamento,
    });
    x += coluna.largura;
  }
  return altura;
}

function blocoTotal(
  pagina: PDFPage,
  fontes: Fontes,
  total: number,
  quantidade: number,
  y: number,
) {
  const topo = y - ALTURA_TOTAL;

  pagina.drawRectangle({
    x: MARGEM,
    y: topo,
    width: CONTEUDO,
    height: ALTURA_TOTAL,
    color: NAVY,
  });
  pagina.drawRectangle({
    x: MARGEM,
    y: topo,
    width: 4,
    height: ALTURA_TOTAL,
    color: BRASA,
  });

  escrever(pagina, "TOTAL DO RECORTE", {
    x: MARGEM + 18,
    y: y - 22,
    fonte: fontes.corpoForte,
    tamanho: 7.5,
    cor: BRANCO,
    opacidade: 0.6,
  });
  escrever(pagina, `${quantidade} ${quantidade === 1 ? "venda" : "vendas"}`, {
    x: MARGEM + 18,
    y: y - 38,
    fonte: fontes.corpo,
    tamanho: 10,
    cor: BRANCO,
    opacidade: 0.85,
  });

  escrever(pagina, moeda(total), {
    x: MARGEM,
    y: y - 38,
    fonte: fontes.titulo,
    tamanho: 22,
    cor: BRANCO,
    largura: CONTEUDO - 18,
    alinhamento: "direita",
  });
}

function rodapes(paginas: PDFPage[], fontes: Fontes) {
  paginas.forEach((pagina, i) => {
    pagina.drawRectangle({
      x: MARGEM,
      y: 50,
      width: CONTEUDO,
      height: 0.7,
      color: BORDA,
    });

    escrever(pagina, "Controle de Vendas — Prova Oral Suporte 24h", {
      x: MARGEM,
      y: 38,
      fonte: fontes.corpo,
      tamanho: 7.5,
      cor: NEUTRO,
    });
    escrever(pagina, `Página ${i + 1} de ${paginas.length}`, {
      x: MARGEM,
      y: 38,
      fonte: fontes.corpo,
      tamanho: 7.5,
      cor: NEUTRO,
      largura: CONTEUDO,
      alinhamento: "direita",
    });
  });
}

/* ------------------------------------------------------------------ */
/* Montagem                                                            */
/* ------------------------------------------------------------------ */

/**
 * Relatório em PDF paginado: uma linha compacta por venda e o total do
 * recorte fechando o documento. Usa a logo oficial no cabeçalho da capa.
 */
export async function gerarRelatorioPdf(
  vendas: Venda[],
  recorte: RecorteRelatorio,
  geradoEm: Date = new Date(),
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const logo = await doc.embedPng(await readFile(join(process.cwd(), "public", "logo.png")));

  const fontes: Fontes = {
    corpo: await doc.embedFont(StandardFonts.Helvetica),
    corpoForte: await doc.embedFont(StandardFonts.HelveticaBold),
    titulo: await doc.embedFont(StandardFonts.TimesRomanBold),
  };

  doc.setTitle("Relatório de vendas");
  doc.setProducer("Controle de Vendas — Prova Oral Suporte 24h");
  doc.setCreationDate(geradoEm);

  const paginas: PDFPage[] = [];

  function novaPagina(capa: boolean): number {
    const pagina = doc.addPage([PAGINA.largura, PAGINA.altura]);
    paginas.push(pagina);
    return capa
      ? blocoRecorte(pagina, fontes, recorte, faixaCapa(pagina, fontes, geradoEm, logo))
      : faixaContinuacao(pagina, fontes) - 18;
  }

  let y = novaPagina(true);
  let pagina = paginas[paginas.length - 1];
  y = cabecalhoTabela(pagina, fontes, y);

  // Da mais antiga para a mais recente: um relatório se lê no sentido do tempo.
  const ordenadas = [...vendas].sort((a, b) =>
    a.created_at.localeCompare(b.created_at),
  );

  ordenadas.forEach((venda, i) => {
    const linhas = quebrarTexto(
      COLUNAS[2].valor(venda), fontes.corpo, 8.5, COLUNAS[2].largura - 16,
    );
    let lidas = 0;
    while (lidas < linhas.length) {
      if (y - ALTURA_LINHA < PISO) {
        y = novaPagina(false);
        pagina = paginas[paginas.length - 1];
        y = cabecalhoTabela(pagina, fontes, y);
      }
      const capacidade = Math.max(1, Math.floor((y - PISO - 8) / 11));
      const trecho = linhas.slice(lidas, lidas + capacidade);
      y -= linhaVenda(pagina, fontes, venda, y, i % 2 === 1, trecho, lidas > 0);
      lidas += trecho.length;
    }
  });

  if (ordenadas.length === 0) {
    escrever(pagina, "Nenhuma venda neste recorte.", {
      x: MARGEM,
      y: y - 26,
      fonte: fontes.corpo,
      tamanho: 10,
      cor: NEUTRO,
    });
    y -= 40;
  }

  // O total nunca fica órfão numa página sozinho sem caber inteiro.
  if (y - ALTURA_TOTAL - 16 < PISO) {
    y = novaPagina(false);
    pagina = paginas[paginas.length - 1];
  }

  const total = ordenadas.reduce((soma, v) => soma + v.valor, 0);
  blocoTotal(pagina, fontes, total, ordenadas.length, y - 16);

  rodapes(paginas, fontes);

  return doc.save();
}

/** relatorio-vendas-setembro-2026-2026-09-09.pdf */
export function nomeArquivoRelatorio(periodo: string, hoje = new Date()): string {
  const data = hoje.toISOString().slice(0, 10);
  const trecho =
    periodo === "tudo"
      ? "completo"
      : rotularMes(periodo)
          .toLowerCase()
          .normalize("NFD")
          .replace(/[̀-ͯ]/g, "")
          .replace(/\s+/g, "-");
  return `relatorio-vendas-${trecho}-${data}.pdf`;
}
