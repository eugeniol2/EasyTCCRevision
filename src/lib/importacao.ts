import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { busca, estudo, estudoBusca } from "@/db/schema";
import { entradaParaEstudo, type EstudoImportado } from "@/lib/bibtex/paraEstudo";
import { parseBibtex } from "@/lib/bibtex/parser";
import { deduplicar } from "@/lib/dedup";

export interface DadosDaImportacao {
  protocoloId: string;
  base: string;
  stringBusca: string;
  executadaEmSegundos: number;
  conteudo: string;
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
  const arquivoLido = parseBibtex(dados.conteudo);

  if (arquivoLido.entradas.length === 0) {
    return {
      buscaId: null,
      entradasLidas: 0,
      importados: 0,
      duplicatasNoArquivo: 0,
      jaExistiamNoProtocolo: 0,
      suspeitas: [],
      linhasComErro: arquivoLido.erros.map(
        (erro) => `Linha ${erro.linha}: ${erro.mensagem}`,
      ),
    };
  }

  const { unicos, fundidos, suspeitas } = deduplicar(
    arquivoLido.entradas.map(entradaParaEstudo),
  );

  const jaSalvos = listarJaSalvos(dados.protocoloId);
  const buscaId = randomUUID();
  let importados = 0;
  let jaExistiamNoProtocolo = 0;

  db.transaction((transacao) => {
    transacao
      .insert(busca)
      .values({
        id: buscaId,
        protocoloId: dados.protocoloId,
        base: dados.base,
        stringBusca: dados.stringBusca,
        executadaEm: dados.executadaEmSegundos,
        totalResultados: arquivoLido.entradas.length,
      })
      .run();

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
  });

  return {
    buscaId,
    entradasLidas: arquivoLido.entradas.length,
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
    linhasComErro: arquivoLido.erros.map(
      (erro) => `Linha ${erro.linha}: ${erro.mensagem}`,
    ),
  };
}
