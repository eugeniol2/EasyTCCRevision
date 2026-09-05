import { deduplicar } from "../src/lib/dedup";
import { analisarDominios, emailPermitido } from "../src/lib/dominio";
import {
  MAXIMO_DE_CARACTERES,
  MAXIMO_DE_ENTRADAS,
  recusaPorQuantidade,
  recusaPorTamanho,
} from "../src/lib/limites";
import { formatarAutores, parseAutores } from "../src/lib/bibtex/autores";
import { latexParaUnicode } from "../src/lib/bibtex/latex";
import { entradaParaEstudo } from "../src/lib/bibtex/paraEstudo";
import { parseBibtex } from "../src/lib/bibtex/parser";
import { normalizarDoi, normalizarTitulo } from "../src/lib/normalizar";
import { parseCsv } from "../src/lib/csv/parser";
import { separarAutoresDeCsv } from "../src/lib/csv/paraEstudo";
import { detectarFormato, lerArquivo } from "../src/lib/leitura";
import { extrairMes, extrairPalavrasChave, formatarMes } from "../src/lib/publicacao";

let verificacoesQuePassaram = 0;
let verificacoesQueFalharam = 0;

function checar(descricao: string, obtido: unknown, esperado: unknown): void {
  const obtidoSerializado = JSON.stringify(obtido);
  const esperadoSerializado = JSON.stringify(esperado);

  if (obtidoSerializado === esperadoSerializado) {
    verificacoesQuePassaram++;
    console.log(`  ok   ${descricao}`);
    return;
  }

  verificacoesQueFalharam++;
  console.log(
    `  FALHA ${descricao}\n        esperado: ${esperadoSerializado}\n        obtido:   ${obtidoSerializado}`,
  );
}

function secao(nome: string): void {
  console.log(`\n${nome}`);
}

secao("LaTeX -> Unicode");
checar("acento em chaves", latexParaUnicode("Concei{\\c{c}}{\\~a}o"), "Conceição");
checar("acento sem chaves", latexParaUnicode("Concei\\c{c}\\~{a}o"), "Conceição");
checar("agudo simples", latexParaUnicode("Jo\\~ao Gr\\'egorio"), "João Grégorio");
checar("i sem pingo recebe acento", latexParaUnicode("Rodr\\'{\\i}guez"), "Rodríguez");
checar("chave de proteção some", latexParaUnicode("A Study on {LLMs}"), "A Study on LLMs");
checar("e comercial escapado", latexParaUnicode("Ciência \\& Sociedade"), "Ciência & Sociedade");
checar("comando desconhecido mantém conteúdo", latexParaUnicode("um \\textit{survey}"), "um survey");
checar("trema e cedilha", latexParaUnicode('G\\"odel e Fran\\c{c}a'), "Gödel e França");

const ARQUIVO_BIB = String.raw`
% Comentário solto no topo.

@string{ieeetse = "IEEE Transactions on Software Engineering"}

@article{silva2023,
  author  = {da Silva, Jo\~ao Pedro and Concei\c{c}\~ao, Maria},
  title   = {An\'alise de {LLMs} aplicados {\`a} Engenharia de Software},
  journal = ieeetse,
  year    = 2023,
  volume  = {49},
  pages   = {1023--1041},
  doi     = {10.1109/TSE.2023.1234567},
  abstract= {Um estudo sobre {LLMs} em SE.},
}

@inproceedings{santos2022,
  author    = "Santos, Ana and {Instituto Federal de Pernambuco}",
  title     = "Systematic Mapping on Code Review",
  booktitle = "Proc. of the 44th ICSE",
  year      = "2022",
  url       = "https://dl.acm.org/doi/10.1145/3510003.3510123"
}

@comment{esta entrada inteira deve ser pulada}

@misc{semdoi2021,
  author = {Oliveira, Carlos},
  title  = {Revis\~ao sistem\'atica sobre testes automatizados},
  year   = {2021}
}

@article{quebrado2020}

@book{knuth1984,
  author    = {Knuth, Donald E.},
  title     = {The {\TeX}book},
  publisher = {Addison-Wesley},
  year      = {1984},
}
`;

