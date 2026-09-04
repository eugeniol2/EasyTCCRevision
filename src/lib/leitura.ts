import { entradaParaEstudo, type EstudoImportado } from "@/lib/bibtex/paraEstudo";
import { parseBibtex } from "@/lib/bibtex/parser";
import { csvParaEstudos } from "@/lib/csv/paraEstudo";

export type FormatoDeArquivo = "bibtex" | "csv" | "desconhecido";

const ENTRADA_BIBTEX = /^\s*@[A-Za-z]+\s*[{(]/m;

export function detectarFormato(conteudo: string): FormatoDeArquivo {
  if (conteudo.trim() === "") return "desconhecido";
  if (ENTRADA_BIBTEX.test(conteudo)) return "bibtex";

  const primeiraLinha = conteudo.split(/\r?\n/, 1)[0] ?? "";
  if (primeiraLinha.includes(",")) return "csv";

  return "desconhecido";
}

export interface LeituraDeArquivo {
  formato: FormatoDeArquivo;
  estudos: EstudoImportado[];
  erros: string[];
}

export function lerArquivo(conteudo: string): LeituraDeArquivo {
  const formato = detectarFormato(conteudo);

  if (formato === "bibtex") {
    const { entradas, erros } = parseBibtex(conteudo);
    return {
      formato,
      estudos: entradas.map(entradaParaEstudo),
      erros: erros.map((erro) => `Linha ${erro.linha}: ${erro.mensagem}`),
    };
  }

  if (formato === "csv") {
    const { estudos, erros } = csvParaEstudos(conteudo);
    return { formato, estudos, erros };
  }

  return {
    formato,
    estudos: [],
    erros: ["Formato não reconhecido. Envie um arquivo .bib ou .csv."],
  };
}
