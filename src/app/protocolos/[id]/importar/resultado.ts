import type { SuspeitaDeDuplicata } from "@/lib/importacao";

export interface ResultadoDaImportacao {
  estado: "inicial" | "sucesso" | "erro";
  mensagem: string;
  importados: number;
  duplicatasNoArquivo: number;
  jaExistiamNoProtocolo: number;
  suspeitas: SuspeitaDeDuplicata[];
  linhasComErro: string[];
}

export const RESULTADO_INICIAL: ResultadoDaImportacao = {
  estado: "inicial",
  mensagem: "",
  importados: 0,
  duplicatasNoArquivo: 0,
  jaExistiamNoProtocolo: 0,
  suspeitas: [],
  linhasComErro: [],
};

export function resultadoComErro(mensagem: string): ResultadoDaImportacao {
  return { ...RESULTADO_INICIAL, estado: "erro", mensagem };
}
