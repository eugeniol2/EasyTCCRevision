const MESES_POR_NOME: Record<string, number> = {
  jan: 1, janeiro: 1, january: 1,
  feb: 2, fev: 2, fevereiro: 2, february: 2,
  mar: 3, marco: 3, march: 3,
  apr: 4, abr: 4, abril: 4, april: 4,
  may: 5, mai: 5, maio: 5,
  jun: 6, junho: 6, june: 6,
  jul: 7, julho: 7, july: 7,
  aug: 8, ago: 8, agosto: 8, august: 8,
  sep: 9, sept: 9, set: 9, setembro: 9, september: 9,
  oct: 10, out: 10, outubro: 10, october: 10,
  nov: 11, novembro: 11, november: 11,
  dec: 12, dez: 12, dezembro: 12, december: 12,
};

export const NOME_DO_MES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

export function extrairMes(valor: string | undefined): number | null {
  if (!valor) return null;

  const limpo = valor
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const somenteNumero = limpo.match(/^(\d{1,2})$/);
  if (somenteNumero) {
    const numero = Number(somenteNumero[1]);
    return numero >= 1 && numero <= 12 ? numero : null;
  }

  const dataCompleta = limpo.match(/^\d{4}-(\d{2})/);
  if (dataCompleta) {
    const numero = Number(dataCompleta[1]);
    return numero >= 1 && numero <= 12 ? numero : null;
  }

  const primeiraPalavra = limpo.match(/[a-z]+/)?.[0];
  return primeiraPalavra ? (MESES_POR_NOME[primeiraPalavra] ?? null) : null;
}

export function formatarMes(mes: number | null): string | null {
  if (mes === null || mes < 1 || mes > 12) return null;
  const nome = NOME_DO_MES[mes - 1]!;
  return nome.charAt(0).toUpperCase() + nome.slice(1);
}

const SEPARADOR_DE_PALAVRAS = /\s*[;|]\s*/;
const MAXIMO_DE_PALAVRAS = 12;

export function extrairPalavrasChave(valor: string | undefined): string[] {
  if (!valor || valor.trim() === "") return [];

  const porPontoEVirgula = valor.split(SEPARADOR_DE_PALAVRAS).filter(Boolean);
  const partes =
    porPontoEVirgula.length > 1 ? porPontoEVirgula : valor.split(/\s*,\s*/);

  const unicas: string[] = [];
  for (const parte of partes) {
    const limpa = parte.trim();
    const jaTem = unicas.some(
      (existente) => existente.toLowerCase() === limpa.toLowerCase(),
    );
    if (limpa !== "" && !jaTem) unicas.push(limpa);
  }

  return unicas.slice(0, MAXIMO_DE_PALAVRAS);
}