secao("Parser BibTeX");
const arquivoLido = parseBibtex(ARQUIVO_BIB);
checar("entradas válidas", arquivoLido.entradas.length, 4);
checar("entrada sem campos vira erro", arquivoLido.erros.length, 1);
checar("@comment não vira entrada", arquivoLido.entradas.some((e) => e.tipo === "comment"), false);

const artigoDeSilva = arquivoLido.entradas[0]!;
checar("tipo da entrada", artigoDeSilva.tipo, "article");
checar("chave de citação", artigoDeSilva.chave, "silva2023");
checar(
  "macro @string resolvida",
  artigoDeSilva.campos.journal,
  "IEEE Transactions on Software Engineering",
);
checar("valor nu sem chaves", artigoDeSilva.campos.year, "2023");
checar("chaves aninhadas preservadas", artigoDeSilva.campos.title?.includes("{LLMs}"), true);

const artigoDeSantos = arquivoLido.entradas[1]!;
checar("valor entre aspas", artigoDeSantos.campos.booktitle, "Proc. of the 44th ICSE");

secao("Autores");
const autoresDeSilva = parseAutores(artigoDeSilva.campos.author);
checar("quantidade de autores", autoresDeSilva.length, 2);
checar("sobrenome com partícula", autoresDeSilva[0]!.family, "da Silva");
checar("prenome", autoresDeSilva[0]!.given, "João Pedro");
checar("acento no sobrenome", autoresDeSilva[1]!.family, "Conceição");

const autoresDeSantos = parseAutores(artigoDeSantos.campos.author);
checar("'and' entre chaves não separa", autoresDeSantos.length, 2);
checar(
  "nome institucional vira literal",
  autoresDeSantos[1]!.literal,
  "Instituto Federal de Pernambuco",
);
checar("listagem abreviada", formatarAutores(autoresDeSilva), "da Silva J.; Conceição M.");
checar("nome sem vírgula", parseAutores("Donald E. Knuth")[0]!.family, "Knuth");

secao("Entrada -> Estudo");
const estudoDeSilva = entradaParaEstudo(artigoDeSilva);
checar(
  "título decodificado",
  estudoDeSilva.titulo,
  "Análise de LLMs aplicados à Engenharia de Software",
);
checar(
  "título normalizado",
  estudoDeSilva.tituloNorm,
  "analise de llms aplicados a engenharia de software",
);
checar("DOI canônico", estudoDeSilva.doiNorm, "10.1109/tse.2023.1234567");
checar("ano extraído", estudoDeSilva.ano, 2023);
checar("veículo pelo tipo da entrada", estudoDeSilva.veiculo, "IEEE Transactions on Software Engineering");

const estudoDeSantos = entradaParaEstudo(artigoDeSantos);
checar("DOI extraído da url", estudoDeSantos.doiNorm, "10.1145/3510003.3510123");
checar("veículo de inproceedings", estudoDeSantos.veiculo, "Proc. of the 44th ICSE");

const estudoSemDoi = entradaParaEstudo(arquivoLido.entradas[2]!);
checar("ausência de DOI vira nulo", estudoSemDoi.doiNorm, null);
checar("url nula sem doi e sem campo", estudoSemDoi.url, null);

secao("Normalização");
checar("prefixo doi.org removido", normalizarDoi("https://doi.org/10.1145/ABC"), "10.1145/abc");
checar("prefixo doi: removido", normalizarDoi("doi: 10.1145/abc"), "10.1145/abc");
checar("texto que não é doi", normalizarDoi("não é um doi"), null);
checar("acento removido do título", normalizarTitulo("Séries Temporais: um survey"), "series temporais um survey");

secao("Deduplicação");
const mesmoArtigoDaScopus = { ...estudoDeSilva };
const mesmoArtigoDaIeee = {
  ...estudoDeSilva,
  resumo: null,
  veiculo: null,
  chaveBibtex: "silva2023a",
};
const mesmoArtigoDoScholar = {
  ...estudoDeSilva,
  resumo: null,
  autores: [],
  veiculo: null,
  chaveBibtex: "silva2023b",
};

const dedupPorDoi = deduplicar([
  mesmoArtigoDaIeee,
  mesmoArtigoDaScopus,
  mesmoArtigoDoScholar,
]);
checar("três origens viram um estudo", dedupPorDoi.unicos.length, 1);
checar("motivo da fusão é o DOI", dedupPorDoi.fundidos[0]!.motivo, "doi");
checar(
  "sobrevive o registro mais completo",
  dedupPorDoi.unicos[0]!.chaveBibtex,
  "silva2023",
);

