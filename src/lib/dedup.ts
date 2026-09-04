import type { EstudoImportado } from "@/lib/bibtex/paraEstudo";
import { similaridade } from "@/lib/normalizar";

export type MotivoDaFusao = "doi" | "titulo_exato" | "titulo_similar";

export interface GrupoDuplicatas<T> {
  principal: T;
  duplicatas: T[];
  motivo: MotivoDaFusao;
  confianca: number;
}

export interface ResultadoDedup<T> {
  unicos: T[];
  fundidos: GrupoDuplicatas<T>[];
  suspeitas: GrupoDuplicatas<T>[];
}

const SIMILARIDADE_MINIMA_PARA_SUSPEITA = 0.88;
const CONFIANCA_TOTAL = 1;
const DIFERENCA_DE_ANO_TOLERADA = 1;

const PESO_DO_DOI = 3;
const PESO_DO_RESUMO = 2;
const PESO_DOS_AUTORES = 2;
const PESO_DO_ANO = 1;
const PESO_DO_VEICULO = 1;
const PESO_DA_URL = 1;

function pontuarCompletude(estudo: EstudoImportado): number {
  return (
    (estudo.doiNorm ? PESO_DO_DOI : 0) +
    (estudo.resumo ? PESO_DO_RESUMO : 0) +
    (estudo.autores.length > 0 ? PESO_DOS_AUTORES : 0) +
    (estudo.ano ? PESO_DO_ANO : 0) +
    (estudo.veiculo ? PESO_DO_VEICULO : 0) +
    (estudo.url ? PESO_DA_URL : 0)
  );
}

function separarMaisCompletoDosDemais(grupo: EstudoImportado[]): {
  principal: EstudoImportado;
  duplicatas: EstudoImportado[];
} {
  const doMaisCompletoAoMenos = [...grupo].sort(
    (umEstudo, outroEstudo) =>
      pontuarCompletude(outroEstudo) - pontuarCompletude(umEstudo),
  );

  return {
    principal: doMaisCompletoAoMenos[0]!,
    duplicatas: doMaisCompletoAoMenos.slice(1),
  };
}

function anosSaoCompativeis(
  umAno: number | null,
  outroAno: number | null,
): boolean {
  if (umAno === null || outroAno === null) return true;
  return Math.abs(umAno - outroAno) <= DIFERENCA_DE_ANO_TOLERADA;
}

function saoOMesmoTrabalhoSemDuvida(
  umEstudo: EstudoImportado,
  outroEstudo: EstudoImportado,
): boolean {
  return umEstudo.tituloNorm === outroEstudo.tituloNorm;
}

function merecemConfirmacaoHumana(semelhanca: number): boolean {
  return semelhanca >= SIMILARIDADE_MINIMA_PARA_SUSPEITA;
}

function agruparPorDoi(estudos: EstudoImportado[]): {
  gruposComDoi: EstudoImportado[][];
  semDoi: EstudoImportado[];
} {
  const porDoi = new Map<string, EstudoImportado[]>();
  const semDoi: EstudoImportado[] = [];

  for (const estudo of estudos) {
    if (!estudo.doiNorm) {
      semDoi.push(estudo);
      continue;
    }

    const grupoExistente = porDoi.get(estudo.doiNorm);
    if (grupoExistente) grupoExistente.push(estudo);
    else porDoi.set(estudo.doiNorm, [estudo]);
  }

  return { gruposComDoi: [...porDoi.values()], semDoi };
}

interface ComparacaoComOsDemais {
  identicos: EstudoImportado[];
  apenasParecidos: EstudoImportado[];
  maiorSemelhanca: number;
}

function compararComOsDemais(
  base: EstudoImportado,
  candidatos: EstudoImportado[],
  aPartirDe: number,
  jaAgrupados: Set<number>,
): ComparacaoComOsDemais {
  const identicos: EstudoImportado[] = [];
  const apenasParecidos: EstudoImportado[] = [];
  let maiorSemelhanca = 0;

  for (let indice = aPartirDe; indice < candidatos.length; indice++) {
    if (jaAgrupados.has(indice)) continue;

    const candidato = candidatos[indice]!;
    if (!anosSaoCompativeis(base.ano, candidato.ano)) continue;

    if (saoOMesmoTrabalhoSemDuvida(base, candidato)) {
      identicos.push(candidato);
      jaAgrupados.add(indice);
      continue;
    }

    const semelhanca = similaridade(base.tituloNorm, candidato.tituloNorm);
    if (merecemConfirmacaoHumana(semelhanca)) {
      apenasParecidos.push(candidato);
      jaAgrupados.add(indice);
      maiorSemelhanca = Math.max(maiorSemelhanca, semelhanca);
    }
  }

  return { identicos, apenasParecidos, maiorSemelhanca };
}

export function deduplicar(
  estudos: EstudoImportado[],
): ResultadoDedup<EstudoImportado> {
  const unicos: EstudoImportado[] = [];
  const fundidos: GrupoDuplicatas<EstudoImportado>[] = [];
  const suspeitas: GrupoDuplicatas<EstudoImportado>[] = [];

  const { gruposComDoi, semDoi } = agruparPorDoi(estudos);

  for (const grupo of gruposComDoi) {
    const houveDuplicata = grupo.length > 1;
    if (!houveDuplicata) {
      unicos.push(grupo[0]!);
      continue;
    }

    const { principal, duplicatas } = separarMaisCompletoDosDemais(grupo);
    unicos.push(principal);
    fundidos.push({
      principal,
      duplicatas,
      motivo: "doi",
      confianca: CONFIANCA_TOTAL,
    });
  }

  const jaAgrupados = new Set<number>();

  for (let indice = 0; indice < semDoi.length; indice++) {
    if (jaAgrupados.has(indice)) continue;

    const base = semDoi[indice]!;
    const { identicos, apenasParecidos, maiorSemelhanca } = compararComOsDemais(
      base,
      semDoi,
      indice + 1,
      jaAgrupados,
    );

    if (identicos.length > 0) {
      const { principal, duplicatas } = separarMaisCompletoDosDemais([
        base,
        ...identicos,
      ]);
      unicos.push(principal);
      fundidos.push({
        principal,
        duplicatas,
        motivo: "titulo_exato",
        confianca: CONFIANCA_TOTAL,
      });
    } else {
      unicos.push(base);
    }

    if (apenasParecidos.length > 0) {
      unicos.push(...apenasParecidos);
      suspeitas.push({
        principal: base,
        duplicatas: apenasParecidos,
        motivo: "titulo_similar",
        confianca: maiorSemelhanca,
      });
    }
  }

  return { unicos, fundidos, suspeitas };
}
