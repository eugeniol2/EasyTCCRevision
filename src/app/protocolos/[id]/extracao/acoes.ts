"use server";

import { revalidatePath } from "next/cache";
import {
  adicionarCampo,
  AVALIACAO_DE_QUALIDADE,
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
  criarCamposPadrao(protocoloId);
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

  adicionarCampo(protocoloId, nomeLimpo, tipo, opcoes);
  revalidarExtracao(protocoloId);
}

export async function criarAvaliacaoDeQualidade(
  protocoloId: string,
): Promise<void> {
  adicionarCampo(
    protocoloId,
    AVALIACAO_DE_QUALIDADE.nome,
    AVALIACAO_DE_QUALIDADE.tipo,
    AVALIACAO_DE_QUALIDADE.opcoes,
  );
  revalidarExtracao(protocoloId);
}

export async function excluirCampo(
  protocoloId: string,
  campoId: string,
): Promise<void> {
  removerCampo(campoId);
  revalidarExtracao(protocoloId);
}

export async function salvarValor(
  protocoloId: string,
  estudoId: string,
  campoId: string,
  valor: string,
): Promise<void> {
  salvarValorExtraido(estudoId, campoId, valor);
  revalidatePath(`/protocolos/${protocoloId}`);
}
