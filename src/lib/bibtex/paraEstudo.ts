import type { Autor } from "@/db/schema";
import {
  extrairAno,
  normalizarDoi,
  normalizarTitulo,
  normalizarUrl,
} from "@/lib/normalizar";
import { parseAutores } from "./autores";
import { latexParaUnicode } from "./latex";
import type { EntradaBruta } from "./parser";

export interface EstudoImportado {
  titulo: string;
  tituloNorm: string;
  autores: Autor[];
  ano: number | null;
  veiculo: string | null;
  tipo: string;
  doi: string | null;
  doiNorm: string | null;
  url: string | null;
  resumo: string | null;
  chaveBibtex: string;
  bibtexRaw: string;
}

const TITULO_AUSENTE = "(sem título)";
const RESOLVEDOR_DOI = "https://doi.org/";

const DOI_DENTRO_DE_TEXTO = /10\.\d{4,9}\/[^\s"'<>,;]+/;
const CAMPOS_QUE_PODEM_ESCONDER_DOI = ["url", "note", "howpublished", "eprint"];

const CAMPOS_DE_VEICULO_POR_TIPO: Record<string, string[]> = {
  article: ["journal", "journaltitle", "booktitle"],
  inproceedings: ["booktitle", "eventtitle", "series"],
  conference: ["booktitle", "eventtitle"],
  incollection: ["booktitle", "series"],
  inbook: ["booktitle", "title"],
  book: ["publisher", "series"],
  phdthesis: ["school", "institution"],
  mastersthesis: ["school", "institution"],
  techreport: ["institution", "school"],
  misc: ["howpublished", "publisher", "note"],
};

const CAMPOS_DE_VEICULO_PARA_TIPO_DESCONHECIDO = [
  "journal",
  "booktitle",
  "publisher",
  "institution",
  "school",
  "series",
  "howpublished",
];

type Campos = Record<string, string>;

function primeiroCampoPreenchido(campos: Campos, nomes: string[]): string | null {
  for (const nome of nomes) {
    const valor = campos[nome];
    if (valor && valor.trim() !== "") return latexParaUnicode(valor);
  }
  return null;
}

function extrairDoiDeCamposAlternativos(campos: Campos): string | null {
  for (const nome of CAMPOS_QUE_PODEM_ESCONDER_DOI) {
    const valor = campos[nome];
    if (!valor) continue;

    const doiEncontrado = normalizarDoi(valor.match(DOI_DENTRO_DE_TEXTO)?.[0]);
    if (doiEncontrado) return doiEncontrado;
  }
  return null;
}

function extrairDoi(campos: Campos): string | null {
  return normalizarDoi(campos.doi) ?? extrairDoiDeCamposAlternativos(campos);
}

function extrairVeiculo(campos: Campos, tipo: string): string | null {
  return (
    primeiroCampoPreenchido(campos, CAMPOS_DE_VEICULO_POR_TIPO[tipo] ?? []) ??
    primeiroCampoPreenchido(campos, CAMPOS_DE_VEICULO_PARA_TIPO_DESCONHECIDO)
  );
}

function extrairUrl(campos: Campos, doi: string | null): string | null {
  return normalizarUrl(campos.url) ?? (doi ? `${RESOLVEDOR_DOI}${doi}` : null);
}

export function entradaParaEstudo(entrada: EntradaBruta): EstudoImportado {
  const { campos, tipo, chave } = entrada;

  const titulo = campos.title ? latexParaUnicode(campos.title) : TITULO_AUSENTE;
  const doi = extrairDoi(campos);

  return {
    titulo,
    tituloNorm: normalizarTitulo(titulo),
    autores: parseAutores(campos.author ?? campos.editor),
    ano: extrairAno(campos.year ?? campos.date),
    veiculo: extrairVeiculo(campos, tipo),
    tipo,
    doi,
    doiNorm: doi,
    url: extrairUrl(campos, doi),
    resumo: campos.abstract ? latexParaUnicode(campos.abstract) : null,
    chaveBibtex: chave,
    bibtexRaw: entrada.bruto,
  };
}
