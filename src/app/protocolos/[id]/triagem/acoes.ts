"use server";

import { revalidatePath } from "next/cache";
import { descartarEstudo } from "@/lib/estudos";
import type { Decisao, EstagioDeTriagem } from "@/lib/consultas";
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
  salvarDecisao({ estudoId, estagio, decisao, criterioId });
  revalidarTriagem(protocoloId);
}

export async function desfazerDecisao(
  protocoloId: string,
  estudoId: string,
  estagio: EstagioDeTriagem,
): Promise<void> {
  removerDecisao(estudoId, estagio);
  revalidarTriagem(protocoloId);
}

export async function descartarArtigo(
  protocoloId: string,
  estudoId: string,
): Promise<void> {
  descartarEstudo(estudoId);
  revalidarTriagem(protocoloId);
}
