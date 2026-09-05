import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { busca, estudo, estudoBusca } from "@/db/schema";
import type { EstudoImportado } from "@/lib/bibtex/paraEstudo";
import { deduplicar } from "@/lib/dedup";
import { lerArquivo } from "@/lib/leitura";

export interface DadosDaImportacao {
  protocoloId: string;
  base: string;
  stringBusca: string;
  executadaEmSegundos: number;
  conteudo: string;
  anexarABusca?: string | null;
}

export interface BuscaIdentica {
  id: string;
  base: string;
  executadaEm: number;
  registrosJaVinculados: number;
}

/**
 * O Google Scholar exporta uma citação por vez, então a mesma busca acaba
 * sendo importada em partes. Sem detectar isso, cada parte vira uma busca
 * nova e o "identificados" do PRISMA infla a cada importação.
 */
export function encontrarBuscaIdentica(
  protocoloId: string,
  base: string,
  stringBusca: string,
  executadaEmSegundos: number,
): BuscaIdentica | null {
  const encontrada = db
    .select()
    .from(busca)
    .where(
      and(
        eq(busca.protocoloId, protocoloId),
        eq(busca.base, base),
        eq(busca.stringBusca, stringBusca),
        eq(busca.executadaEm, executadaEmSegundos),
      ),
    )
    .get();

  if (!encontrada) return null;

  const vinculos = db
    .select({ quantidade: sql<number>`count(*)` })
    .from(estudoBusca)
    .where(eq(estudoBusca.buscaId, encontrada.id))
    .get();

  return {
    id: encontrada.id,
    base: encontrada.base,
    executadaEm: encontrada.executadaEm,
    registrosJaVinculados: vinculos?.quantidade ?? 0,
  };
}

export interface SuspeitaDeDuplicata {
  titulo: string;
  parecidoCom: string;
  confianca: number;
}

export interface ResumoDaImportacao {
  buscaId: string | null;
  entradasLidas: number;
  importados: number;
  duplicatasNoArquivo: number;
  jaExistiamNoProtocolo: number;
  suspeitas: SuspeitaDeDuplicata[];
  linhasComErro: string[];
}

interface EstudoJaSalvo {
  id: string;
  doiNorm: string | null;
  tituloNorm: string;
}

function encontrarEquivalenteSalvo(
  candidato: EstudoImportado,
  jaSalvos: EstudoJaSalvo[],
): EstudoJaSalvo | undefined {
  return jaSalvos.find(
    (salvo) =>
      (candidato.doiNorm !== null && salvo.doiNorm === candidato.doiNorm) ||
      salvo.tituloNorm === candidato.tituloNorm,
  );
}

function listarJaSalvos(protocoloId: string): EstudoJaSalvo[] {
  return db
    .select({
      id: estudo.id,
      doiNorm: estudo.doiNorm,
      tituloNorm: estudo.tituloNorm,
    })
    .from(estudo)
    .where(eq(estudo.protocoloId, protocoloId))
    .all();
}

export function importarParaOProtocolo(
  dados: DadosDaImportacao,
): ResumoDaImportacao {
  const arquivoLido = lerArquivo(dados.conteudo);

  if (arquivoLido.estudos.length === 0) {
    return {
      buscaId: null,
      entradasLidas: 0,
      importados: 0,
      duplicatasNoArquivo: 0,
      jaExistiamNoProtocolo: 0,
      suspeitas: [],
      linhasComErro: arquivoLido.erros,
    };
  }

  const { unicos, fundidos, suspeitas } = deduplicar(arquivoLido.estudos);

  const jaSalvos = listarJaSalvos(dados.protocoloId);
  const anexando = dados.anexarABusca ?? null;
  const buscaId = anexando ?? randomUUID();
  let importados = 0;
  let jaExistiamNoProtocolo = 0;

  db.transaction((transacao) => {
    if (!anexando) {
      transacao
        .insert(busca)
        .values({
          id: buscaId,
          protocoloId: dados.protocoloId,
          base: dados.base,
          stringBusca: dados.stringBusca,
          executadaEm: dados.executadaEmSegundos,
          totalResultados: arquivoLido.estudos.length,
        })
        .run();
    }

    for (const candidato of unicos) {
      const equivalente = encontrarEquivalenteSalvo(candidato, jaSalvos);

      if (equivalente) {
        jaExistiamNoProtocolo++;
        transacao
          .insert(estudoBusca)
          .values({ estudoId: equivalente.id, buscaId })
          .onConflictDoNothing()
          .run();
        continue;
      }

      const estudoId = randomUUID();
      transacao
        .insert(estudo)
        .values({ id: estudoId, protocoloId: dados.protocoloId, ...candidato })
        .run();
      transacao.insert(estudoBusca).values({ estudoId, buscaId }).run();

      jaSalvos.push({
        id: estudoId,
        doiNorm: candidato.doiNorm,
        tituloNorm: candidato.tituloNorm,
      });
      importados++;
    }

    if (anexando) {
      const vinculados = transacao
        .select({ quantidade: sql<number>`count(*)` })
        .from(estudoBusca)
        .where(eq(estudoBusca.buscaId, buscaId))
        .get();

      transacao
        .update(busca)
        .set({ totalResultados: vinculados?.quantidade ?? 0 })
        .where(eq(busca.id, buscaId))
        .run();
    }
  });

  return {
    buscaId,
    entradasLidas: arquivoLido.estudos.length,
    importados,
    duplicatasNoArquivo: fundidos.reduce(
      (total, grupo) => total + grupo.duplicatas.length,
      0,
    ),
    jaExistiamNoProtocolo,
    suspeitas: suspeitas.flatMap((grupo) =>
      grupo.duplicatas.map((duplicata) => ({
        titulo: duplicata.titulo,
        parecidoCom: grupo.principal.titulo,
        confianca: grupo.confianca,
      })),
    ),
    linhasComErro: arquivoLido.erros,
  };
}
