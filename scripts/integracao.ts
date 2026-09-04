import { randomUUID } from "node:crypto";
import { existsSync, rmSync } from "node:fs";
import Database from "better-sqlite3";

const ARQUIVO_DE_TESTE = "teste-integracao.db";
const ARQUIVO_DE_REFERENCIA = "revisa.db";

process.env.DATABASE_FILE = ARQUIVO_DE_TESTE;

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

function apagarBancoDeTeste(): void {
  for (const sufixo of ["", "-wal", "-shm"]) {
    if (existsSync(`${ARQUIVO_DE_TESTE}${sufixo}`)) {
      rmSync(`${ARQUIVO_DE_TESTE}${sufixo}`);
    }
  }
}

function criarEsquema(): void {
  if (!existsSync(ARQUIVO_DE_REFERENCIA)) {
    console.error(
      `${ARQUIVO_DE_REFERENCIA} não existe. Rode "npm run db:push" antes.`,
    );
    process.exit(1);
  }

  const destino = new Database(ARQUIVO_DE_TESTE);
  const referencia = new Database(ARQUIVO_DE_REFERENCIA);
  const definicoes = referencia
    .prepare("select sql from sqlite_master where sql is not null")
    .all() as { sql: string }[];

  for (const { sql } of definicoes) destino.exec(sql);
  referencia.close();
  destino.close();
}

apagarBancoDeTeste();
criarEsquema();

// Import dinâmico: `src/db/client` lê DATABASE_FILE ao ser carregado, e
// um `import` estático seria içado para antes da atribuição acima — o
// teste rodaria contra o banco de desenvolvimento sem avisar.
const { db, fecharBanco } = await import("../src/db/client");
const { criterio, estudoBusca, protocolo } = await import("../src/db/schema");
const { contarPorDecisao, listarCriteriosDeExclusao, listarEstudosParaTriagem } =
  await import("../src/lib/consultas");
const { importarParaOProtocolo } = await import("../src/lib/importacao");
const { removerDecisao, salvarDecisao } = await import("../src/lib/triagem");

const ARTIGOS_DA_SCOPUS = String.raw`
@article{silva2023,
  author  = {da Silva, Jo\~ao and Concei\c{c}\~ao, Maria},
  title   = {An\'alise de {LLMs} na Engenharia de Software},
  journal = {IEEE TSE},
  year    = {2023},
  doi     = {10.1109/TSE.2023.1234567},
  abstract= {Resumo do estudo.}
}

@inproceedings{santos2022,
  author    = {Santos, Ana},
  title     = {Mapping on Code Review},
  booktitle = {ICSE},
  year      = {2022},
  doi       = {10.1145/3510003.3510123}
}

@misc{oliveira2021,
  author = {Oliveira, Carlos},
  title  = {Testes automatizados em microsservi\c{c}os},
  year   = {2021}
}
`;

const ARTIGOS_DA_IEEE = String.raw`
@article{silva2023dup,
  author  = {Silva, J.},
  title   = {Analise de LLMs na Engenharia de Software},
  journal = {IEEE Transactions on Software Engineering},
  year    = {2023},
  doi     = {https://doi.org/10.1109/TSE.2023.1234567}
}

@article{novo2024,
  author  = {Pereira, Lucas},
  title   = {Observabilidade em sistemas distribu\'idos},
  journal = {JSS},
  year    = {2024},
  doi     = {10.1016/j.jss.2024.999}
}
`;

const protocoloId = randomUUID();
db.insert(protocolo)
  .values({ id: protocoloId, titulo: "Protocolo de teste", anoInicio: 2020, anoFim: 2024 })
  .run();

db.insert(criterio)
  .values([
    { id: randomUUID(), protocoloId, tipo: "exclusao", codigo: "EC1", descricao: "Fora do escopo", ordem: 0 },
    { id: randomUUID(), protocoloId, tipo: "exclusao", codigo: "EC2", descricao: "Não é estudo primário", ordem: 1 },
  ])
  .run();

console.log("\nBanco de teste isolado");
const estudosNoInicio = db.select().from(estudoBusca).all();
checar("começa vazio", estudosNoInicio.length, 0);

console.log("\nPrimeira importação (Scopus)");
const daScopus = importarParaOProtocolo({
  protocoloId,
  base: "Scopus",
  stringBusca: 'TITLE-ABS-KEY("code review")',
  executadaEmSegundos: Math.floor(Date.now() / 1000),
  conteudo: ARTIGOS_DA_SCOPUS,
});
checar("entradas lidas", daScopus.entradasLidas, 3);
checar("estudos importados", daScopus.importados, 3);
checar("nada preexistente", daScopus.jaExistiamNoProtocolo, 0);