const tituloComPontuacaoDiferente = "Revisão Sistemática sobre Testes Automatizados!";
const mesmoTituloOutraGrafia = {
  ...estudoSemDoi,
  titulo: tituloComPontuacaoDiferente,
  tituloNorm: normalizarTitulo(tituloComPontuacaoDiferente),
  chaveBibtex: "outro2021",
};
const dedupPorTitulo = deduplicar([{ ...estudoSemDoi }, mesmoTituloOutraGrafia]);
checar("título equivalente funde sozinho", dedupPorTitulo.unicos.length, 1);

const tituloDaParteUm = "Testes automatizados em microsservicos parte I";
const tituloDaParteDois = "Testes automatizados em microsservicos parte II";
const parteUm = {
  ...estudoSemDoi,
  titulo: tituloDaParteUm,
  tituloNorm: normalizarTitulo(tituloDaParteUm),
  chaveBibtex: "parte1",
};
const parteDois = {
  ...estudoSemDoi,
  titulo: tituloDaParteDois,
  tituloNorm: normalizarTitulo(tituloDaParteDois),
  chaveBibtex: "parte2",
};
const dedupComSuspeita = deduplicar([parteUm, parteDois]);
checar("parte I e II viram suspeita", dedupComSuspeita.suspeitas.length, 1);
checar("nenhum dos dois é descartado", dedupComSuspeita.unicos.length, 2);

const tituloDeOutroTema = "Aprendizado de maquina aplicado a diagnostico medico";
const artigoDeOutroTema = {
  ...estudoSemDoi,
  titulo: tituloDeOutroTema,
  tituloNorm: normalizarTitulo(tituloDeOutroTema),
  chaveBibtex: "distinto",
};
const dedupSemRelacao = deduplicar([{ ...estudoSemDoi }, artigoDeOutroTema]);
checar("artigos distintos permanecem separados", dedupSemRelacao.unicos.length, 2);
checar("nenhuma suspeita falsa", dedupSemRelacao.suspeitas.length, 0);

const QUEBRA_DE_LINHA = String.fromCharCode(10);

secao("CSV");
const CSV_SPRINGER = [
  "Item Title,Publication Title,Item DOI,Authors,Publication Year,URL,Content Type",
  '"Securing IoT: protocols, tools, and metrics",Scientific Reports,10.1038/s41598-025-23865-4,Deepa Ashok PatilShyamala G.,2025,https://link.springer.com/article/10.1038/s41598-025-23865-4,Article',
  "Privacy-preserving detection of threats,Cluster Computing,10.1007/s10586-026-06472-4,Manish KhuleDeepak MotwaniDipti Chauhan,2026,https://link.springer.com/article/10.1007/s10586-026-06472-4,Article",
].join(QUEBRA_DE_LINHA);

const linhasDoCsv = parseCsv(CSV_SPRINGER);
checar("linhas lidas", linhasDoCsv.length, 3);
checar("colunas do cabeçalho", linhasDoCsv[0]!.length, 7);
checar(
  "vírgula dentro de aspas não separa campo",
  linhasDoCsv[1]![0],
  "Securing IoT: protocols, tools, and metrics",
);
checar('aspas duplicadas viram uma', parseCsv('a,"diz ""oi""",b')[0]![1], 'diz "oi"');
checar("campo vazio é preservado", parseCsv("a,,c")[0]!.length, 3);

checar("formato csv detectado", detectarFormato(CSV_SPRINGER), "csv");
checar("formato bibtex detectado", detectarFormato("@article{a, title={x}}"), "bibtex");
checar("formato desconhecido", detectarFormato("texto solto sem estrutura"), "desconhecido");

