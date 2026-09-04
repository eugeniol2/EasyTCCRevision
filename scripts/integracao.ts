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
const {
  contarPorDecisao,
  LEITURA_COMPLETA,
  listarCriteriosDeExclusao,
  listarCriteriosDeInclusao,
  listarEstudosParaEstagio,
  TRIAGEM_INICIAL,
} = await import("../src/lib/consultas");
const { importarParaOProtocolo } = await import("../src/lib/importacao");
const { removerDecisao, removerTodasAsDecisoes, salvarDecisao } =
  await import("../src/lib/triagem");
const { descartarEstudo, descartarTudoDoProtocolo } =
  await import("../src/lib/estudos");
const { atualizarProtocolo, listarCriteriosEditaveis, salvarCriterios } =
  await import("../src/lib/protocolo");
const { busca, estudo, triagem } = await import("../src/db/schema");

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

const todosOsEstudos = listarEstudosParaEstagio(protocoloId, TRIAGEM_INICIAL);
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
  estagio: TRIAGEM_INICIAL,
  estudoId: todosOsEstudos[0]!.id,
  decisao: "incluido",
  criterioId: null,
});
salvarDecisao({
  estagio: TRIAGEM_INICIAL,
  estudoId: todosOsEstudos[1]!.id,
  decisao: "excluido",
  criterioId: criterios[0]!.id,
});
salvarDecisao({
  estagio: TRIAGEM_INICIAL,
  estudoId: todosOsEstudos[2]!.id,
  decisao: "duvida",
  criterioId: null,
});

const contagem = contarPorDecisao(protocoloId, TRIAGEM_INICIAL);
checar("incluídos", contagem.incluido, 1);
checar("excluídos", contagem.excluido, 1);
checar("em dúvida", contagem.duvida, 1);
checar("pendentes", contagem.pendente, 1);
checar("total", contagem.total, 4);

salvarDecisao({
  estagio: TRIAGEM_INICIAL,
  estudoId: todosOsEstudos[0]!.id,
  decisao: "excluido",
  criterioId: criterios[1]!.id,
});
const aposMudarDeIdeia = contarPorDecisao(protocoloId, TRIAGEM_INICIAL);
checar("decisão substituída, não duplicada", aposMudarDeIdeia.total, 4);
checar("passou a contar como excluído", aposMudarDeIdeia.excluido, 2);
checar("não é mais incluído", aposMudarDeIdeia.incluido, 0);

removerDecisao(todosOsEstudos[0]!.id, TRIAGEM_INICIAL);
const aposDesfazer = contarPorDecisao(protocoloId, TRIAGEM_INICIAL);
checar("desfazer devolve para pendente", aposDesfazer.pendente, 2);

console.log("\nLista de incluídos");
salvarDecisao({ estagio: TRIAGEM_INICIAL, estudoId: todosOsEstudos[0]!.id, decisao: "incluido", criterioId: null });
salvarDecisao({ estagio: TRIAGEM_INICIAL, estudoId: todosOsEstudos[3]!.id, decisao: "incluido", criterioId: null });

const comDecisoes = listarEstudosParaEstagio(protocoloId, TRIAGEM_INICIAL);
const listaDeIncluidos = comDecisoes.filter((e) => e.decisao === "incluido");
checar("dois incluídos na lista", listaDeIncluidos.length, 2);
checar(
  "retirar da lista devolve para pendente",
  (() => {
    removerDecisao(todosOsEstudos[3]!.id, TRIAGEM_INICIAL);
    return listarEstudosParaEstagio(protocoloId, TRIAGEM_INICIAL).filter(
      (e) => e.decisao === "incluido",
    ).length;
  })(),
  1,
);

console.log("\nZerar triagem");
salvarDecisao({ estagio: TRIAGEM_INICIAL, estudoId: todosOsEstudos[1]!.id, decisao: "duvida", criterioId: null });
const antesDeZerar = contarPorDecisao(protocoloId, TRIAGEM_INICIAL);
checar("ha decisoes antes de zerar", antesDeZerar.total - antesDeZerar.pendente, 3);

const outroProtocoloId = randomUUID();
db.insert(protocolo)
  .values({ id: outroProtocoloId, titulo: "Outro protocolo", anoInicio: 2020, anoFim: 2024 })
  .run();
importarParaOProtocolo({
  protocoloId: outroProtocoloId,
  base: "ACM",
  stringBusca: "outra",
  executadaEmSegundos: Math.floor(Date.now() / 1000),
  conteudo: ARTIGOS_DA_SCOPUS,
});
const doOutroProtocolo = listarEstudosParaEstagio(outroProtocoloId, TRIAGEM_INICIAL);
salvarDecisao({ estagio: TRIAGEM_INICIAL, estudoId: doOutroProtocolo[0]!.id, decisao: "incluido", criterioId: null });

checar("apaga todas as decisoes do protocolo", removerTodasAsDecisoes(protocoloId), 3);

