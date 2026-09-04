import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { estudo, triagem } from "@/db/schema";
import { TRIAGEM_INICIAL, type Decisao, type EstagioDeTriagem } from "@/lib/consultas";

export interface DecisaoDeTriagem {
  estudoId: string;
  estagio: EstagioDeTriagem;
  decisao: Decisao;
  criterioId: string | null;
}

export function salvarDecisao({
  estudoId,
  estagio,
  decisao,
  criterioId,
}: DecisaoDeTriagem): void {
  const criterioAplicavel = decisao === "excluido" ? criterioId : null;

  db.insert(triagem)
    .values({
      id: randomUUID(),
      estudoId,
      estagio,
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

export function removerDecisao(
  estudoId: string,
  estagio: EstagioDeTriagem,
): void {
  db.delete(triagem)
    .where(and(eq(triagem.estudoId, estudoId), eq(triagem.estagio, estagio)))
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
