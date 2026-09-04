import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { estudo, triagem } from "@/db/schema";
import { ESTAGIO_DE_TRIAGEM, type Decisao } from "@/lib/consultas";

export interface DecisaoDeTriagem {
  estudoId: string;
  decisao: Decisao;
  criterioId: string | null;
}

export function salvarDecisao({
  estudoId,
  decisao,
  criterioId,
}: DecisaoDeTriagem): void {
  const criterioAplicavel = decisao === "excluido" ? criterioId : null;

  db.insert(triagem)
    .values({
      id: randomUUID(),
      estudoId,
      estagio: ESTAGIO_DE_TRIAGEM,
      decisao,
      criterioId: criterioAplicavel,
    })
    .onConflictDoUpdate({
      target: [triagem.estudoId, triagem.estagio],
      set: {
        decisao,
        criterioId: criterioAplicavel,
        decididoEm: Math.floor(Date.now() / 1000),
      },
    })
    .run();
}

export function removerDecisao(estudoId: string): void {
  db.delete(triagem)
    .where(
      and(
        eq(triagem.estudoId, estudoId),
        eq(triagem.estagio, ESTAGIO_DE_TRIAGEM),
      ),
    )
    .run();
}

export function removerTodasAsDecisoes(protocoloId: string): number {
  const estudosDoProtocolo = db
    .select({ id: estudo.id })
    .from(estudo)
    .where(eq(estudo.protocoloId, protocoloId))
    .all()
    .map((linha) => linha.id);

  if (estudosDoProtocolo.length === 0) return 0;

  return db
    .delete(triagem)
    .where(inArray(triagem.estudoId, estudosDoProtocolo))
    .run().changes;
}
