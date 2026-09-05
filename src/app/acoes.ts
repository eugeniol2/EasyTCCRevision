"use server";

import { redirect } from "next/navigation";
import { usuarioAtual } from "@/lib/autorizacao";
import { criarProtocolo } from "@/lib/protocolo";

export interface ResultadoDaCriacao {
  estado: "inicial" | "erro";
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

export async function criarRevisao(
  _anterior: ResultadoDaCriacao,
  formData: FormData,
): Promise<ResultadoDaCriacao> {
  const titulo = textoDoCampo(formData, "titulo");
  if (titulo === "") {
    return { estado: "erro", mensagem: "Dê um título à revisão." };
  }

  const anoInicio = anoDoCampo(formData, "anoInicio");
  const anoFim = anoDoCampo(formData, "anoFim");

  if (anoInicio !== null && anoFim !== null && anoInicio > anoFim) {
    return { estado: "erro", mensagem: "O ano inicial não pode ser maior que o final." };
  }

  const id = await criarProtocolo(await usuarioAtual(), {
    titulo,
    questaoPesquisa: textoDoCampo(formData, "questaoPesquisa") || null,
    anoInicio,
    anoFim,
  });

  redirect(`/protocolos/${id}`);
}
