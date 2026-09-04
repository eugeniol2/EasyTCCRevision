export interface EntradaBruta {
  tipo: string;
  chave: string;
  campos: Record<string, string>;
  bruto: string;
}

export interface ErroBibtex {
  mensagem: string;
  posicao: number;
  linha: number;
}

export interface ResultadoBibtex {
  entradas: EntradaBruta[];
  erros: ErroBibtex[];
}

const TIPOS_SEM_METADADOS = new Set(["comment", "preamble"]);
const TIPO_DE_DEFINICAO_DE_MACRO = "string";

const INICIO_DE_ENTRADA = "@";
const OPERADOR_DE_CONCATENACAO = "#";
const SEPARADOR_DE_CAMPOS = ",";
const ATRIBUICAO = "=";
const ASPAS = '"';
const BARRA_INVERTIDA = "\\";

const FECHAMENTO_POR_ABERTURA: Record<string, string> = { "{": "}", "(": ")" };

const CARACTERE_DE_IDENTIFICADOR = /[A-Za-z0-9_:+\-.\/]/;
const ESPACO_EM_BRANCO = /\s/;
const QUEBRA_DE_LINHA = "\n";

class LeitorBibtex {
  posicao = 0;

  constructor(readonly origem: string) {}

  get terminou(): boolean {
    return this.posicao >= this.origem.length;
  }

  caractereAtual(): string | undefined {
    return this.origem[this.posicao];
  }

  estaEm(caractere: string): boolean {
    return this.caractereAtual() === caractere;
  }

  avancar(casas = 1): void {
    this.posicao += casas;
  }

  pularEspacos(): void {
    while (!this.terminou && ESPACO_EM_BRANCO.test(this.caractereAtual()!)) {
      this.avancar();
    }
  }

  avancarAte(deveParar: (caractere: string) => boolean): void {
    while (!this.terminou && !deveParar(this.caractereAtual()!)) this.avancar();
  }

  numeroDaLinhaEm(posicao: number): number {
    let linha = 1;
    for (let i = 0; i < posicao && i < this.origem.length; i++) {
      if (this.origem[i] === QUEBRA_DE_LINHA) linha++;
    }
    return linha;
  }

  lerIdentificador(): string {
    const inicio = this.posicao;
    this.avancarAte((caractere) => !CARACTERE_DE_IDENTIFICADOR.test(caractere));
    return this.origem.slice(inicio, this.posicao);
  }

  lerBlocoEntreChaves(): string {
    this.avancar();
    const inicio = this.posicao;
    let chavesAbertas = 1;

    while (!this.terminou && chavesAbertas > 0) {
      const caractere = this.caractereAtual()!;
      if (caractere === BARRA_INVERTIDA) {
        this.avancar(2);
        continue;
      }
      if (caractere === "{") chavesAbertas++;
      else if (caractere === "}") chavesAbertas--;
      this.avancar();
    }

    return this.origem.slice(inicio, this.posicao - 1);
  }

  lerTextoEntreAspas(): string {
    this.avancar();
    const inicio = this.posicao;
    let chavesAbertas = 0;

    while (!this.terminou) {
      const caractere = this.caractereAtual()!;
      if (caractere === BARRA_INVERTIDA) {
        this.avancar(2);
        continue;
      }
      if (caractere === "{") chavesAbertas++;
      else if (caractere === "}") chavesAbertas--;
      else if (caractere === ASPAS && chavesAbertas === 0) break;
      this.avancar();
    }

    const texto = this.origem.slice(inicio, this.posicao);
    this.avancar();
    return texto;
  }
}

type Macros = Map<string, string>;

function lerParteDoValor(leitor: LeitorBibtex, macros: Macros): string | null {
  if (leitor.estaEm("{")) return leitor.lerBlocoEntreChaves();
  if (leitor.estaEm(ASPAS)) return leitor.lerTextoEntreAspas();

  const literalOuMacro = leitor.lerIdentificador();
  if (literalOuMacro === "") return null;
  return macros.get(literalOuMacro.toLowerCase()) ?? literalOuMacro;
}

function lerValorDoCampo(leitor: LeitorBibtex, macros: Macros): string {
  const partesConcatenadas: string[] = [];

  for (;;) {
    leitor.pularEspacos();
    if (leitor.terminou) break;

    const parte = lerParteDoValor(leitor, macros);
    if (parte === null) break;
    partesConcatenadas.push(parte);

    leitor.pularEspacos();
    if (!leitor.estaEm(OPERADOR_DE_CONCATENACAO)) break;
    leitor.avancar();
  }

  return partesConcatenadas.join("");
}

