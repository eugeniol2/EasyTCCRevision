"use server";

import { revalidatePath } from "next/cache";
import { exigirCampo, exigirEstudo, exigirProtocolo } from "@/lib/autorizacao";
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
  await exigirProtocolo(protocoloId);

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

  await exigirProtocolo(protocoloId);

  await adicionarCampo(protocoloId, nomeLimpo, tipo, opcoes);
  revalidarExtracao(protocoloId);
}

export async function excluirCampo(
  protocoloId: string,
  campoId: string,
): Promise<void> {
  await exigirCampo(protocoloId, campoId);

  await removerCampo(campoId);
  revalidarExtracao(protocoloId);
}

export async function salvarValor(
  protocoloId: string,
  estudoId: string,
  campoId: string,
  valor: string,
): Promise<void> {
  await Promise.all([
    exigirEstudo(protocoloId, estudoId),
    exigirCampo(protocoloId, campoId),
  ]);

  await salvarValorExtraido(estudoId, campoId, valor);
  revalidatePath(`/protocolos/${protocoloId}`);
}
