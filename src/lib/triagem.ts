import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { estudo, triagem } from "@/db/schema";
import {
  LEITURA_COMPLETA,
  TRIAGEM_INICIAL,
  type Decisao,
  type EstagioDeTriagem,
} from "@/lib/consultas";

export interface DecisaoDeTriagem {
  estudoId: string;
  estagio: EstagioDeTriagem;
  decisao: Decisao;
  criterioId: string | null;
}

/**
 * A decisão de leitura só faz sentido enquanto o estudo está no funil.
 * Quando a fase 1 deixa de incluí-lo, a linha da fase 2 vira órfã: some da
 * contagem, mas reapareceria intacta se o estudo fosse reincluído depois.
 */
async function limparDecisaoDeLeitura(estudoId: string): Promise<void> {
  await db.delete(triagem)
    .where(
      and(
        eq(triagem.estudoId, estudoId),
        eq(triagem.estagio, LEITURA_COMPLETA),
      ),
    );
}

export async function salvarDecisao({
  estudoId,
  estagio,
  decisao,
  criterioId,
}: DecisaoDeTriagem): Promise<void> {
  const criterioAplicavel = decisao === "excluido" ? criterioId : null;

  await db.insert(triagem)
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
    });

  const saiuDoFunil = estagio === TRIAGEM_INICIAL && decisao !== "incluido";
  if (saiuDoFunil) await limparDecisaoDeLeitura(estudoId);
}

export async function removerDecisao(
  estudoId: string,
  estagio: EstagioDeTriagem,
): Promise<void> {
  await db.delete(triagem)
    .where(and(eq(triagem.estudoId, estudoId), eq(triagem.estagio, estagio)));

  if (estagio === TRIAGEM_INICIAL) await limparDecisaoDeLeitura(estudoId);
}

export async function removerTodasAsDecisoes(protocoloId: string): Promise<number> {
  const estudosDoProtocolo = (await db
    .select({ id: estudo.id })
    .from(estudo)
    .where(eq(estudo.protocoloId, protocoloId)))
    .map((linha) => linha.id);

  if (estudosDoProtocolo.length === 0) return 0;

  const removidas = await db
    .delete(triagem)
    .where(inArray(triagem.estudoId, estudosDoProtocolo))
    .returning();

  return removidas.length;
}