function lerCamposDaEntrada(
  leitor: LeitorBibtex,
  macros: Macros,
  fechamento: string,
): Record<string, string> {
  const campos: Record<string, string> = {};

  while (!leitor.terminou) {
    leitor.pularEspacos();

    if (leitor.estaEm(fechamento)) {
      leitor.avancar();
      break;
    }
    if (leitor.estaEm(SEPARADOR_DE_CAMPOS)) {
      leitor.avancar();
      continue;
    }

    const nome = leitor.lerIdentificador().toLowerCase();
    if (nome === "") {
      leitor.avancar();
      continue;
    }

    leitor.pularEspacos();
    if (!leitor.estaEm(ATRIBUICAO)) continue;
    leitor.avancar();

    const valor = lerValorDoCampo(leitor, macros);
    const primeiraOcorrenciaVence = !(nome in campos);
    if (primeiraOcorrenciaVence) campos[nome] = valor;
  }

  return campos;
}

function pularAteProximaEntrada(leitor: LeitorBibtex): void {
  leitor.avancarAte((caractere) => caractere === INICIO_DE_ENTRADA);
}

function pularEntradaInteira(leitor: LeitorBibtex, inicioDaEntrada: number): void {
  leitor.posicao = inicioDaEntrada;
  leitor.avancarAte((caractere) => caractere in FECHAMENTO_POR_ABERTURA);
  leitor.lerBlocoEntreChaves();
}

function registrarMacro(
  leitor: LeitorBibtex,
  macros: Macros,
  fechamento: string,
): void {
  leitor.avancar();
  leitor.pularEspacos();
  const nome = leitor.lerIdentificador().toLowerCase();

  leitor.pularEspacos();
  if (leitor.estaEm(ATRIBUICAO)) {
    leitor.avancar();
    macros.set(nome, lerValorDoCampo(leitor, macros));
  }

  leitor.pularEspacos();
  if (leitor.estaEm(fechamento)) leitor.avancar();
}

function lerChaveDeCitacao(leitor: LeitorBibtex, fechamento: string): string {
  const inicio = leitor.posicao;
  leitor.avancarAte(
    (caractere) => caractere === SEPARADOR_DE_CAMPOS || caractere === fechamento,
  );
  const chave = leitor.origem.slice(inicio, leitor.posicao).trim();

  if (leitor.estaEm(SEPARADOR_DE_CAMPOS)) leitor.avancar();
  return chave;
}

export function parseBibtex(conteudo: string): ResultadoBibtex {
  const leitor = new LeitorBibtex(conteudo);
  const entradas: EntradaBruta[] = [];
  const erros: ErroBibtex[] = [];
  const macros: Macros = new Map();

  const registrarErro = (mensagem: string, posicao: number): void => {
    erros.push({ mensagem, posicao, linha: leitor.numeroDaLinhaEm(posicao) });
  };

  while (!leitor.terminou) {
    pularAteProximaEntrada(leitor);
    if (leitor.terminou) break;

    const inicioDaEntrada = leitor.posicao;
    leitor.avancar();
    leitor.pularEspacos();

    const tipo = leitor.lerIdentificador().toLowerCase();
    if (tipo === "") {
      registrarErro("'@' sem tipo de entrada", inicioDaEntrada);
      continue;
    }

    leitor.pularEspacos();
    const abertura = leitor.caractereAtual();
    const fechamento = abertura ? FECHAMENTO_POR_ABERTURA[abertura] : undefined;
    if (fechamento === undefined) {
      registrarErro(`Entrada @${tipo} sem '{' de abertura`, inicioDaEntrada);
      continue;
    }

    if (TIPOS_SEM_METADADOS.has(tipo)) {
      pularEntradaInteira(leitor, inicioDaEntrada);
      continue;
    }

    if (tipo === TIPO_DE_DEFINICAO_DE_MACRO) {
      registrarMacro(leitor, macros, fechamento);
      continue;
    }

    leitor.avancar();
    leitor.pularEspacos();

    const chave = lerChaveDeCitacao(leitor, fechamento);
    const campos = lerCamposDaEntrada(leitor, macros, fechamento);

    const entradaSemNenhumCampo = Object.keys(campos).length === 0;
    if (entradaSemNenhumCampo) {
      registrarErro(`Entrada @${tipo}{${chave}} não tem nenhum campo`, inicioDaEntrada);
      continue;
    }

    entradas.push({
      tipo,
      chave,
      campos,
      bruto: leitor.origem.slice(inicioDaEntrada, leitor.posicao),
    });
  }

  return { entradas, erros };
}