const aposZerar = contarPorDecisao(protocoloId, TRIAGEM_INICIAL);
checar("tudo volta a pendente", aposZerar.pendente, aposZerar.total);
checar("estudos permanecem", listarEstudosParaEstagio(protocoloId, TRIAGEM_INICIAL).length, 4);
checar("protocolo vizinho nao e afetado", contarPorDecisao(outroProtocoloId, TRIAGEM_INICIAL).incluido, 1);
checar("zerar de novo nao apaga nada", removerTodasAsDecisoes(protocoloId), 0);

console.log("\nDescartar artigo");
salvarDecisao({ estagio: TRIAGEM_INICIAL, estudoId: doOutroProtocolo[1]!.id, decisao: "duvida", criterioId: null });
const alvo = doOutroProtocolo[1]!;
const vinculosAntes = db.select().from(estudoBusca).all().length;

checar("descarta um estudo", descartarEstudo(alvo.id), 1);
checar(
  "estudo some da lista",
  listarEstudosParaEstagio(outroProtocoloId, TRIAGEM_INICIAL).some((e) => e.id === alvo.id),
  false,
);
checar(
  "decisao vai junto (cascade)",
  db.select().from(triagem).all().some((t) => t.estudoId === alvo.id),
  false,
);
checar(
  "vinculo estudo-busca vai junto (cascade)",
  db.select().from(estudoBusca).all().length < vinculosAntes,
  true,
);
checar("descartar de novo nao apaga nada", descartarEstudo(alvo.id), 0);
checar("busca permanece", db.select().from(busca).all().length > 0, true);

console.log("\nDescartar tudo do protocolo");
const estudosDoOutro = listarEstudosParaEstagio(outroProtocoloId, TRIAGEM_INICIAL).length;
const buscasDoOutro = db.select().from(busca).all()
  .filter((b) => b.protocoloId === outroProtocoloId).length;

const descarte = descartarTudoDoProtocolo(outroProtocoloId);
checar("remove os estudos", descarte.estudosRemovidos, estudosDoOutro);
checar("remove as buscas", descarte.buscasRemovidas, buscasDoOutro);
checar("protocolo fica vazio", contarPorDecisao(outroProtocoloId, TRIAGEM_INICIAL).total, 0);
checar(
  "criterios do protocolo permanecem",
  listarCriteriosDeExclusao(protocoloId).length,
  2,
);
checar(
  "protocolo vizinho mantem seus estudos",
  listarEstudosParaEstagio(protocoloId, TRIAGEM_INICIAL).length,
  4,
);
checar(
  "buscas do vizinho permanecem",
  db.select().from(busca).all().filter((b) => b.protocoloId === protocoloId).length > 0,
  true,
);

console.log("");
console.log("Origem dos estudos");
const comOrigem = listarEstudosParaEstagio(protocoloId, TRIAGEM_INICIAL);
const repetidoNasDuas = comOrigem.find((e) => e.doi === "10.1109/tse.2023.1234567")!;
checar("artigo repetido mostra as duas bases", repetidoNasDuas.bases.length, 2);
checar(
  "bases sao Scopus e IEEE Xplore",
  [...repetidoNasDuas.bases].sort(),
  ["IEEE Xplore", "Scopus"],
);

const soDaScopus = comOrigem.find((e) => e.doi === "10.1145/3510003.3510123")!;
checar("artigo de uma base so tem uma origem", soDaScopus.bases, ["Scopus"]);
checar(
  "toda origem esta preenchida",
  comOrigem.every((e) => e.bases.length > 0),
  true,
);

console.log("");
console.log("Protocolo e criterios");
atualizarProtocolo(protocoloId, {
  titulo: "Revisao renomeada",
  questaoPesquisa: "Qual a pergunta?",
  anoInicio: 2019,
  anoFim: 2025,
});
const protocoloSalvo = db.select().from(protocolo).all()
  .find((p) => p.id === protocoloId)!;
checar("titulo atualizado", protocoloSalvo.titulo, "Revisao renomeada");
checar("pergunta gravada", protocoloSalvo.questaoPesquisa, "Qual a pergunta?");
checar("recorte gravado", [protocoloSalvo.anoInicio, protocoloSalvo.anoFim], [2019, 2025]);

const criteriosOriginais = listarCriteriosEditaveis(protocoloId);
checar("dois criterios existentes", criteriosOriginais.length, 2);

const estudosVivos = listarEstudosParaEstagio(protocoloId, TRIAGEM_INICIAL);
salvarDecisao({
  estagio: TRIAGEM_INICIAL,
  estudoId: estudosVivos[0]!.id,
  decisao: "excluido",
  criterioId: criteriosOriginais[0]!.id,
});

const criteriosAntes = listarCriteriosEditaveis(protocoloId);
checar(
  "uso em exclusoes e contado",
  criteriosAntes.find((c) => c.id === criteriosOriginais[0]!.id)!.usadoEmExclusoes,
  1,
);
checar(
  "criterio nao usado fica zerado",
  criteriosAntes.find((c) => c.id === criteriosOriginais[1]!.id)!.usadoEmExclusoes,
  0,
);

