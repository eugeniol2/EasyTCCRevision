const ACENTO_AGUDO = String.fromCharCode(0x0301);
const ACENTO_GRAVE = String.fromCharCode(0x0300);
const ACENTO_CIRCUNFLEXO = String.fromCharCode(0x0302);
const TIL = String.fromCharCode(0x0303);
const TREMA = String.fromCharCode(0x0308);
const MACRON = String.fromCharCode(0x0304);
const PONTO_ACIMA = String.fromCharCode(0x0307);
const BREVE = String.fromCharCode(0x0306);
const CARON = String.fromCharCode(0x030c);
const ACENTO_AGUDO_DUPLO = String.fromCharCode(0x030b);
const CEDILHA = String.fromCharCode(0x0327);
const OGONEK = String.fromCharCode(0x0328);
const ANEL_ACIMA = String.fromCharCode(0x030a);
const PONTO_ABAIXO = String.fromCharCode(0x0323);
const LINHA_ABAIXO = String.fromCharCode(0x0331);

const MARCA_COMBINANTE_POR_COMANDO: Record<string, string> = {
  "'": ACENTO_AGUDO,
  "`": ACENTO_GRAVE,
  "^": ACENTO_CIRCUNFLEXO,
  "~": TIL,
  '"': TREMA,
  "=": MACRON,
  ".": PONTO_ACIMA,
  u: BREVE,
  v: CARON,
  H: ACENTO_AGUDO_DUPLO,
  c: CEDILHA,
  k: OGONEK,
  r: ANEL_ACIMA,
  d: PONTO_ABAIXO,
  b: LINHA_ABAIXO,
};

const CARACTERE_POR_COMANDO_SEM_ARGUMENTO: Record<string, string> = {
  ss: "ß",
  ae: "æ",
  AE: "Æ",
  oe: "œ",
  OE: "Œ",
  o: "ø",
  O: "Ø",
  aa: "å",
  AA: "Å",
  l: "ł",
  L: "Ł",
  dh: "ð",
  DH: "Ð",
  th: "þ",
  TH: "Þ",
  i: "ı",
  j: "ȷ",
  dag: "†",
  ddag: "‡",
  pounds: "£",
  copyright: "©",
  ldots: "…",
  dots: "…",
  textendash: "–",
  textemdash: "—",
  textquoteleft: "‘",
  textquoteright: "’",
  textbullet: "•",
  textdegree: "°",
};

const CARACTERES_ESCAPAVEIS = new Set(["&", "%", "$", "#", "_", "{", "}"]);

const LETRA_COM_PINGO_RESTAURADO: Record<string, string> = {
  "ı": "i",
  "ȷ": "j",
};

const MARCADOR_CHAVE_ABERTA_LITERAL = String.fromCharCode(0xe000);
const MARCADOR_CHAVE_FECHADA_LITERAL = String.fromCharCode(0xe001);

const LETRA = /[A-Za-z]/;
const ESPACOS_CONSECUTIVOS = /[ \t\r\n]+/g;
const CHAVES_DE_PROTECAO = /[{}]/g;
const SEPARADOR_DE_PAGINAS = /\s*(?:--+|[–—])\s*/g;

function ehLetra(caractere: string | undefined): boolean {
  return caractere !== undefined && LETRA.test(caractere);
}

function ehComandoDeAcento(comando: string): boolean {
  return comando.length === 1 && comando in MARCA_COMBINANTE_POR_COMANDO;
}

function restaurarPingoAntesDeAcentuar(base: string): string {
  const ultimaLetra = base.slice(-1);
  const comPingo = LETRA_COM_PINGO_RESTAURADO[ultimaLetra];
  return comPingo ? base.slice(0, -1) + comPingo : base;
}

function acentuar(base: string, comandoDeAcento: string): string {
  return (
    restaurarPingoAntesDeAcentuar(latexParaUnicode(base)) +
    MARCA_COMBINANTE_POR_COMANDO[comandoDeAcento]
  );
}

