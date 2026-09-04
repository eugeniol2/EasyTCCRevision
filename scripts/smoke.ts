import { deduplicar } from "../src/lib/dedup";
import { formatarAutores, parseAutores } from "../src/lib/bibtex/autores";
import { latexParaUnicode } from "../src/lib/bibtex/latex";
import { entradaParaEstudo } from "../src/lib/bibtex/paraEstudo";
import { parseBibtex } from "../src/lib/bibtex/parser";
import { normalizarDoi, normalizarTitulo } from "../src/lib/normalizar";

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

console.log(
  `\n${verificacoesQuePassaram} passaram, ${verificacoesQueFalharam} falharam`,
);
process.exit(verificacoesQueFalharam > 0 ? 1 : 0);
