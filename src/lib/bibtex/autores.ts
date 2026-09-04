import type { Autor } from "@/db/schema";
import { latexParaUnicode } from "./latex";

const CONECTIVO_ENTRE_AUTORES = "and";
const MARCADOR_DE_DEMAIS_AUTORES = "others";
const TEXTO_PARA_DEMAIS_AUTORES = "et al.";
const SEPARADOR_ENTRE_SOBRENOME_E_NOME = ",";
const BARRA_INVERTIDA = "\\";

const PARTICULAS_DE_SOBRENOME = new Set([
  "de", "da", "do", "das", "dos", "e",
  "van", "von", "der", "den", "del", "della", "di", "du", "la", "le", "el",
  "bin", "ibn", "al",
]);

const SO_INICIAIS = /^(?:[A-Z]\.?(?:\s+|$))+$/;
const ESPACO_EM_BRANCO = /^\s$/;
const ESPACOS_CONSECUTIVOS = /\s+/;
const MAXIMO_DE_AUTORES_NA_LISTAGEM = 3;

function ehEspacoEmBranco(caractere: string | undefined): boolean {
  return ESPACO_EM_BRANCO.test(caractere ?? "");
}

function comecaConectivoEm(campo: string, posicao: number): boolean {
  const trechoDoConectivo = campo.slice(posicao, posicao + CONECTIVO_ENTRE_AUTORES.length);
  return (
    trechoDoConectivo.toLowerCase() === CONECTIVO_ENTRE_AUTORES &&
    ehEspacoEmBranco(campo[posicao - 1]) &&
    ehEspacoEmBranco(campo[posicao + CONECTIVO_ENTRE_AUTORES.length])
  );
}

function separarPorConectivo(campo: string): string[] {
  const nomes: string[] = [];
  let nomeEmConstrucao = "";
  let chavesAbertas = 0;
  let posicao = 0;

  while (posicao < campo.length) {
    const caractere = campo[posicao]!;

    if (caractere === BARRA_INVERTIDA) {
      nomeEmConstrucao += campo.slice(posicao, posicao + 2);
      posicao += 2;
      continue;
    }

    if (caractere === "{") chavesAbertas++;
    if (caractere === "}") chavesAbertas--;

    const estaForaDeChaves = chavesAbertas === 0;
    if (estaForaDeChaves && comecaConectivoEm(campo, posicao)) {
      nomes.push(nomeEmConstrucao.trim());
      nomeEmConstrucao = "";
      posicao += CONECTIVO_ENTRE_AUTORES.length + 1;
      continue;
    }

    nomeEmConstrucao += caractere;
    posicao++;
  }

  if (nomeEmConstrucao.trim() !== "") nomes.push(nomeEmConstrucao.trim());
  return nomes;
}

function ehNomeInstitucional(nome: string): boolean {
  return nome.startsWith("{") && nome.endsWith("}");
}

function ehMarcadorDeDemaisAutores(nome: string): boolean {
  return nome.toLowerCase() === MARCADOR_DE_DEMAIS_AUTORES;
}

function pareceIniciais(texto: string): boolean {
  return texto.trim() !== "" && SO_INICIAIS.test(texto.trim());
}

/**
 * A convenção BibTeX é "Sobrenome, Nome", mas a exportação da IEEE inverte
 * para alguns autores — "A M M I P, Athapaththu" no mesmo registro em que
 * escreve "Yapa, Kanishka" corretamente. Um sobrenome composto apenas de
 * letras isoladas é sempre iniciais, então a troca é segura.
 */
function parseNomeComSobrenomeNaFrente(partes: string[]): Autor {
  const antesDaVirgula = latexParaUnicode(partes[0]!);
  const depoisDaVirgula = latexParaUnicode(partes[partes.length - 1]!);

  const estaInvertido =
    pareceIniciais(antesDaVirgula) && !pareceIniciais(depoisDaVirgula);

  return estaInvertido
    ? { family: depoisDaVirgula, given: antesDaVirgula }
    : { family: antesDaVirgula, given: depoisDaVirgula };
}

function indiceOndeComecaOSobrenome(palavras: string[]): number {
  const primeiraParticula = palavras.findIndex(
    (palavra, indice) =>
      indice < palavras.length - 1 &&
      PARTICULAS_DE_SOBRENOME.has(palavra.toLowerCase()),
  );

  return primeiraParticula === -1 ? palavras.length - 1 : primeiraParticula;
}

function parseNomeComSobrenomeAoFinal(nome: string): Autor {
  const palavras = nome.split(ESPACOS_CONSECUTIVOS).filter(Boolean);

  if (palavras.length === 1) {
    return { family: latexParaUnicode(palavras[0]!) };
  }

  const inicioDoSobrenome = indiceOndeComecaOSobrenome(palavras);

  return {
    given: latexParaUnicode(palavras.slice(0, inicioDoSobrenome).join(" ")),
    family: latexParaUnicode(palavras.slice(inicioDoSobrenome).join(" ")),
  };
}

export function parseNome(nome: string): Autor {
  const nomeLimpo = nome.trim();

  if (ehNomeInstitucional(nomeLimpo)) {
    return { literal: latexParaUnicode(nomeLimpo) };
  }
  if (ehMarcadorDeDemaisAutores(nomeLimpo)) {
    return { literal: TEXTO_PARA_DEMAIS_AUTORES };
  }

  const partes = nomeLimpo
    .split(SEPARADOR_ENTRE_SOBRENOME_E_NOME)
    .map((parte) => parte.trim());

  return partes.length > 1
    ? parseNomeComSobrenomeNaFrente(partes)
    : parseNomeComSobrenomeAoFinal(nomeLimpo);
}

function temAlgumNome(autor: Autor): boolean {
  return Boolean(autor.family || autor.given || autor.literal);
}

export function parseAutores(campo: string | undefined): Autor[] {
  if (!campo) return [];
  return separarPorConectivo(campo).map(parseNome).filter(temAlgumNome);
}

function abreviar(autor: Autor): string {
  if (autor.literal) return autor.literal;

  const inicialDoPrenome = autor.given ? ` ${autor.given.charAt(0)}.` : "";
  return `${autor.family ?? ""}${inicialDoPrenome}`.trim();
}

export function formatarAutores(
  autores: Autor[],
  maximoExibido = MAXIMO_DE_AUTORES_NA_LISTAGEM,
): string {
  if (autores.length === 0) return "—";

  const exibidos = autores.slice(0, maximoExibido).map(abreviar).join("; ");
  const haAutoresOcultos = autores.length > maximoExibido;

  return haAutoresOcultos ? `${exibidos} ${TEXTO_PARA_DEMAIS_AUTORES}` : exibidos;
}
