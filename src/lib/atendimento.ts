import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { atendimento, criterio, estudo } from "@/db/schema";

export async function marcarAtendimento(estudoId: string, criterioId: string): Promise<void> {
  await db.insert(atendimento)
    .values({ estudoId, criterioId })
    .onConflictDoNothing();
}

export async function desmarcarAtendimento(estudoId: string, criterioId: string): Promise<void> {
  await db.delete(atendimento)
    .where(
      and(
        eq(atendimento.estudoId, estudoId),
        eq(atendimento.criterioId, criterioId),
      ),
    );
}

export async function agruparAtendimentosPorEstudo(
  protocoloId: string,
): Promise<Map<string, string[]>> {
  const idsDoProtocolo = (await db
    .select({ id: estudo.id })
    .from(estudo)
    .where(eq(estudo.protocoloId, protocoloId)))
    .map((linha) => linha.id);

  if (idsDoProtocolo.length === 0) return new Map();

  const linhas = await db
    .select()
    .from(atendimento)
    .where(inArray(atendimento.estudoId, idsDoProtocolo));

  const porEstudo = new Map<string, string[]>();
  for (const linha of linhas) {
    const jaMarcados = porEstudo.get(linha.estudoId);
    if (jaMarcados) jaMarcados.push(linha.criterioId);
    else porEstudo.set(linha.estudoId, [linha.criterioId]);
  }

  return porEstudo;
}

export async function contarCriteriosDeInclusao(protocoloId: string): Promise<number> {
  const criteriosDeInclusao = await db
    .select({ id: criterio.id })
    .from(criterio)
    .where(
      and(eq(criterio.protocoloId, protocoloId), eq(criterio.tipo, "inclusao")),
    );

  return criteriosDeInclusao.length;
}
