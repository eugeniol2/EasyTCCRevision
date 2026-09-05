import type { SuspeitaDeDuplicata } from "@/lib/importacao";

export interface BuscaEmConflito {
  base: string;
  dataFormatada: string;
  registrosJaVinculados: number;
}

export interface ResultadoDaImportacao {
  estado: "inicial" | "sucesso" | "erro" | "conflito";
  mensagem: string;
  importados: number;
  duplicatasNoArquivo: number;
  jaExistiamNoProtocolo: number;
  suspeitas: SuspeitaDeDuplicata[];
  linhasComErro: string[];
  conflito: BuscaEmConflito | null;
}

export const RESULTADO_INICIAL: ResultadoDaImportacao = {
  estado: "inicial",
  mensagem: "",
  importados: 0,
  duplicatasNoArquivo: 0,
  jaExistiamNoProtocolo: 0,
  suspeitas: [],
  linhasComErro: [],
  conflito: null,
};

export function resultadoComErro(mensagem: string): ResultadoDaImportacao {
  return { ...RESULTADO_INICIAL, estado: "erro", mensagem };
}