const resumo = salvarCriterios(protocoloId, [
  { id: criteriosAntes[0]!.id, tipo: "exclusao", descricao: "Descricao editada" },
  { id: null, tipo: "exclusao", descricao: "Criterio novo" },
  { id: null, tipo: "inclusao", descricao: "Estudo primario" },
]);
checar("um removido", resumo.removidos, 1);
checar("um atualizado", resumo.atualizados, 1);
checar("dois criados", resumo.criados, 2);

const criteriosDepois = listarCriteriosEditaveis(protocoloId);
checar("total apos gravar", criteriosDepois.length, 3);
checar(
  "codigo do existente nao muda",
  criteriosDepois.find((c) => c.id === criteriosAntes[0]!.id)!.codigo,
  criteriosAntes[0]!.codigo,
);
checar(
  "novo criterio de exclusao pega codigo livre",
  criteriosDepois.find((c) => c.descricao === "Criterio novo")!.codigo,
  "EC3",
);
checar(
  "criterio de inclusao usa prefixo IC",
  criteriosDepois.find((c) => c.descricao === "Estudo primario")!.codigo,
  "IC1",
);
checar(
  "descricao vazia e ignorada",
  salvarCriterios(protocoloId, [
    ...criteriosDepois.map((c) => ({ id: c.id, tipo: c.tipo, descricao: c.descricao })),
    { id: null, tipo: "exclusao" as const, descricao: "   " },
  ]).criados,
  0,
);

console.log("");
console.log("Funil entre as fases");
const paraOFunil = listarEstudosParaEstagio(protocoloId, TRIAGEM_INICIAL);
removerTodasAsDecisoes(protocoloId);

salvarDecisao({ estagio: TRIAGEM_INICIAL, estudoId: paraOFunil[0]!.id, decisao: "incluido", criterioId: null });
salvarDecisao({ estagio: TRIAGEM_INICIAL, estudoId: paraOFunil[1]!.id, decisao: "incluido", criterioId: null });
salvarDecisao({ estagio: TRIAGEM_INICIAL, estudoId: paraOFunil[2]!.id, decisao: "excluido", criterioId: null });
salvarDecisao({ estagio: TRIAGEM_INICIAL, estudoId: paraOFunil[3]!.id, decisao: "duvida", criterioId: null });

const naLeitura = listarEstudosParaEstagio(protocoloId, LEITURA_COMPLETA);
checar("so os incluidos passam para a fase 2", naLeitura.length, 2);
checar(
  "excluido na fase 1 nao aparece",
  naLeitura.some((e) => e.id === paraOFunil[2]!.id),
  false,
);
checar(
  "em duvida tambem nao passa",
  naLeitura.some((e) => e.id === paraOFunil[3]!.id),
  false,
);
checar("nenhum estudo duplicado", new Set(naLeitura.map((e) => e.id)).size, 2);

const contagemDaLeitura = contarPorDecisao(protocoloId, LEITURA_COMPLETA);
checar("contagem da fase 2 respeita o funil", contagemDaLeitura.total, 2);
checar("todos pendentes na fase 2", contagemDaLeitura.pendente, 2);

salvarDecisao({ estagio: LEITURA_COMPLETA, estudoId: naLeitura[0]!.id, decisao: "excluido", criterioId: null });
checar("decisao da fase 2 conta na fase 2", contarPorDecisao(protocoloId, LEITURA_COMPLETA).excluido, 1);
checar(
  "decisao da fase 2 nao altera a fase 1",
  contarPorDecisao(protocoloId, TRIAGEM_INICIAL).incluido,
  2,
);
checar(
  "fase 1 nao duplica com decisao nos dois estagios",
  listarEstudosParaEstagio(protocoloId, TRIAGEM_INICIAL).length,
  4,
);

removerDecisao(paraOFunil[0]!.id, TRIAGEM_INICIAL);
checar(
  "tirar da fase 1 remove da fase 2",
  listarEstudosParaEstagio(protocoloId, LEITURA_COMPLETA).length,
  1,
);

console.log("");
console.log("Criterios por tipo");
const deExclusao = listarCriteriosDeExclusao(protocoloId);
const deInclusao = listarCriteriosDeInclusao(protocoloId);

checar("exclusao traz so tipo exclusao", deExclusao.length, 2);
checar("inclusao traz so tipo inclusao", deInclusao.length, 1);
checar("inclusao usa prefixo IC", deInclusao[0]!.codigo, "IC1");
checar(
  "as listas nao se misturam",
  deExclusao.some((c) => deInclusao.some((i) => i.id === c.id)),
  false,
);
checar(
  "todo criterio de exclusao usa prefixo EC",
  deExclusao.every((c) => c.codigo.startsWith("EC")),
  true,
);

console.log(
  `\n${verificacoesQuePassaram} passaram, ${verificacoesQueFalharam} falharam`,
);
fecharBanco();
process.exitCode = verificacoesQueFalharam > 0 ? 1 : 0;
