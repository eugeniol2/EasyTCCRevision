import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { busca, estudo } from "@/db/schema";

export function descartarEstudo(estudoId: string): number {
  return db.delete(estudo).where(eq(estudo.id, estudoId)).run().changes;
}

export interface ResumoDoDescarte {
  estudosRemovidos: number;
  buscasRemovidas: number;
}

export function descartarTudoDoProtocolo(protocoloId: string): ResumoDoDescarte {
  return db.transaction((transacao) => {
    const estudosRemovidos = transacao
      .delete(estudo)
      .where(eq(estudo.protocoloId, protocoloId))
      .run().changes;

    const buscasRemovidas = transacao
      .delete(busca)
      .where(eq(busca.protocoloId, protocoloId))
      .run().changes;

    return { estudosRemovidos, buscasRemovidas };
  });
}
