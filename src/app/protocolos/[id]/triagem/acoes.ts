"use server";

import { revalidatePath } from "next/cache";
import { exigirCriterio, exigirEstudo } from "@/lib/autorizacao";
import { descartarEstudo } from "@/lib/estudos";
import type { Decisao, EstagioDeTriagem } from "@/lib/consultas";
import { desmarcarAtendimento, marcarAtendimento } from "@/lib/atendimento";
import { removerDecisao, salvarDecisao } from "@/lib/triagem";

interface DecisaoRecebida {
  protocoloId: string;
  estudoId: string;
  estagio: EstagioDeTriagem;
  decisao: Decisao;
  criterioId: string | null;
}

function revalidarTriagem(protocoloId: string): void {
  revalidatePath(`/protocolos/${protocoloId}`);
  revalidatePath(`/protocolos/${protocoloId}/triagem`);
  revalidatePath(`/protocolos/${protocoloId}/leitura`);
}

export async function registrarDecisao({
  protocoloId,
  estudoId,
  estagio,
  decisao,
  criterioId,
}: DecisaoRecebida): Promise<void> {
  await Promise.all([
    exigirEstudo(protocoloId, estudoId),
    exigirCriterio(protocoloId, criterioId),
  ]);

  await salvarDecisao({ estudoId, estagio, decisao, criterioId });
  revalidarTriagem(protocoloId);
}

export async function desfazerDecisao(
  protocoloId: string,
  estudoId: string,
  estagio: EstagioDeTriagem,
): Promise<void> {
  await exigirEstudo(protocoloId, estudoId);

  await removerDecisao(estudoId, estagio);
  revalidarTriagem(protocoloId);
}

export async function descartarArtigo(
  protocoloId: string,
  estudoId: string,
): Promise<void> {
  await exigirEstudo(protocoloId, estudoId);

  await descartarEstudo(estudoId);
  revalidarTriagem(protocoloId);
}

export async function alternarAtendimento(
  protocoloId: string,
  estudoId: string,
  criterioId: string,
  atendido: boolean,
): Promise<void> {
  await Promise.all([
    exigirEstudo(protocoloId, estudoId),
    exigirCriterio(protocoloId, criterioId),
  ]);

  if (atendido) await marcarAtendimento(estudoId, criterioId);
  else await desmarcarAtendimento(estudoId, criterioId);

  revalidarTriagem(protocoloId);
}
