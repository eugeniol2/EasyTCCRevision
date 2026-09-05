import { randomUUID } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { criterio, protocolo, triagem } from "@/db/schema";

export type TipoDeCriterio = "inclusao" | "exclusao";

export interface CriterioEditavel {
  id: string | null;
  tipo: TipoDeCriterio;
  codigo: string;
  descricao: string;
  usadoEmExclusoes: number;
}

export interface DadosDoProtocolo {
  titulo: string;
  questaoPesquisa: string | null;
  anoInicio: number | null;
  anoFim: number | null;
}

const PREFIXO_POR_TIPO: Record<TipoDeCriterio, string> = {
  inclusao: "IC",
  exclusao: "EC",
};

const CRITERIOS_INICIAIS: Omit<CriterioEditavel, "id" | "usadoEmExclusoes">[] = [
  { tipo: "inclusao", codigo: "IC1", descricao: "Estudo primário sobre o tema da questão de pesquisa" },
  { tipo: "inclusao", codigo: "IC2", descricao: "Texto completo disponível" },
  { tipo: "exclusao", codigo: "EC1", descricao: "Não responde à questão de pesquisa" },
  { tipo: "exclusao", codigo: "EC2", descricao: "Fora do recorte temporal" },
  { tipo: "exclusao", codigo: "EC3", descricao: "Não é estudo primário (editorial, resumo, pôster)" },
  { tipo: "exclusao", codigo: "EC4", descricao: "Idioma fora do definido no protocolo" },
  { tipo: "exclusao", codigo: "EC5", descricao: "Duplicata de outro estudo já incluído" },
];

export async function criarProtocolo(
  usuarioId: string,
  dados: DadosDoProtocolo,
): Promise<string> {
  const id = randomUUID();

  await db.transaction(async (transacao) => {
    await transacao.insert(protocolo).values({ id, usuarioId, ...dados });
    await transacao.insert(criterio).values(
      CRITERIOS_INICIAIS.map((definicao, ordem) => ({
        id: randomUUID(),
        protocoloId: id,
        ordem,
        ...definicao,
      })),
    );
  });

  return id;
}

export async function atualizarProtocolo(
  protocoloId: string,
  dados: DadosDoProtocolo,
): Promise<void> {
  await db.update(protocolo).set(dados).where(eq(protocolo.id, protocoloId));
}

export async function listarCriteriosEditaveis(protocoloId: string): Promise<CriterioEditavel[]> {
  const usoPorCriterio = new Map(
    (await db
      .select({ criterioId: triagem.criterioId, quantidade: sql<number>`count(*)::int` })
      .from(triagem)
      .groupBy(triagem.criterioId))
      .filter((linha): linha is { criterioId: string; quantidade: number } =>
        linha.criterioId !== null,
      )
      .map((linha) => [linha.criterioId, linha.quantidade]),
  );

  return (await db
    .select()
    .from(criterio)
    .where(eq(criterio.protocoloId, protocoloId))
    .orderBy(criterio.ordem))
    .map((linha) => ({
      id: linha.id,
      tipo: linha.tipo,
      codigo: linha.codigo,
      descricao: linha.descricao,
      usadoEmExclusoes: usoPorCriterio.get(linha.id) ?? 0,
    }));
}

function proximoCodigoDisponivel(
  tipo: TipoDeCriterio,
  codigosEmUso: Set<string>,
): string {
  const prefixo = PREFIXO_POR_TIPO[tipo];
  let numero = 1;
  while (codigosEmUso.has(`${prefixo}${numero}`)) numero++;

  const codigo = `${prefixo}${numero}`;
  codigosEmUso.add(codigo);
  return codigo;
}

export interface CriterioRecebido {
  id: string | null;
  tipo: TipoDeCriterio;
  descricao: string;
}

export interface ResumoDaGravacao {
  criados: number;
  atualizados: number;
  removidos: number;
}

export async function salvarCriterios(
  protocoloId: string,
  recebidos: CriterioRecebido[],
): Promise<ResumoDaGravacao> {
  const existentes = await db
    .select()
    .from(criterio)
    .where(eq(criterio.protocoloId, protocoloId));

  const codigosEmUso = new Set(existentes.map((linha) => linha.codigo));
  const idsRecebidos = new Set(
    recebidos.map((item) => item.id).filter((id): id is string => id !== null),
  );
  const paraRemover = existentes
    .filter((linha) => !idsRecebidos.has(linha.id))
    .map((linha) => linha.id);

  const resumo: ResumoDaGravacao = { criados: 0, atualizados: 0, removidos: 0 };

  await db.transaction(async (transacao) => {
    if (paraRemover.length > 0) {
      await transacao
        .delete(criterio)
        .where(
          and(
            eq(criterio.protocoloId, protocoloId),
            inArray(criterio.id, paraRemover),
          ),
        );
      resumo.removidos = paraRemover.length;
    }

    for (const [ordem, item] of recebidos.entries()) {
      const descricao = item.descricao.trim();
      if (descricao === "") return;

      if (item.id === null) {
        await transacao
          .insert(criterio)
          .values({
            id: randomUUID(),
            protocoloId,
            tipo: item.tipo,
            codigo: proximoCodigoDisponivel(item.tipo, codigosEmUso),
            descricao,
            ordem,
          });
        resumo.criados++;
        continue;
      }

      await transacao
        .update(criterio)
        .set({ tipo: item.tipo, descricao, ordem })
        .where(
          and(
            eq(criterio.id, item.id),
            eq(criterio.protocoloId, protocoloId),
          ),
        );
      resumo.atualizados++;
    }
  });

  return resumo;
}
