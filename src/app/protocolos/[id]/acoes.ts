"use server";

import { revalidatePath } from "next/cache";
import { removerTodasAsDecisoes } from "@/lib/triagem";

export async function zerarTriagem(protocoloId: string): Promise<void> {
  removerTodasAsDecisoes(protocoloId);
  revalidatePath(`/protocolos/${protocoloId}`);
  revalidatePath(`/protocolos/${protocoloId}/triagem`);
}