function encontrarFimDoBlocoEntreChaves(origem: string, aberturaEm: number): number {
  let chavesAbertas = 1;
  let posicao = aberturaEm + 1;

  while (posicao < origem.length && chavesAbertas > 0) {
    const caractere = origem[posicao];
    if (caractere === "\\") {
      posicao += 2;
      continue;
    }
    if (caractere === "{") chavesAbertas++;
    else if (caractere === "}") chavesAbertas--;
    posicao++;
  }

  return posicao;
}

function encontrarFimDoComando(origem: string, barraEm: number): number {
  let posicao = barraEm + 1;
  while (posicao < origem.length && ehLetra(origem[posicao])) posicao++;
  return posicao === barraEm + 1 ? posicao + 1 : posicao;
}

interface ArgumentoLido {
  argumento: string;
  proximaPosicao: number;
}

function lerArgumentoDoAcento(origem: string, inicio: number): ArgumentoLido {
  let posicao = inicio;
  while (posicao < origem.length && origem[posicao] === " ") posicao++;

  if (origem[posicao] === "{") {
    const fim = encontrarFimDoBlocoEntreChaves(origem, posicao);
    return {
      argumento: origem.slice(posicao + 1, fim - 1),
      proximaPosicao: fim,
    };
  }

  if (origem[posicao] === "\\") {
    const fim = encontrarFimDoComando(origem, posicao);
    return { argumento: origem.slice(posicao, fim), proximaPosicao: fim };
  }

  if (posicao < origem.length) {
    return { argumento: origem[posicao]!, proximaPosicao: posicao + 1 };
  }

  return { argumento: "", proximaPosicao: posicao };
}

function posicaoAposComando(origem: string, fimDoNome: number): number {
  return origem[fimDoNome] === " " ? fimDoNome + 1 : fimDoNome;
}

function preservarChaveEscapada(chave: string): string {
  return chave === "{"
    ? MARCADOR_CHAVE_ABERTA_LITERAL
    : MARCADOR_CHAVE_FECHADA_LITERAL;
}

function restaurarChavesEscapadas(texto: string): string {
  return texto
    .split(MARCADOR_CHAVE_ABERTA_LITERAL)
    .join("{")
    .split(MARCADOR_CHAVE_FECHADA_LITERAL)
    .join("}");
}

function limparResultado(texto: string): string {
  return restaurarChavesEscapadas(texto.replace(CHAVES_DE_PROTECAO, ""))
    .normalize("NFC")
    .replace(ESPACOS_CONSECUTIVOS, " ")
    .trim();
}

export function latexParaUnicode(entrada: string): string {
  let texto = "";
  let posicao = 0;

  while (posicao < entrada.length) {
    const caractere = entrada[posicao]!;

    if (caractere !== "\\") {
      texto += caractere;
      posicao++;
      continue;
    }

    const aposBarra = entrada[posicao + 1];
    if (aposBarra === undefined) break;

    if (ehLetra(aposBarra)) {
      const fimDoNome = encontrarFimDoComando(entrada, posicao);
      const comando = entrada.slice(posicao + 1, fimDoNome);
      const caractereProprio = CARACTERE_POR_COMANDO_SEM_ARGUMENTO[comando];

      if (caractereProprio !== undefined) {
        texto += caractereProprio;
        posicao = posicaoAposComando(entrada, fimDoNome);
        continue;
      }

      if (ehComandoDeAcento(comando)) {
        const { argumento, proximaPosicao } = lerArgumentoDoAcento(entrada, fimDoNome);
        texto += acentuar(argumento, comando);
        posicao = proximaPosicao;
        continue;
      }

      posicao = posicaoAposComando(entrada, fimDoNome);
      continue;
    }

    if (ehComandoDeAcento(aposBarra)) {
      const { argumento, proximaPosicao } = lerArgumentoDoAcento(entrada, posicao + 2);
      texto += acentuar(argumento, aposBarra);
      posicao = proximaPosicao;
      continue;
    }

    if (CARACTERES_ESCAPAVEIS.has(aposBarra)) {
      texto +=
        aposBarra === "{" || aposBarra === "}"
          ? preservarChaveEscapada(aposBarra)
          : aposBarra;
      posicao += 2;
      continue;
    }

    posicao += 2;
  }

  return limparResultado(texto);
}

export function normalizarPaginas(paginas: string): string {
  return paginas.replace(SEPARADOR_DE_PAGINAS, "-").trim();
}
