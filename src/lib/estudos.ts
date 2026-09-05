import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { busca, estudo } from "@/db/schema";

export async function descartarEstudo(estudoId: string): Promise<number> {
  const removidos = await db.delete(estudo).where(eq(estudo.id, estudoId)).returning();
  return removidos.length;
}

export interface ResumoDoDescarte {
  estudosRemovidos: number;
  buscasRemovidas: number;
}

export async function descartarTudoDoProtocolo(protocoloId: string): Promise<ResumoDoDescarte> {
  return await db.transaction(async (transacao) => {
    const estudosRemovidos = await transacao
      .delete(estudo)
      .where(eq(estudo.protocoloId, protocoloId))
      .returning();

    const buscasRemovidas = await transacao
      .delete(busca)
      .where(eq(busca.protocoloId, protocoloId))
      .returning();

    return {
      estudosRemovidos: estudosRemovidos.length,
      buscasRemovidas: buscasRemovidas.length,
    };
  });
}
