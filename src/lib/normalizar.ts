const PRIMEIRO_DIACRITICO_COMBINANTE = 0x0300;
const ULTIMO_DIACRITICO_COMBINANTE = 0x036f;

const DIACRITICOS_COMBINANTES = new RegExp(
  `[${String.fromCharCode(PRIMEIRO_DIACRITICO_COMBINANTE)}-${String.fromCharCode(
    ULTIMO_DIACRITICO_COMBINANTE,
  )}]`,
  "g",
);

const PREFIXO_RESOLVEDOR_DOI = /^https?:\/\/(dx\.)?doi\.org\//i;
const PREFIXO_ESQUEMA_DOI = /^doi:\s*/i;
const PONTO_FINAL = /\.$/;
const DOI_CANONICO = /^10\.\d{4,9}\//;

const CARACTERES_NAO_ALFANUMERICOS = /[^a-z0-9\s]/g;
const ESPACOS_CONSECUTIVOS = /\s+/g;
const ANO_DE_QUATRO_DIGITOS = /(1[89]\d{2}|20\d{2}|21\d{2})/;
const URL_HTTP = /^https?:\/\//i;

const DIFERENCA_DE_TAMANHO_QUE_IMPEDE_SEMELHANCA = 0.25;

export function normalizarDoi(doi: string | null | undefined): string | null {
  if (!doi) return null;

  const semPrefixo = doi
    .trim()
    .replace(PREFIXO_RESOLVEDOR_DOI, "")
    .replace(PREFIXO_ESQUEMA_DOI, "")
    .replace(PONTO_FINAL, "")
    .trim()
    .toLowerCase();

  return DOI_CANONICO.test(semPrefixo) ? semPrefixo : null;
}

export function normalizarTitulo(titulo: string): string {
  return titulo
    .normalize("NFD")
    .replace(DIACRITICOS_COMBINANTES, "")
    .toLowerCase()
    .replace(CARACTERES_NAO_ALFANUMERICOS, " ")
    .replace(ESPACOS_CONSECUTIVOS, " ")
    .trim();
}

function distanciaDeEdicao(textoA: string, textoB: string): number {
  if (textoA === textoB) return 0;
  if (textoA.length === 0) return textoB.length;
  if (textoB.length === 0) return textoA.length;

  const [menor, maior] =
    textoA.length > textoB.length ? [textoB, textoA] : [textoA, textoB];

  let linhaAnterior = Array.from({ length: menor.length + 1 }, (_, i) => i);
  let linhaAtual = new Array<number>(menor.length + 1);

  for (let indiceMaior = 1; indiceMaior <= maior.length; indiceMaior++) {
    linhaAtual[0] = indiceMaior;

    for (let indiceMenor = 1; indiceMenor <= menor.length; indiceMenor++) {
      const custoDeSubstituicao =
        menor[indiceMenor - 1] === maior[indiceMaior - 1] ? 0 : 1;

      linhaAtual[indiceMenor] = Math.min(
        linhaAtual[indiceMenor - 1]! + 1,
        linhaAnterior[indiceMenor]! + 1,
        linhaAnterior[indiceMenor - 1]! + custoDeSubstituicao,
      );
    }

    [linhaAnterior, linhaAtual] = [linhaAtual, linhaAnterior];
  }

  return linhaAnterior[menor.length]!;
}

function tamanhosSaoComparaveis(textoA: string, textoB: string): boolean {
  const maiorTamanho = Math.max(textoA.length, textoB.length);
  const diferencaRelativa = Math.abs(textoA.length - textoB.length) / maiorTamanho;
  return diferencaRelativa <= DIFERENCA_DE_TAMANHO_QUE_IMPEDE_SEMELHANCA;
}

export function similaridade(textoA: string, textoB: string): number {
  if (textoA === textoB) return 1;
  if (textoA.length === 0 || textoB.length === 0) return 0;
  if (!tamanhosSaoComparaveis(textoA, textoB)) return 0;

  const maiorTamanho = Math.max(textoA.length, textoB.length);
  return 1 - distanciaDeEdicao(textoA, textoB) / maiorTamanho;
}

export function extrairAno(valor: string | undefined): number | null {
  if (!valor) return null;
  const anoEncontrado = valor.match(ANO_DE_QUATRO_DIGITOS);
  return anoEncontrado ? Number(anoEncontrado[1]) : null;
}

export function normalizarUrl(url: string | undefined): string | null {
  if (!url) return null;

  const semEspacos = url.trim();
  if (!URL_HTTP.test(semEspacos)) return null;

  try {
    return new URL(semEspacos).toString();
  } catch {
    return null;
  }
}
