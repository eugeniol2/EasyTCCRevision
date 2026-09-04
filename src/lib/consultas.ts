import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { busca, criterio, estudo, estudoBusca, protocolo, triagem } from "@/db/schema";

export const ESTAGIO_DE_TRIAGEM = "titulo_resumo" as const;

export type Decisao = "incluido" | "excluido" | "pendente" | "duvida";

export interface EstudoParaTriagem {
  id: string;
  titulo: string;
  autores: { given?: string; family?: string; literal?: string }[];
  ano: number | null;
  veiculo: string | null;
  url: string | null;
  doi: string | null;
  resumo: string | null;
  decisao: Decisao | null;
  criterioId: string | null;
  bases: string[];
}

export interface CriterioDeExclusao {
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

export function listarCriteriosDeExclusao(protocoloId: string): CriterioDeExclusao[] {
  return db
    .select({
      id: criterio.id,
      codigo: criterio.codigo,
      descricao: criterio.descricao,
    })
    .from(criterio)
    .where(and(eq(criterio.protocoloId, protocoloId), eq(criterio.tipo, "exclusao")))
    .orderBy(criterio.ordem)
    .all();
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

export function listarEstudosParaTriagem(protocoloId: string): EstudoParaTriagem[] {
  const basesPorEstudo = agruparBasesPorEstudo(protocoloId);

  const linhas = db
    .select({
      id: estudo.id,
      titulo: estudo.titulo,
      autores: estudo.autores,
      ano: estudo.ano,
      veiculo: estudo.veiculo,
      url: estudo.url,
      doi: estudo.doi,
      resumo: estudo.resumo,
      decisao: triagem.decisao,
      criterioId: triagem.criterioId,
    })
    .from(estudo)
    .leftJoin(
      triagem,
      and(
        eq(triagem.estudoId, estudo.id),
        eq(triagem.estagio, ESTAGIO_DE_TRIAGEM),
      ),
    )
    .where(eq(estudo.protocoloId, protocoloId))
    .orderBy(estudo.criadoEm)
    .all();

  return linhas.map((linha) => ({
    ...linha,
    bases: basesPorEstudo.get(linha.id) ?? [],
  }));
}

export interface ContagemPorDecisao {
  incluido: number;
  excluido: number;
  duvida: number;
  pendente: number;
  total: number;
}

export function contarPorDecisao(protocoloId: string): ContagemPorDecisao {
  const linhas = db
    .select({
      decisao: triagem.decisao,
      quantidade: sql<number>`count(*)`,
    })
    .from(estudo)
    .leftJoin(
      triagem,
      and(
        eq(triagem.estudoId, estudo.id),
        eq(triagem.estagio, ESTAGIO_DE_TRIAGEM),
      ),
    )
    .where(eq(estudo.protocoloId, protocoloId))
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
