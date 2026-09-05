"use server";

import { revalidatePath } from "next/cache";
import { exigirProtocolo } from "@/lib/autorizacao";
import { descartarTudoDoProtocolo } from "@/lib/estudos";
import { removerTodasAsDecisoes } from "@/lib/triagem";

function revalidarProtocolo(protocoloId: string): void {
  revalidatePath(`/protocolos/${protocoloId}`);
  revalidatePath(`/protocolos/${protocoloId}/triagem`);
}

export async function zerarTriagem(protocoloId: string): Promise<void> {
  await exigirProtocolo(protocoloId);

  await removerTodasAsDecisoes(protocoloId);
  revalidarProtocolo(protocoloId);
}

export async function descartarTudo(protocoloId: string): Promise<void> {
  await exigirProtocolo(protocoloId);

  await descartarTudoDoProtocolo(protocoloId);
  revalidarProtocolo(protocoloId);
}
