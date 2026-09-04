"use server";

import { revalidatePath } from "next/cache";
import type { Decisao, EstagioDeTriagem } from "@/lib/consultas";
import { removerDecisao, salvarDecisao } from "@/lib/triagem";

interface DecisaoRecebida {
  protocoloId: string;
  estudoId: string;
  estagio: EstagioDeTriagem;
  decisao: Decisao;
  criterioId: string | null;
}

export async function registrarDecisao({
  protocoloId,
  estudoId,
  estagio,
  decisao,
  criterioId,
}: DecisaoRecebida): Promise<void> {
  salvarDecisao({ estudoId, estagio, decisao, criterioId });
  revalidatePath(`/protocolos/${protocoloId}/triagem`);
}

export async function desfazerDecisao(
  protocoloId: string,
  estudoId: string,
  estagio: EstagioDeTriagem,
): Promise<void> {
  removerDecisao(estudoId, estagio);
  revalidatePath(`/protocolos/${protocoloId}/triagem`);
}
