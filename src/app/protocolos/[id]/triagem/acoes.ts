"use server";

import { revalidatePath } from "next/cache";
import type { Decisao } from "@/lib/consultas";
import { removerDecisao, salvarDecisao } from "@/lib/triagem";

interface DecisaoRecebida {
  protocoloId: string;
  estudoId: string;
  decisao: Decisao;
  criterioId: string | null;
}

export async function registrarDecisao({
  protocoloId,
  estudoId,
  decisao,
  criterioId,
}: DecisaoRecebida): Promise<void> {
  salvarDecisao({ estudoId, decisao, criterioId });
  revalidatePath(`/protocolos/${protocoloId}/triagem`);
}

export async function desfazerDecisao(
  protocoloId: string,
  estudoId: string,
): Promise<void> {
  removerDecisao(estudoId);
  revalidatePath(`/protocolos/${protocoloId}/triagem`);
}
