"use server";

import { revalidatePath } from "next/cache";
import { exigirProtocolo } from "@/lib/autorizacao";
import {
  atualizarProtocolo,
  salvarCriterios,
  type CriterioRecebido,
} from "@/lib/protocolo";

export interface ResultadoDaEdicao {
  estado: "inicial" | "sucesso" | "erro";
  mensagem: string;
}

function textoDoCampo(formData: FormData, nome: string): string {
  const valor = formData.get(nome);
  return typeof valor === "string" ? valor.trim() : "";
}

function anoDoCampo(formData: FormData, nome: string): number | null {
  const valor = textoDoCampo(formData, nome);
  const numero = Number(valor);
  return valor !== "" && Number.isInteger(numero) ? numero : null;
}

export async function salvarProtocolo(
  _anterior: ResultadoDaEdicao,
  formData: FormData,
): Promise<ResultadoDaEdicao> {
  const protocoloId = textoDoCampo(formData, "protocoloId");
  const titulo = textoDoCampo(formData, "titulo");

  if (titulo === "") {
    return { estado: "erro", mensagem: "O título da revisão não pode ficar vazio." };
  }

  const anoInicio = anoDoCampo(formData, "anoInicio");
  const anoFim = anoDoCampo(formData, "anoFim");

  if (anoInicio !== null && anoFim !== null && anoInicio > anoFim) {
    return { estado: "erro", mensagem: "O ano inicial não pode ser maior que o final." };
  }

  await exigirProtocolo(protocoloId);

  await atualizarProtocolo(protocoloId, {
    titulo,
    questaoPesquisa: textoDoCampo(formData, "questaoPesquisa") || null,
    anoInicio,
    anoFim,
  });

  const criteriosCrus = formData.get("criterios");
  if (typeof criteriosCrus === "string" && criteriosCrus !== "") {
    const recebidos = JSON.parse(criteriosCrus) as CriterioRecebido[];
    const semExclusao = !recebidos.some(
      (item) => item.tipo === "exclusao" && item.descricao.trim() !== "",
    );

    if (semExclusao) {
      return {
        estado: "erro",
        mensagem:
          "Mantenha ao menos um critério de exclusão — sem ele não é possível registrar o motivo de uma exclusão na triagem.",
      };
    }

    await salvarCriterios(protocoloId, recebidos);
  }

  revalidatePath(`/protocolos/${protocoloId}`);
  revalidatePath(`/protocolos/${protocoloId}/protocolo`);
  revalidatePath(`/protocolos/${protocoloId}/triagem`);

  return { estado: "sucesso", mensagem: "Protocolo salvo." };
}
