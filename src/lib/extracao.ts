import { randomUUID } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { campoExtracao, estudo, extracao, triagem } from "@/db/schema";
import { alias } from "drizzle-orm/pg-core";
import { CAMPOS_PADRAO, type TipoDeCampo } from "@/lib/campos";
import {
  LEITURA_COMPLETA,
  TRIAGEM_INICIAL,
  type EstudoParaTriagem,
} from "@/lib/consultas";

export type { TipoDeCampo };
export { AVALIACAO_DE_QUALIDADE, CAMPOS_PADRAO, ehCampoObrigatorio } from "@/lib/campos";

export interface CampoDeExtracao {
  id: string;
  nome: string;
  tipo: TipoDeCampo;
  opcoes: string[] | null;
  ordem: number;
}

export async function listarCampos(protocoloId: string): Promise<CampoDeExtracao[]> {
  return (await db
    .select()
    .from(campoExtracao)
    .where(eq(campoExtracao.protocoloId, protocoloId))
    .orderBy(campoExtracao.ordem))
    .map((linha) => ({
      id: linha.id,
      nome: linha.nome,
      tipo: linha.tipo,
      opcoes: linha.opcoes,
      ordem: linha.ordem,
    }));
}

export async function criarCamposPadrao(protocoloId: string): Promise<number> {
  const jaExistem = await listarCampos(protocoloId);
  if (jaExistem.length > 0) return 0;

  await db.insert(campoExtracao)
    .values(
      CAMPOS_PADRAO.map((campo, ordem) => ({
        id: randomUUID(),
        protocoloId,
        nome: campo.nome,
        tipo: campo.tipo,
        opcoes: campo.opcoes ?? null,
        ordem,
      })),
    );

  return CAMPOS_PADRAO.length;
}

export async function adicionarCampo(
  protocoloId: string,
  nome: string,
  tipo: TipoDeCampo,
  opcoes: string[] | null,
): Promise<string> {
  const proximaOrdem = (await listarCampos(protocoloId)).length;
  const id = randomUUID();

  await db.insert(campoExtracao)
    .values({ id, protocoloId, nome, tipo, opcoes, ordem: proximaOrdem });

  return id;
}

export async function removerCampo(campoId: string): Promise<number> {
  const removidos = await db
    .delete(campoExtracao)
    .where(eq(campoExtracao.id, campoId))
    .returning();

  return removidos.length;
}

export interface EstudoParaExtracao {
  id: string;
  titulo: string;
  autores: EstudoParaTriagem["autores"];
  ano: number | null;
  veiculo: string | null;
  doi: string | null;
  url: string | null;
  valores: Record<string, string>;
  camposPreenchidos: number;
}

const decisaoDaFase1 = alias(triagem, "fase1");

/**
 * Só entram na extração os estudos incluídos nas duas fases. Exigir apenas
 * a fase 2 deixava passar registros órfãos: decisões de leitura tomadas
 * antes de a decisão da fase 1 ser revista para fora do funil.
 */
export async function listarEstudosParaExtracao(
  protocoloId: string,
): Promise<EstudoParaExtracao[]> {
  const incluidos = await db
    .select({
      id: estudo.id,
      titulo: estudo.titulo,
      autores: estudo.autores,
      ano: estudo.ano,
      veiculo: estudo.veiculo,
      doi: estudo.doi,
      url: estudo.url,
    })
    .from(estudo)
    .innerJoin(
      triagem,
      and(
        eq(triagem.estudoId, estudo.id),
        eq(triagem.estagio, LEITURA_COMPLETA),
        eq(triagem.decisao, "incluido"),
      ),
    )
    .innerJoin(
      decisaoDaFase1,
      and(
        eq(decisaoDaFase1.estudoId, estudo.id),
        eq(decisaoDaFase1.estagio, TRIAGEM_INICIAL),
        eq(decisaoDaFase1.decisao, "incluido"),
      ),
    )
    .where(eq(estudo.protocoloId, protocoloId))
    .orderBy(estudo.ano, estudo.criadoEm);

  if (incluidos.length === 0) return [];

  const valoresPorEstudo = new Map<string, Record<string, string>>();
  const linhas = await db
    .select()
    .from(extracao)
    .where(
      inArray(
        extracao.estudoId,
        incluidos.map((linha) => linha.id),
      ),
    );

  for (const linha of linhas) {
    const doEstudo = valoresPorEstudo.get(linha.estudoId) ?? {};
    if (linha.valor !== null && linha.valor.trim() !== "") {
      doEstudo[linha.campoId] = linha.valor;
    }
    valoresPorEstudo.set(linha.estudoId, doEstudo);
  }

  return incluidos.map((linha) => {
    const valores = valoresPorEstudo.get(linha.id) ?? {};
    return {
      ...linha,
      valores,
      camposPreenchidos: Object.keys(valores).length,
    };
  });
}

export async function salvarValorExtraido(
  estudoId: string,
  campoId: string,
  valor: string,
): Promise<void> {
  const semConteudo = valor.trim() === "";

  if (semConteudo) {
    await db.delete(extracao)
      .where(and(eq(extracao.estudoId, estudoId), eq(extracao.campoId, campoId)));
    return;
  }

  await db.insert(extracao)
    .values({ estudoId, campoId, valor })
    .onConflictDoUpdate({
      target: [extracao.estudoId, extracao.campoId],
      set: { valor },
    });
}

export interface ProgressoDaExtracao {
  estudos: number;
  completos: number;
  campos: number;
}

export async function medirProgresso(protocoloId: string): Promise<ProgressoDaExtracao> {
  const campos = (await listarCampos(protocoloId)).length;
  const estudos = await listarEstudosParaExtracao(protocoloId);

  return {
    estudos: estudos.length,
    campos,
    completos:
      campos === 0
        ? 0
        : estudos.filter((item) => item.camposPreenchidos >= campos).length,
  };
}

export async function contarValoresPreenchidos(protocoloId: string): Promise<number> {
  const idsDeCampos = (await listarCampos(protocoloId)).map((campo) => campo.id);
  if (idsDeCampos.length === 0) return 0;

  const [linha] = await db
    .select({ quantidade: sql<number>`count(*)::int` })
    .from(extracao)
    .where(inArray(extracao.campoId, idsDeCampos));

  return Number(linha?.quantidade ?? 0);
}
