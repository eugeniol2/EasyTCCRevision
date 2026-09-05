"use server";

import { revalidatePath } from "next/cache";
import { exigirProtocolo } from "@/lib/autorizacao";
import { encontrarBuscaIdentica, importarParaOProtocolo } from "@/lib/importacao";
import {
  RESULTADO_INICIAL,
  resultadoComErro,
  type ResultadoDaImportacao,
} from "./resultado";

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
  if (!conteudo) return resultadoComErro("Escolha o arquivo exportado ou cole o conteúdo.");

  await exigirProtocolo(protocoloId);

  const executadaEmSegundos = paraSegundosUnix(executadaEm);
  const modo = textoDoCampo(formData, "modo");
  const identica = await encontrarBuscaIdentica(
    protocoloId,
    base,
    stringBusca,
    executadaEmSegundos,
  );

  if (identica && modo === "") {
    return {
      ...RESULTADO_INICIAL,
      estado: "conflito",
      mensagem: "Esta busca já foi registrada.",
      conflito: {
        base: identica.base,
        dataFormatada: new Date(identica.executadaEm * 1000).toLocaleDateString("pt-BR"),
        registrosJaVinculados: identica.registrosJaVinculados,
      },
    };
  }

  const resumo = await importarParaOProtocolo({
    protocoloId,
    base,
    stringBusca,
    executadaEmSegundos,
    conteudo,
    anexarABusca: modo === "anexar" ? (identica?.id ?? null) : null,
  });

  if (resumo.entradasLidas === 0) {
    return resultadoComErro(
      "Nenhuma entrada válida foi encontrada. Envie o .bib ou o .csv exportado pela base.",
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
    conflito: null,
  };
}
