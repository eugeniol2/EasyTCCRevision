import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { atendimento, criterio, estudo } from "@/db/schema";

export function marcarAtendimento(estudoId: string, criterioId: string): void {
  db.insert(atendimento)
    .values({ estudoId, criterioId })
    .onConflictDoNothing()
    .run();
}

export function desmarcarAtendimento(estudoId: string, criterioId: string): void {
  db.delete(atendimento)
    .where(
      and(
        eq(atendimento.estudoId, estudoId),
        eq(atendimento.criterioId, criterioId),
      ),
    )
    .run();
}

export function agruparAtendimentosPorEstudo(
  protocoloId: string,
): Map<string, string[]> {
  const idsDoProtocolo = db
    .select({ id: estudo.id })
    .from(estudo)
    .where(eq(estudo.protocoloId, protocoloId))
    .all()
    .map((linha) => linha.id);

  if (idsDoProtocolo.length === 0) return new Map();

  const linhas = db
    .select()
    .from(atendimento)
    .where(inArray(atendimento.estudoId, idsDoProtocolo))
    .all();

  const porEstudo = new Map<string, string[]>();
  for (const linha of linhas) {
    const jaMarcados = porEstudo.get(linha.estudoId);
    if (jaMarcados) jaMarcados.push(linha.criterioId);
    else porEstudo.set(linha.estudoId, [linha.criterioId]);
  }

  return porEstudo;
}

export function contarCriteriosDeInclusao(protocoloId: string): number {
  return db
    .select({ id: criterio.id })
    .from(criterio)
    .where(
      and(eq(criterio.protocoloId, protocoloId), eq(criterio.tipo, "inclusao")),
    )
    .all().length;
}
