import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { campoExtracao, criterio, estudo, protocolo } from "@/db/schema";

/**
 * Toda entidade do sistema pende de um protocolo, e o protocolo pende de um
 * usuário. Confirmar as duas pontas na mesma consulta — que o item é daquele
 * protocolo e que o protocolo é de quem está pedindo — é o que impede alguém
 * de operar sobre a revisão de outra pessoa trocando um identificador na
 * requisição.
 *
 * Protocolo sem dono não é de ninguém: a comparação com um `usuarioId` real
 * dá falso, que é a resposta desejada.
 */
export async function protocoloEDoUsuario(
  protocoloId: string,
  usuarioId: string,
): Promise<boolean> {
  const [encontrado] = await db
    .select({ id: protocolo.id })
    .from(protocolo)
    .where(
      and(eq(protocolo.id, protocoloId), eq(protocolo.usuarioId, usuarioId)),
    );

  return encontrado !== undefined;
}

export async function estudoEDoProtocolo(
  protocoloId: string,
  usuarioId: string,
  estudoId: string,
): Promise<boolean> {
  const [encontrado] = await db
    .select({ id: estudo.id })
    .from(estudo)
    .innerJoin(protocolo, eq(protocolo.id, estudo.protocoloId))
    .where(
      and(
        eq(estudo.id, estudoId),
        eq(estudo.protocoloId, protocoloId),
        eq(protocolo.usuarioId, usuarioId),
      ),
    );

  return encontrado !== undefined;
}

export async function campoEDoProtocolo(
  protocoloId: string,
  usuarioId: string,
  campoId: string,
): Promise<boolean> {
  const [encontrado] = await db
    .select({ id: campoExtracao.id })
    .from(campoExtracao)
    .innerJoin(protocolo, eq(protocolo.id, campoExtracao.protocoloId))
    .where(
      and(
        eq(campoExtracao.id, campoId),
        eq(campoExtracao.protocoloId, protocoloId),
        eq(protocolo.usuarioId, usuarioId),
      ),
    );

  return encontrado !== undefined;
}

export async function criterioEDoProtocolo(
  protocoloId: string,
  usuarioId: string,
  criterioId: string,
): Promise<boolean> {
  const [encontrado] = await db
    .select({ id: criterio.id })
    .from(criterio)
    .innerJoin(protocolo, eq(protocolo.id, criterio.protocoloId))
    .where(
      and(
        eq(criterio.id, criterioId),
        eq(criterio.protocoloId, protocoloId),
        eq(protocolo.usuarioId, usuarioId),
      ),
    );

  return encontrado !== undefined;
}
