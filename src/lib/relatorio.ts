import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { busca, criterio, estudo, estudoBusca, triagem } from "@/db/schema";
import { formatarAutores } from "@/lib/bibtex/autores";
import {
  buscarProtocolo,
  contarPorDecisao,
  LEITURA_COMPLETA,
  TRIAGEM_INICIAL,
} from "@/lib/consultas";
import { listarCampos, listarEstudosParaExtracao } from "@/lib/extracao";

export interface ExclusaoPorCriterio {
  codigo: string;
  descricao: string;
  quantidade: number;
}

export interface BuscaExecutada {
  base: string;
  stringBusca: string;
  executadaEm: number;
  totalResultados: number | null;
}

export interface Prisma {
  identificados: number;
  duplicatasRemovidas: number;
  triados: number;
  excluidosNaTriagem: number;
  excluidosPorCriterioNaTriagem: ExclusaoPorCriterio[];
  emDuvidaNaTriagem: number;
  pendentesNaTriagem: number;
  avaliadosPorTextoCompleto: number;
  excluidosNaLeitura: number;
  excluidosPorCriterioNaLeitura: ExclusaoPorCriterio[];
  pendentesNaLeitura: number;
  incluidos: number;
  buscas: BuscaExecutada[];
}

function exclusoesPorCriterio(
  protocoloId: string,
  estagio: typeof TRIAGEM_INICIAL | typeof LEITURA_COMPLETA,
): ExclusaoPorCriterio[] {
  return db
    .select({
      codigo: criterio.codigo,
      descricao: criterio.descricao,
      quantidade: sql<number>`count(*)`,
    })
    .from(triagem)
    .innerJoin(estudo, eq(estudo.id, triagem.estudoId))
    .innerJoin(criterio, eq(criterio.id, triagem.criterioId))
    .where(
      and(
        eq(estudo.protocoloId, protocoloId),
        eq(triagem.estagio, estagio),
        eq(triagem.decisao, "excluido"),
      ),
    )
    .groupBy(criterio.id)
    .orderBy(criterio.ordem)
    .all();
}

export function montarPrisma(protocoloId: string): Prisma {
  const registrosDeBusca = db
    .select()
    .from(busca)
    .where(eq(busca.protocoloId, protocoloId))
    .orderBy(busca.executadaEm)
    .all();

  const vinculos = db
    .select({ quantidade: sql<number>`count(*)` })
    .from(estudoBusca)
    .innerJoin(busca, eq(busca.id, estudoBusca.buscaId))
    .where(eq(busca.protocoloId, protocoloId))
    .get();

  const naTriagem = contarPorDecisao(protocoloId, TRIAGEM_INICIAL);
  const naLeitura = contarPorDecisao(protocoloId, LEITURA_COMPLETA);

  const identificados = registrosDeBusca.reduce(
    (total, item) => total + (item.totalResultados ?? 0),
    0,
  );
  const registrosVinculados = vinculos?.quantidade ?? 0;

  return {
    identificados: Math.max(identificados, registrosVinculados),
    duplicatasRemovidas: Math.max(identificados, registrosVinculados) - naTriagem.total,
    triados: naTriagem.total,
    excluidosNaTriagem: naTriagem.excluido,
    excluidosPorCriterioNaTriagem: exclusoesPorCriterio(protocoloId, TRIAGEM_INICIAL),
    emDuvidaNaTriagem: naTriagem.duvida,
    pendentesNaTriagem: naTriagem.pendente,
    avaliadosPorTextoCompleto: naLeitura.total,
    excluidosNaLeitura: naLeitura.excluido,
    excluidosPorCriterioNaLeitura: exclusoesPorCriterio(protocoloId, LEITURA_COMPLETA),
    pendentesNaLeitura: naLeitura.pendente,
    incluidos: naLeitura.incluido,
    buscas: registrosDeBusca.map((item) => ({
      base: item.base,
      stringBusca: item.stringBusca,
      executadaEm: item.executadaEm,
      totalResultados: item.totalResultados,
    })),
  };
}

function primeiroAutor(
  autores: { family?: string; given?: string; literal?: string }[],
): string {
  const primeiro = autores[0];
  const sobrenome =
    primeiro?.family ?? primeiro?.literal ?? primeiro?.given ?? "Autor desconhecido";

  return autores.length > 1 ? `${sobrenome} et al.` : sobrenome;
}