secao("Autores colados do CSV da Springer");
checar(
  "tres autores sem separador",
  separarAutoresDeCsv("Manish KhuleDeepak MotwaniDipti Chauhan").length,
  3,
);
checar(
  "sobrenome do primeiro nao vaza para o segundo",
  separarAutoresDeCsv("Manish KhuleDeepak Motwani")[0]!.family,
  "Khule",
);
checar(
  "inicial do meio nao quebra o nome",
  separarAutoresDeCsv("Abdullah M. BaqasahSultan Algarni").length,
  2,
);
checar(
  "sete autores concatenados",
  separarAutoresDeCsv(
    "Umesh Kumar LilhoreSantosh KumarRoobaea AlroobaeaMajed AlsafyaniAbdullah M. BaqasahSultan AlgarniLidia Gosy Tekeste",
  ).length,
  7,
);
checar(
  "separador explicito continua funcionando",
  separarAutoresDeCsv("Silva, Joao; Souza, Maria").length,
  2,
);
checar("campo vazio nao gera autor", separarAutoresDeCsv("").length, 0);

secao("CSV -> Estudo");
const doCsv = lerArquivo(CSV_SPRINGER);
checar("dois estudos", doCsv.estudos.length, 2);
checar("sem erros", doCsv.erros.length, 0);
checar("doi normalizado", doCsv.estudos[1]!.doiNorm, "10.1007/s10586-026-06472-4");
checar("veiculo mapeado", doCsv.estudos[1]!.veiculo, "Cluster Computing");
checar("ano mapeado", doCsv.estudos[1]!.ano, 2026);
checar("tipo em minusculas", doCsv.estudos[1]!.tipo, "article");
checar(
  "csv sem coluna de titulo vira erro",
  lerArquivo(["Coluna A,Coluna B", "1,2"].join(QUEBRA_DE_LINHA)).erros.length > 0,
  true,
);

secao("Mes e temas");
checar("mes por abreviacao", extrairMes("jan"), 1);
checar("mes por nome completo", extrairMes("September"), 9);
checar("mes em portugues", extrairMes("março"), 3);
checar("mes numerico", extrairMes("11"), 11);
checar("mes dentro de data ISO", extrairMes("2026-04-15"), 4);
checar("mes invalido vira nulo", extrairMes("13"), null);
checar("ano sozinho nao vira mes", extrairMes("2026"), null);
checar("mes formatado", formatarMes(3), "Março");
checar("mes nulo nao formata", formatarMes(null), null);

checar(
  "temas separados por ponto e virgula",
  extrairPalavrasChave("Accuracy;Machine learning;Cloud security"),
  ["Accuracy", "Machine learning", "Cloud security"],
);
checar(
  "temas separados por virgula",
  extrairPalavrasChave("anomaly detection, audit log"),
  ["anomaly detection", "audit log"],
);
checar(
  "tema repetido some",
  extrairPalavrasChave("Seguranca;seguranca;Redes").length,
  2,
);
checar("campo vazio nao gera tema", extrairPalavrasChave(""), []);

const comMetadados = lerArquivo(
  "@article{a, title={T}, year={2026}, month={mar}, keywords={IA;Seguranca}}",
);
checar("mes lido do bibtex", comMetadados.estudos[0]!.mes, 3);
checar("temas lidos do bibtex", comMetadados.estudos[0]!.palavrasChave.length, 2);

secao("Nome invertido na exportacao");
const CAMPO_INVERTIDO =
  "A M M I P, Athapaththu and R M C A, Rathnayaka and Yapa, Kanishka and Fernando, Harinda";
const autoresInvertidos = parseAutores(CAMPO_INVERTIDO);

checar("quantidade preservada", autoresInvertidos.length, 4);
checar("iniciais antes da virgula viram prenome", autoresInvertidos[0]!.given, "A M M I P");
checar("sobrenome real e reconhecido", autoresInvertidos[0]!.family, "Athapaththu");
checar("segundo autor tambem corrigido", autoresInvertidos[1]!.family, "Rathnayaka");
checar("autor ja correto nao e trocado", autoresInvertidos[2]!.family, "Yapa");
checar("prenome do autor correto", autoresInvertidos[2]!.given, "Kanishka");
checar(
  "exibicao final",
  formatarAutores(autoresInvertidos, 10),
  "Athapaththu A.; Rathnayaka R.; Yapa K.; Fernando H.",
);
checar("inicial com ponto tambem troca", parseAutores("J. R., Tolkien")[0]!.family, "Tolkien");
checar("sobrenome normal permanece", parseAutores("Knuth, Donald E.")[0]!.family, "Knuth");
checar("particula permanece", parseAutores("van der Berg, Jan")[0]!.family, "van der Berg");

