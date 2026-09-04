"use server";

import { revalidatePath } from "next/cache";
import { importarParaOProtocolo } from "@/lib/importacao";
import { resultadoComErro, type ResultadoDaImportacao } from "./resultado";

function textoDoCampo(formData: FormData, nome: string): string {
  const valor = formData.get(nome);
  return typeof valor === "string" ? valor.trim() : "";
}

function paraSegundosUnix(data: string): number {
  return Math.floor(new Date(`${data}T12:00:00`).getTime() / 1000);
}

export async function importarBibtex(
  _resultadoAnterior: ResultadoDaImportacao,
  formData: FormData,
): Promise<ResultadoDaImportacao> {
  const protocoloId = textoDoCampo(formData, "protocoloId");
  const base = textoDoCampo(formData, "base");
  const stringBusca = textoDoCampo(formData, "stringBusca");
  const executadaEm = textoDoCampo(formData, "executadaEm");
  const conteudo = textoDoCampo(formData, "conteudo");

  if (!base) return resultadoComErro("Informe a base em que a busca foi executada.");
  if (!stringBusca) return resultadoComErro("Informe a string de busca usada.");
  if (!executadaEm) return resultadoComErro("Informe a data em que a busca foi executada.");
  if (!conteudo) return resultadoComErro("Cole o conteúdo do arquivo .bib.");

  const resumo = importarParaOProtocolo({
    protocoloId,
    base,
    stringBusca,
    executadaEmSegundos: paraSegundosUnix(executadaEm),
    conteudo,
  });

  if (resumo.entradasLidas === 0) {
    return resultadoComErro(
      "Nenhuma entrada BibTeX válida foi encontrada no conteúdo colado.",
    );
  }

  revalidatePath(`/protocolos/${protocoloId}`);
  revalidatePath(`/protocolos/${protocoloId}/triagem`);

  return {
    estado: "sucesso",
    mensagem: `${resumo.importados} estudo(s) novo(s) importado(s) de ${base}.`,
    importados: resumo.importados,
    duplicatasNoArquivo: resumo.duplicatasNoArquivo,
    jaExistiamNoProtocolo: resumo.jaExistiamNoProtocolo,
    suspeitas: resumo.suspeitas,
    linhasComErro: resumo.linhasComErro,
  };
}