function escaparParaLatex(texto: string): string {
  return texto
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/([&%$#_{}])/g, "\\$1")
    .replace(/~/g, "\\textasciitilde{}")
    .replace(/\^/g, "\\textasciicircum{}");
}

export interface LinhaDaTabela {
  autor: string;
  ano: string;
  celulas: string[];
}

export interface TabelaDeTrabalhos {
  colunas: string[];
  linhas: LinhaDaTabela[];
}

export function montarTabelaDeTrabalhos(protocoloId: string): TabelaDeTrabalhos {
  const campos = listarCampos(protocoloId);
  const estudos = listarEstudosParaExtracao(protocoloId);

  return {
    colunas: campos.map((campo) => campo.nome),
    linhas: estudos.map((item) => ({
      autor: primeiroAutor(item.autores),
      ano: String(item.ano ?? "s.d."),
      celulas: campos.map((campo) => item.valores[campo.id] ?? "—"),
    })),
  };
}

export interface EstudoIncluido {
  id: string;
  titulo: string;
  autores: string;
  ano: number | null;
  veiculo: string | null;
  doi: string | null;
  url: string | null;
}

export function listarEstudosIncluidos(protocoloId: string): EstudoIncluido[] {
  return listarEstudosParaExtracao(protocoloId).map((item) => ({
    id: item.id,
    titulo: item.titulo,
    autores: formatarAutores(item.autores, 20),
    ano: item.ano,
    veiculo: item.veiculo,
    doi: item.doi,
    url: item.url,
  }));
}

export function tabelaEmLatex(protocoloId: string, tituloDaRevisao: string): string {
  const campos = listarCampos(protocoloId);
  const estudos = listarEstudosParaExtracao(protocoloId);

  if (estudos.length === 0) return "";

  const colunas = `ll${"p{3cm}".repeat(campos.length)}`;
  const cabecalho = [
    "\\textbf{Autor}",
    "\\textbf{Ano}",
    ...campos.map((campo) => `\\textbf{${escaparParaLatex(campo.nome)}}`),
  ];

  const linhas = estudos.map((item) =>
    [
      escaparParaLatex(primeiroAutor(item.autores)),
      escaparParaLatex(String(item.ano ?? "s.d.")),
      ...campos.map((campo) => escaparParaLatex(item.valores[campo.id] ?? "—")),
    ].join(" & "),
  );

  return [
    "\\begin{table}[htbp]",
    "\\centering",
    `\\caption{Trabalhos relacionados — ${escaparParaLatex(tituloDaRevisao)}}`,
    "\\label{tab:trabalhos-relacionados}",
    "\\small",
    `\\begin{tabular}{${colunas}}`,
    "\\hline",
    `${cabecalho.join(" & ")} \\\\`,
    "\\hline",
    ...linhas.map((linha) => `${linha} \\\\`),
    "\\hline",
    "\\end{tabular}",
    "\\end{table}",
  ].join("\n");
}

function formatarData(segundosUnix: number): string {
  return new Date(segundosUnix * 1000).toLocaleDateString("pt-BR");
}

function listarExclusoes(exclusoes: ExclusaoPorCriterio[]): string {
  if (exclusoes.length === 0) return "";
  return ` (${exclusoes
    .map((item) => `${item.quantidade} por ${item.codigo}`)
    .join(", ")})`;
}

export function textoDaMetodologia(protocoloId: string): string {
  const protocolo = buscarProtocolo(protocoloId);
  if (!protocolo) return "";

  const prisma = montarPrisma(protocoloId);
  const bases = [...new Set(prisma.buscas.map((item) => item.base))];
  const datas = prisma.buscas.map((item) => formatarData(item.executadaEm));

  const paragrafos: string[] = [];

  if (protocolo.questaoPesquisa) {
    paragrafos.push(
      `Esta revisão sistemática buscou responder à seguinte questão de pesquisa: "${protocolo.questaoPesquisa}".`,
    );
  }

  const recorte =
    protocolo.anoInicio && protocolo.anoFim
      ? `, restrita a publicações entre ${protocolo.anoInicio} e ${protocolo.anoFim}`
      : "";

  paragrafos.push(
    `A busca foi executada em ${bases.length} base(s) de dados — ${bases.join(", ")} —` +
      ` em ${[...new Set(datas)].join(" e ")}${recorte}. ` +
      `Foram identificados ${prisma.identificados} registro(s).`,
  );

  if (prisma.duplicatasRemovidas > 0) {
    paragrafos.push(
      `Após a remoção de ${prisma.duplicatasRemovidas} duplicata(s), ${prisma.triados} estudo(s) ` +
        `foram triados por título e resumo.`,
    );
  }

  paragrafos.push(
    `Na triagem por título e resumo, ${prisma.excluidosNaTriagem} estudo(s) foram excluídos` +
      `${listarExclusoes(prisma.excluidosPorCriterioNaTriagem)}. ` +
      `Os ${prisma.avaliadosPorTextoCompleto} restante(s) passaram por leitura de texto completo, ` +
      `da qual ${prisma.excluidosNaLeitura} foram excluídos` +
      `${listarExclusoes(prisma.excluidosPorCriterioNaLeitura)}.`,
  );

  paragrafos.push(
    `Ao final, ${prisma.incluidos} estudo(s) compuseram o conjunto analisado nesta revisão.`,
  );

  return paragrafos.join("\n\n");
}
