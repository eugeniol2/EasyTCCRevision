import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { triagem } from "@/db/schema";
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