secao("Limites da importação");

checar("conteúdo normal passa", recusaPorTamanho("@article{a, title={x}}"), null);
checar("conteúdo vazio passa", recusaPorTamanho(""), null);
checar(
  "no limite exato ainda passa",
  recusaPorTamanho("x".repeat(MAXIMO_DE_CARACTERES)),
  null,
);
checar(
  "um caractere acima é recusado",
  recusaPorTamanho("x".repeat(MAXIMO_DE_CARACTERES + 1)) !== null,
  true,
);

checar("poucas entradas passam", recusaPorQuantidade(10), null);
checar("nenhuma entrada passa", recusaPorQuantidade(0), null);
checar("no limite exato ainda passa", recusaPorQuantidade(MAXIMO_DE_ENTRADAS), null);
checar(
  "uma entrada acima é recusada",
  recusaPorQuantidade(MAXIMO_DE_ENTRADAS + 1) !== null,
  true,
);
checar(
  "a recusa diz quantas vieram e qual é o teto",
  recusaPorQuantidade(2000)?.includes("2.000") === true &&
    recusaPorQuantidade(2000)?.includes("500") === true,
  true,
);

secao("Domínios permitidos");

function recusaConfiguracao(configuracao: string | undefined): boolean {
  try {
    analisarDominios(configuracao);
    return false;
  } catch {
    return true;
  }
}

checar("variavel ausente e recusada", recusaConfiguracao(undefined), true);
checar("variavel vazia e recusada", recusaConfiguracao(""), true);
checar("so espaco e recusado", recusaConfiguracao("   "), true);
checar("so virgulas e recusado", recusaConfiguracao(",,"), true);
checar("asterisco libera geral", analisarDominios("*"), "todos");
checar("um dominio", analisarDominios("ufrpe.br"), ["ufrpe.br"]);
checar("lista com espacos", analisarDominios(" ufrpe.br , gmail.com "), ["ufrpe.br", "gmail.com"]);
checar("maiuscula normaliza", analisarDominios("UFRPE.br"), ["ufrpe.br"]);
checar("arroba sobrando some", analisarDominios("@ufrpe.br"), ["ufrpe.br"]);
checar("aspas coladas do .env somem", analisarDominios('"ufrpe.br"'), ["ufrpe.br"]);
checar("aspas simples tambem", analisarDominios("'ufrpe.br'"), ["ufrpe.br"]);
checar("aspas em volta da lista", analisarDominios('"ufrpe.br,gmail.com"'), ["ufrpe.br", "gmail.com"]);
checar("aspas em volta do asterisco", analisarDominios('"*"'), "todos");
checar("so aspas e recusado", recusaConfiguracao('""'), true);

const soUfrpe = analisarDominios("ufrpe.br");
const doisDominios = analisarDominios("ufrpe.br,gmail.com");

checar("conta do dominio entra", emailPermitido("alguem@ufrpe.br", soUfrpe), true);
checar("maiuscula no email entra", emailPermitido("Alguem@UFRPE.br", soUfrpe), true);
checar("espaco em volta nao atrapalha", emailPermitido("  alguem@ufrpe.br ", soUfrpe), true);
checar("conta de fora fica de fora", emailPermitido("alguem@gmail.com", soUfrpe), false);
checar("dominio parecido nao passa", emailPermitido("alguem@naoufrpe.br", soUfrpe), false);
checar("subdominio nao passa", emailPermitido("alguem@ic.ufrpe.br", soUfrpe), false);
checar("dominio no meio nao passa", emailPermitido("ufrpe.br@gmail.com", soUfrpe), false);
checar("email vazio nao passa", emailPermitido(null, soUfrpe), false);
checar("segundo dominio da lista entra", emailPermitido("alguem@gmail.com", doisDominios), true);
checar("fora dos dois nao entra", emailPermitido("alguem@ufpe.br", doisDominios), false);
checar("liberado geral aceita qualquer um", emailPermitido("alguem@qualquer.com", "todos"), true);

console.log(
  `\n${verificacoesQuePassaram} passaram, ${verificacoesQueFalharam} falharam`,
);
process.exit(verificacoesQueFalharam > 0 ? 1 : 0);
