"use server";

import { revalidatePath } from "next/cache";
import {
  adicionarCampo,
  criarCamposPadrao,
  removerCampo,
  salvarValorExtraido,
  type TipoDeCampo,
} from "@/lib/extracao";

function revalidarExtracao(protocoloId: string): void {
  revalidatePath(`/protocolos/${protocoloId}`);
  revalidatePath(`/protocolos/${protocoloId}/extracao`);
}

export async function usarCamposPadrao(protocoloId: string): Promise<void> {
  await criarCamposPadrao(protocoloId);
  revalidarExtracao(protocoloId);
}

export async function criarCampo(
  protocoloId: string,
  nome: string,
  tipo: TipoDeCampo,
  opcoes: string[] | null,
): Promise<void> {
  const nomeLimpo = nome.trim();
  if (nomeLimpo === "") return;

  await adicionarCampo(protocoloId, nomeLimpo, tipo, opcoes);
  revalidarExtracao(protocoloId);
}

export async function excluirCampo(
  protocoloId: string,
  campoId: string,
): Promise<void> {
  await removerCampo(campoId);
  revalidarExtracao(protocoloId);
}

export async function salvarValor(
  protocoloId: string,
  estudoId: string,
  campoId: string,
  valor: string,
): Promise<void> {
  await salvarValorExtraido(estudoId, campoId, valor);
  revalidatePath(`/protocolos/${protocoloId}`);
}
