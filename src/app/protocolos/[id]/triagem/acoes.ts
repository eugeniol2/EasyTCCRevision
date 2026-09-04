"use server";

import { revalidatePath } from "next/cache";
import { descartarEstudo } from "@/lib/estudos";
import type { Decisao } from "@/lib/consultas";
import { removerDecisao, salvarDecisao } from "@/lib/triagem";

interface DecisaoRecebida {
  protocoloId: string;
  estudoId: string;
  decisao: Decisao;
  criterioId: string | null;
}

function revalidarTriagem(protocoloId: string): void {
  revalidatePath(`/protocolos/${protocoloId}`);
  revalidatePath(`/protocolos/${protocoloId}/triagem`);
}

export async function registrarDecisao({
  protocoloId,
  estudoId,
  decisao,
  criterioId,
}: DecisaoRecebida): Promise<void> {
  salvarDecisao({ estudoId, decisao, criterioId });
  revalidarTriagem(protocoloId);
}

export async function desfazerDecisao(
  protocoloId: string,
  estudoId: string,
): Promise<void> {
  removerDecisao(estudoId);
  revalidarTriagem(protocoloId);
}

export async function descartarArtigo(
  protocoloId: string,
  estudoId: string,
): Promise<void> {
  descartarEstudo(estudoId);
  revalidarTriagem(protocoloId);
}