console.log("\nSegunda importação (IEEE, com um artigo repetido)");
const daIeee = importarParaOProtocolo({
  protocoloId,
  base: "IEEE Xplore",
  stringBusca: '("code review") AND ("systematic")',
  executadaEmSegundos: Math.floor(Date.now() / 1000),
  conteudo: ARTIGOS_DA_IEEE,
});
checar("só o inédito entra", daIeee.importados, 1);
checar("repetido é reconhecido pelo DOI", daIeee.jaExistiamNoProtocolo, 1);

const todosOsEstudos = listarEstudosParaTriagem(protocoloId);
checar("total sem duplicata", todosOsEstudos.length, 4);

const vinculos = db.select().from(estudoBusca).all();
checar("vínculos estudo-busca", vinculos.length, 5);

const estudoRepetido = todosOsEstudos.find(
  (estudo) => estudo.doi === "10.1109/tse.2023.1234567",
)!;
const buscasDoRepetido = vinculos.filter(
  (vinculo) => vinculo.estudoId === estudoRepetido.id,
);
checar("artigo repetido aponta para as duas buscas", buscasDoRepetido.length, 2);
checar("registro mantido é o mais completo", estudoRepetido.resumo, "Resumo do estudo.");
checar(
  "acento decodificado na leitura",
  todosOsEstudos.some((estudo) => estudo.titulo.includes("microsserviços")),
  true,
);

console.log("\nImportação sem entrada válida");
const buscasAntes = daScopus.buscaId !== null;
checar("importação válida gerou busca", buscasAntes, true);
const vazia = importarParaOProtocolo({
  protocoloId,
  base: "SciELO",
  stringBusca: "nada",
  executadaEmSegundos: Math.floor(Date.now() / 1000),
  conteudo: "isto não é bibtex",
});
checar("nenhuma busca é gravada", vazia.buscaId, null);
checar("nenhum estudo é criado", vazia.importados, 0);

console.log("\nTriagem");
const criterios = listarCriteriosDeExclusao(protocoloId);
checar("critérios de exclusão listados", criterios.length, 2);

salvarDecisao({
  estudoId: todosOsEstudos[0]!.id,
  decisao: "incluido",
  criterioId: null,
});
salvarDecisao({
  estudoId: todosOsEstudos[1]!.id,
  decisao: "excluido",
  criterioId: criterios[0]!.id,
});
salvarDecisao({
  estudoId: todosOsEstudos[2]!.id,
  decisao: "duvida",
  criterioId: null,
});

const contagem = contarPorDecisao(protocoloId);
checar("incluídos", contagem.incluido, 1);
checar("excluídos", contagem.excluido, 1);
checar("em dúvida", contagem.duvida, 1);
checar("pendentes", contagem.pendente, 1);
checar("total", contagem.total, 4);

salvarDecisao({
  estudoId: todosOsEstudos[0]!.id,
  decisao: "excluido",
  criterioId: criterios[1]!.id,
});
const aposMudarDeIdeia = contarPorDecisao(protocoloId);
checar("decisão substituída, não duplicada", aposMudarDeIdeia.total, 4);
checar("passou a contar como excluído", aposMudarDeIdeia.excluido, 2);
checar("não é mais incluído", aposMudarDeIdeia.incluido, 0);

removerDecisao(todosOsEstudos[0]!.id);
const aposDesfazer = contarPorDecisao(protocoloId);
checar("desfazer devolve para pendente", aposDesfazer.pendente, 2);

console.log("\nLista de incluídos");
salvarDecisao({ estudoId: todosOsEstudos[0]!.id, decisao: "incluido", criterioId: null });
salvarDecisao({ estudoId: todosOsEstudos[3]!.id, decisao: "incluido", criterioId: null });

const comDecisoes = listarEstudosParaTriagem(protocoloId);
const listaDeIncluidos = comDecisoes.filter((e) => e.decisao === "incluido");
checar("dois incluídos na lista", listaDeIncluidos.length, 2);
checar(
  "retirar da lista devolve para pendente",
  (() => {
    removerDecisao(todosOsEstudos[3]!.id);
    return listarEstudosParaTriagem(protocoloId).filter(
      (e) => e.decisao === "incluido",
    ).length;
  })(),
  1,
);

console.log(
  `\n${verificacoesQuePassaram} passaram, ${verificacoesQueFalharam} falharam`,
);
process.exit(verificacoesQueFalharam > 0 ? 1 : 0);
