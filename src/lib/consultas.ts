import { and, eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { db } from "@/db/client";
import { busca, criterio, estudo, estudoBusca, protocolo, triagem } from "@/db/schema";
import { agruparAtendimentosPorEstudo } from "@/lib/atendimento";

export type EstagioDeTriagem = "titulo_resumo" | "texto_completo";

export const TRIAGEM_INICIAL: EstagioDeTriagem = "titulo_resumo";
export const LEITURA_COMPLETA: EstagioDeTriagem = "texto_completo";

export const ROTULO_DO_ESTAGIO: Record<EstagioDeTriagem, string> = {
  titulo_resumo: "Triagem por título e resumo",
  texto_completo: "Leitura do texto completo",
};

export type Decisao = "incluido" | "excluido" | "pendente" | "duvida";

export interface EstudoParaTriagem {
  id: string;
  titulo: string;
  autores: { given?: string; family?: string; literal?: string }[];
  ano: number | null;
  mes: number | null;
  veiculo: string | null;
  palavrasChave: string[];
  tipo: string | null;
  url: string | null;
  doi: string | null;
  resumo: string | null;
  decisao: Decisao | null;
  criterioId: string | null;
  bases: string[];
  criteriosAtendidos: string[];
}

export interface CriterioDoProtocolo {
  id: string;
  codigo: string;
  descricao: string;
}

export function buscarProtocolo(protocoloId: string) {
  return db.select().from(protocolo).where(eq(protocolo.id, protocoloId)).get();
}

export function listarProtocolos() {
  return db.select().from(protocolo).orderBy(protocolo.criadoEm).all();
}

function listarCriteriosDoTipo(
  protocoloId: string,
  tipo: "inclusao" | "exclusao",
): CriterioDoProtocolo[] {
  return db
    .select({
      id: criterio.id,
      codigo: criterio.codigo,
      descricao: criterio.descricao,
    })
    .from(criterio)
    .where(and(eq(criterio.protocoloId, protocoloId), eq(criterio.tipo, tipo)))
    .orderBy(criterio.ordem)
    .all();
}

export function listarCriteriosDeExclusao(protocoloId: string): CriterioDoProtocolo[] {
  return listarCriteriosDoTipo(protocoloId, "exclusao");
}

export function listarCriteriosDeInclusao(protocoloId: string): CriterioDoProtocolo[] {
  return listarCriteriosDoTipo(protocoloId, "inclusao");
}

function agruparBasesPorEstudo(protocoloId: string): Map<string, string[]> {
  const origens = db
    .select({ estudoId: estudoBusca.estudoId, base: busca.base })
    .from(estudoBusca)
    .innerJoin(busca, eq(busca.id, estudoBusca.buscaId))
    .where(eq(busca.protocoloId, protocoloId))
    .orderBy(busca.executadaEm)
    .all();

  const porEstudo = new Map<string, string[]>();

  for (const { estudoId, base } of origens) {
    const jaListadas = porEstudo.get(estudoId);
    if (!jaListadas) porEstudo.set(estudoId, [base]);
    else if (!jaListadas.includes(base)) jaListadas.push(base);
  }

  return porEstudo;
}

const decisaoDaEtapaAnterior = alias(triagem, "etapa_anterior");

/**
 * A leitura de texto completo enxerga apenas o que foi incluído na triagem
 * inicial. Sem esse filtro, o segundo estágio reapresentaria os estudos já
 * descartados e o denominador do PRISMA sairia inflado.
 */
function somenteDoEstagio(protocoloId: string, estagio: EstagioDeTriagem) {
  const doProtocolo = eq(estudo.protocoloId, protocoloId);

  return estagio === TRIAGEM_INICIAL
    ? doProtocolo
    : and(doProtocolo, eq(decisaoDaEtapaAnterior.decisao, "incluido"));
}

const juncaoComEtapaAnterior = and(
  eq(decisaoDaEtapaAnterior.estudoId, estudo.id),
  eq(decisaoDaEtapaAnterior.estagio, TRIAGEM_INICIAL),
);

export function listarEstudosParaEstagio(
  protocoloId: string,
  estagio: EstagioDeTriagem,
): EstudoParaTriagem[] {
  const basesPorEstudo = agruparBasesPorEstudo(protocoloId);
  const atendidosPorEstudo = agruparAtendimentosPorEstudo(protocoloId);

  const linhas = db
    .select({
      id: estudo.id,
      titulo: estudo.titulo,
      autores: estudo.autores,
      ano: estudo.ano,
      mes: estudo.mes,
      veiculo: estudo.veiculo,
      palavrasChave: estudo.palavrasChave,
      tipo: estudo.tipo,
      url: estudo.url,
      doi: estudo.doi,
      resumo: estudo.resumo,
      decisao: triagem.decisao,
      criterioId: triagem.criterioId,
    })
    .from(estudo)
    .leftJoin(
      triagem,
      and(eq(triagem.estudoId, estudo.id), eq(triagem.estagio, estagio)),
    )
    .leftJoin(decisaoDaEtapaAnterior, juncaoComEtapaAnterior)
    .where(somenteDoEstagio(protocoloId, estagio))
    .orderBy(estudo.criadoEm)
    .all();

  return linhas.map((linha) => ({
    ...linha,
    bases: basesPorEstudo.get(linha.id) ?? [],
    criteriosAtendidos: atendidosPorEstudo.get(linha.id) ?? [],
  }));
}

export interface ContagemPorDecisao {
  incluido: number;
  excluido: number;
  duvida: number;
  pendente: number;
  total: number;
}

export function contarPorDecisao(
  protocoloId: string,
  estagio: EstagioDeTriagem,
): ContagemPorDecisao {
  const linhas = db
    .select({
      decisao: triagem.decisao,
      quantidade: sql<number>`count(distinct ${estudo.id})`,
    })
    .from(estudo)
    .leftJoin(
      triagem,
      and(eq(triagem.estudoId, estudo.id), eq(triagem.estagio, estagio)),
    )
    .leftJoin(decisaoDaEtapaAnterior, juncaoComEtapaAnterior)
    .where(somenteDoEstagio(protocoloId, estagio))
    .groupBy(triagem.decisao)
    .all();

  const contagem: ContagemPorDecisao = {
    incluido: 0,
    excluido: 0,
    duvida: 0,
    pendente: 0,
    total: 0,
  };

  for (const linha of linhas) {
    const chave = linha.decisao ?? "pendente";
    if (chave in contagem) contagem[chave as keyof ContagemPorDecisao] += linha.quantidade;
    contagem.total += linha.quantidade;
  }

  return contagem;
}

export function contarEstudos(protocoloId: string): number {
  const linha = db
    .select({ quantidade: sql<number>`count(*)` })
    .from(estudo)
    .where(eq(estudo.protocoloId, protocoloId))
    .get();

  return linha?.quantidade ?? 0;
}
