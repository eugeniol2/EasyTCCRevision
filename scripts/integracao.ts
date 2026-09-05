import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { eq, sql as sqlBruto } from "drizzle-orm";

const URL_DE_TESTE = readFileSync(".env.local", "utf8").match(
  /DATABASE_URL_TESTE="([^"]+)"/,
)?.[1];

if (!URL_DE_TESTE) {
  console.error("DATABASE_URL_TESTE não encontrada em .env.local");
  process.exit(1);
}

process.env.DATABASE_URL = URL_DE_TESTE;

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
    `  FALHA ${descricao}
        esperado: ${esperadoSerializado}
        obtido:   ${obtidoSerializado}`,
  );
}

const { db, fecharBanco } = await import("../src/db/client");

await db.execute(
  sqlBruto`truncate table extracao, atendimento, estudo_busca, triagem,
    campo_extracao, estudo, busca, criterio, protocolo, usuario
    restart identity cascade`,
);
const { criterio, estudoBusca, protocolo } = await import("../src/db/schema");
const {
  contarPorDecisao,
  LEITURA_COMPLETA,
  listarCriteriosDeExclusao,
  listarCriteriosDeInclusao,
  listarEstudosParaEstagio,
  TRIAGEM_INICIAL,
} = await import("../src/lib/consultas");
const { encontrarBuscaIdentica, importarParaOProtocolo } =
  await import("../src/lib/importacao");
const { removerDecisao, removerTodasAsDecisoes, salvarDecisao } =
  await import("../src/lib/triagem");
const { descartarEstudo, descartarTudoDoProtocolo } =
  await import("../src/lib/estudos");
const { atualizarProtocolo, listarCriteriosEditaveis, salvarCriterios } =
  await import("../src/lib/protocolo");
const {
  adicionarCampo,
  criarCamposPadrao,
  listarCampos,
  listarEstudosParaExtracao,
  medirProgresso,
  removerCampo,
  salvarValorExtraido,
} = await import("../src/lib/extracao");
const {
  listarEstudosIncluidos,
  montarPrisma,
  montarTabelaDeTrabalhos,
  tabelaEmLatex,
  textoDaMetodologia,
} = await import("../src/lib/relatorio");
const {
  agruparAtendimentosPorEstudo,
  desmarcarAtendimento,
  marcarAtendimento,
} = await import("../src/lib/atendimento");
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
await db.insert(protocolo)
  .values({ id: protocoloId, titulo: "Protocolo de teste", anoInicio: 2020, anoFim: 2024 });

await db.insert(criterio)
  .values([
    { id: randomUUID(), protocoloId, tipo: "exclusao", codigo: "EC1", descricao: "Fora do escopo", ordem: 0 },
    { id: randomUUID(), protocoloId, tipo: "exclusao", codigo: "EC2", descricao: "Não é estudo primário", ordem: 1 },
  ]);

console.log("\nBanco de teste isolado");
const estudosNoInicio = await db.select().from(estudoBusca);
checar("começa vazio", estudosNoInicio.length, 0);

console.log("\nPrimeira importação (Scopus)");
const daScopus = await importarParaOProtocolo({
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
const daIeee = await importarParaOProtocolo({
  protocoloId,
  base: "IEEE Xplore",
  stringBusca: '("code review") AND ("systematic")',
  executadaEmSegundos: Math.floor(Date.now() / 1000),
  conteudo: ARTIGOS_DA_IEEE,
});
checar("só o inédito entra", daIeee.importados, 1);
checar("repetido é reconhecido pelo DOI", daIeee.jaExistiamNoProtocolo, 1);

const todosOsEstudos = await listarEstudosParaEstagio(protocoloId, TRIAGEM_INICIAL);
checar("total sem duplicata", todosOsEstudos.length, 4);

const vinculos = await db.select().from(estudoBusca);
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
const vazia = await importarParaOProtocolo({
  protocoloId,
  base: "SciELO",
  stringBusca: "nada",
  executadaEmSegundos: Math.floor(Date.now() / 1000),
  conteudo: "isto não é bibtex",
});
checar("nenhuma busca é gravada", vazia.buscaId, null);
checar("nenhum estudo é criado", vazia.importados, 0);

console.log("\nTriagem");
const criterios = await listarCriteriosDeExclusao(protocoloId);
checar("critérios de exclusão listados", criterios.length, 2);

await salvarDecisao({
  estagio: TRIAGEM_INICIAL,
  estudoId: todosOsEstudos[0]!.id,
  decisao: "incluido",
  criterioId: null,
});
await salvarDecisao({
  estagio: TRIAGEM_INICIAL,
  estudoId: todosOsEstudos[1]!.id,
  decisao: "excluido",
  criterioId: criterios[0]!.id,
});
await salvarDecisao({
  estagio: TRIAGEM_INICIAL,
  estudoId: todosOsEstudos[2]!.id,
  decisao: "duvida",
  criterioId: null,
});

const contagem = await contarPorDecisao(protocoloId, TRIAGEM_INICIAL);
checar("incluídos", contagem.incluido, 1);
checar("excluídos", contagem.excluido, 1);
checar("em dúvida", contagem.duvida, 1);
checar("pendentes", contagem.pendente, 1);
checar("total", contagem.total, 4);

await salvarDecisao({
  estagio: TRIAGEM_INICIAL,
  estudoId: todosOsEstudos[0]!.id,
  decisao: "excluido",
  criterioId: criterios[1]!.id,
});
const aposMudarDeIdeia = await contarPorDecisao(protocoloId, TRIAGEM_INICIAL);
checar("decisão substituída, não duplicada", aposMudarDeIdeia.total, 4);
checar("passou a contar como excluído", aposMudarDeIdeia.excluido, 2);
checar("não é mais incluído", aposMudarDeIdeia.incluido, 0);

await removerDecisao(todosOsEstudos[0]!.id, TRIAGEM_INICIAL);
const aposDesfazer = await contarPorDecisao(protocoloId, TRIAGEM_INICIAL);
checar("desfazer devolve para pendente", aposDesfazer.pendente, 2);

console.log("\nLista de incluídos");
await salvarDecisao({ estagio: TRIAGEM_INICIAL, estudoId: todosOsEstudos[0]!.id, decisao: "incluido", criterioId: null });
await salvarDecisao({ estagio: TRIAGEM_INICIAL, estudoId: todosOsEstudos[3]!.id, decisao: "incluido", criterioId: null });

const comDecisoes = await listarEstudosParaEstagio(protocoloId, TRIAGEM_INICIAL);
const listaDeIncluidos = comDecisoes.filter((e) => e.decisao === "incluido");
checar("dois incluídos na lista", listaDeIncluidos.length, 2);
checar(
  "retirar da lista devolve para pendente",
  await (async () => {
    await removerDecisao(todosOsEstudos[3]!.id, TRIAGEM_INICIAL);
    return (await listarEstudosParaEstagio(protocoloId, TRIAGEM_INICIAL)).filter(
      (e) => e.decisao === "incluido",
    ).length;
  })(),
  1,
);

console.log("\nZerar triagem");
await salvarDecisao({ estagio: TRIAGEM_INICIAL, estudoId: todosOsEstudos[1]!.id, decisao: "duvida", criterioId: null });
const antesDeZerar = await contarPorDecisao(protocoloId, TRIAGEM_INICIAL);
checar("ha decisoes antes de zerar", antesDeZerar.total - antesDeZerar.pendente, 3);

const outroProtocoloId = randomUUID();
await db.insert(protocolo)
  .values({ id: outroProtocoloId, titulo: "Outro protocolo", anoInicio: 2020, anoFim: 2024 });
await importarParaOProtocolo({
  protocoloId: outroProtocoloId,
  base: "ACM",
  stringBusca: "outra",
  executadaEmSegundos: Math.floor(Date.now() / 1000),
  conteudo: ARTIGOS_DA_SCOPUS,
});
const doOutroProtocolo = await listarEstudosParaEstagio(outroProtocoloId, TRIAGEM_INICIAL);
await salvarDecisao({ estagio: TRIAGEM_INICIAL, estudoId: doOutroProtocolo[0]!.id, decisao: "incluido", criterioId: null });

checar("apaga todas as decisoes do protocolo", await removerTodasAsDecisoes(protocoloId), 3);

const aposZerar = await contarPorDecisao(protocoloId, TRIAGEM_INICIAL);
checar("tudo volta a pendente", aposZerar.pendente, aposZerar.total);
checar("estudos permanecem", (await listarEstudosParaEstagio(protocoloId, TRIAGEM_INICIAL)).length, 4);
checar("protocolo vizinho nao e afetado", (await contarPorDecisao(outroProtocoloId, TRIAGEM_INICIAL)).incluido, 1);
checar("zerar de novo nao apaga nada", await removerTodasAsDecisoes(protocoloId), 0);

console.log("\nDescartar artigo");
await salvarDecisao({ estagio: TRIAGEM_INICIAL, estudoId: doOutroProtocolo[1]!.id, decisao: "duvida", criterioId: null });
const alvo = doOutroProtocolo[1]!;
const vinculosAntes = (await db.select().from(estudoBusca)).length;

checar("descarta um estudo", await descartarEstudo(alvo.id), 1);
checar(
  "estudo some da lista",
  (await listarEstudosParaEstagio(outroProtocoloId, TRIAGEM_INICIAL)).some((e) => e.id === alvo.id),
  false,
);
checar(
  "decisao vai junto (cascade)",
  (await db.select().from(triagem)).some((t) => t.estudoId === alvo.id),
  false,
);
checar(
  "vinculo estudo-busca vai junto (cascade)",
  (await db.select().from(estudoBusca)).length < vinculosAntes,
  true,
);
checar("descartar de novo nao apaga nada", await descartarEstudo(alvo.id), 0);
checar("busca permanece", (await db.select().from(busca)).length > 0, true);

console.log("\nDescartar tudo do protocolo");
const estudosDoOutro = (await listarEstudosParaEstagio(outroProtocoloId, TRIAGEM_INICIAL)).length;
const buscasDoOutro = (await db.select().from(busca))
  .filter((b) => b.protocoloId === outroProtocoloId).length;

const descarte = await descartarTudoDoProtocolo(outroProtocoloId);
checar("remove os estudos", descarte.estudosRemovidos, estudosDoOutro);
checar("remove as buscas", descarte.buscasRemovidas, buscasDoOutro);
checar("protocolo fica vazio", (await contarPorDecisao(outroProtocoloId, TRIAGEM_INICIAL)).total, 0);
checar(
  "criterios do protocolo permanecem",
  (await listarCriteriosDeExclusao(protocoloId)).length,
  2,
);
checar(
  "protocolo vizinho mantem seus estudos",
  (await listarEstudosParaEstagio(protocoloId, TRIAGEM_INICIAL)).length,
  4,
);
checar(
  "buscas do vizinho permanecem",
  (await db.select().from(busca)).filter((b) => b.protocoloId === protocoloId).length > 0,
  true,
);

console.log("");
console.log("Origem dos estudos");
const comOrigem = await listarEstudosParaEstagio(protocoloId, TRIAGEM_INICIAL);
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
await atualizarProtocolo(protocoloId, {
  titulo: "Revisao renomeada",
  questaoPesquisa: "Qual a pergunta?",
  anoInicio: 2019,
  anoFim: 2025,
});
const protocoloSalvo = (await db.select().from(protocolo))
  .find((p) => p.id === protocoloId)!;
checar("titulo atualizado", protocoloSalvo.titulo, "Revisao renomeada");
checar("pergunta gravada", protocoloSalvo.questaoPesquisa, "Qual a pergunta?");
checar("recorte gravado", [protocoloSalvo.anoInicio, protocoloSalvo.anoFim], [2019, 2025]);

const criteriosOriginais = await listarCriteriosEditaveis(protocoloId);
checar("dois criterios existentes", criteriosOriginais.length, 2);

const estudosVivos = await listarEstudosParaEstagio(protocoloId, TRIAGEM_INICIAL);
await salvarDecisao({
  estagio: TRIAGEM_INICIAL,
  estudoId: estudosVivos[0]!.id,
  decisao: "excluido",
  criterioId: criteriosOriginais[0]!.id,
});

const criteriosAntes = await listarCriteriosEditaveis(protocoloId);
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

const resumo = await salvarCriterios(protocoloId, [
  { id: criteriosAntes[0]!.id, tipo: "exclusao", descricao: "Descricao editada" },
  { id: null, tipo: "exclusao", descricao: "Criterio novo" },
  { id: null, tipo: "inclusao", descricao: "Estudo primario" },
]);
checar("um removido", resumo.removidos, 1);
checar("um atualizado", resumo.atualizados, 1);
checar("dois criados", resumo.criados, 2);

const criteriosDepois = await listarCriteriosEditaveis(protocoloId);
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
  (await salvarCriterios(protocoloId, [
    ...criteriosDepois.map((c) => ({ id: c.id, tipo: c.tipo, descricao: c.descricao })),
    { id: null, tipo: "exclusao" as const, descricao: "   " },
  ])).criados,
  0,
);

console.log("");
console.log("Funil entre as fases");
const paraOFunil = await listarEstudosParaEstagio(protocoloId, TRIAGEM_INICIAL);
await removerTodasAsDecisoes(protocoloId);

await salvarDecisao({ estagio: TRIAGEM_INICIAL, estudoId: paraOFunil[0]!.id, decisao: "incluido", criterioId: null });
await salvarDecisao({ estagio: TRIAGEM_INICIAL, estudoId: paraOFunil[1]!.id, decisao: "incluido", criterioId: null });
await salvarDecisao({ estagio: TRIAGEM_INICIAL, estudoId: paraOFunil[2]!.id, decisao: "excluido", criterioId: null });
await salvarDecisao({ estagio: TRIAGEM_INICIAL, estudoId: paraOFunil[3]!.id, decisao: "duvida", criterioId: null });

const naLeitura = await listarEstudosParaEstagio(protocoloId, LEITURA_COMPLETA);
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

const contagemDaLeitura = await contarPorDecisao(protocoloId, LEITURA_COMPLETA);
checar("contagem da fase 2 respeita o funil", contagemDaLeitura.total, 2);
checar("todos pendentes na fase 2", contagemDaLeitura.pendente, 2);

await salvarDecisao({ estagio: LEITURA_COMPLETA, estudoId: naLeitura[0]!.id, decisao: "excluido", criterioId: null });
checar("decisao da fase 2 conta na fase 2", (await contarPorDecisao(protocoloId, LEITURA_COMPLETA)).excluido, 1);
checar(
  "decisao da fase 2 nao altera a fase 1",
  (await contarPorDecisao(protocoloId, TRIAGEM_INICIAL)).incluido,
  2,
);
checar(
  "fase 1 nao duplica com decisao nos dois estagios",
  (await listarEstudosParaEstagio(protocoloId, TRIAGEM_INICIAL)).length,
  4,
);

await removerDecisao(paraOFunil[0]!.id, TRIAGEM_INICIAL);
checar(
  "tirar da fase 1 remove da fase 2",
  (await listarEstudosParaEstagio(protocoloId, LEITURA_COMPLETA)).length,
  1,
);

console.log("");
console.log("Criterios por tipo");
const deExclusao = await listarCriteriosDeExclusao(protocoloId);
const deInclusao = await listarCriteriosDeInclusao(protocoloId);

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

console.log("");
console.log("Extracao");
const antesDaExtracao = await listarEstudosParaExtracao(protocoloId);
checar("nada extrai sem inclusao na fase 2", antesDaExtracao.length, 0);

const naFase2 = await listarEstudosParaEstagio(protocoloId, LEITURA_COMPLETA);
await salvarDecisao({ estagio: LEITURA_COMPLETA, estudoId: naFase2[0]!.id, decisao: "incluido", criterioId: null });

const paraExtrair = await listarEstudosParaExtracao(protocoloId);
checar("so o incluido na fase 2 entra", paraExtrair.length, 1);
checar("autor ja vem preenchido", paraExtrair[0]!.autores.length > 0, true);
checar("ano ja vem preenchido", typeof paraExtrair[0]!.ano, "number");

checar("cria as colunas padrao", await criarCamposPadrao(protocoloId), 4);
checar("nao recria se ja existem", await criarCamposPadrao(protocoloId), 0);

const camposCriados = await listarCampos(protocoloId);
checar("nomes das colunas", camposCriados.map((c) => c.nome), [
  "Objetivo",
  "Metodologia",
  "Resultados",
  "Qualidade metodológica",
]);
checar(
  "qualidade vem com escala de opcoes",
  camposCriados[3]!.opcoes,
  ["Alta", "Média", "Baixa"],
);

const alvoDaExtracao = paraExtrair[0]!;
await salvarValorExtraido(alvoDaExtracao.id, camposCriados[0]!.id, "Detectar anomalias");
checar(
  "valor gravado aparece na leitura",
  (await listarEstudosParaExtracao(protocoloId))[0]!.valores[camposCriados[0]!.id],
  "Detectar anomalias",
);
checar("progresso conta preenchidos", (await listarEstudosParaExtracao(protocoloId))[0]!.camposPreenchidos, 1);

await salvarValorExtraido(alvoDaExtracao.id, camposCriados[0]!.id, "Objetivo revisado");
checar(
  "regravar substitui, nao duplica",
  (await listarEstudosParaExtracao(protocoloId))[0]!.camposPreenchidos,
  1,
);
checar(
  "valor atualizado",
  (await listarEstudosParaExtracao(protocoloId))[0]!.valores[camposCriados[0]!.id],
  "Objetivo revisado",
);

await salvarValorExtraido(alvoDaExtracao.id, camposCriados[0]!.id, "   ");
checar(
  "valor em branco apaga a celula",
  (await listarEstudosParaExtracao(protocoloId))[0]!.camposPreenchidos,
  0,
);

for (const campo of camposCriados) {
  await salvarValorExtraido(alvoDaExtracao.id, campo.id, `conteudo de ${campo.nome}`);
}
const progresso = await medirProgresso(protocoloId);
checar("estudo completo e contado", progresso.completos, 1);
checar("total de colunas no progresso", progresso.campos, 4);

const novaColuna = await adicionarCampo(protocoloId, "Risco de vies", "opcoes", ["alto", "baixo"]);
checar("coluna adicionada", (await listarCampos(protocoloId)).length, 5);
checar(
  "estudo deixa de estar completo com coluna nova",
  (await medirProgresso(protocoloId)).completos,
  0,
);

await salvarValorExtraido(alvoDaExtracao.id, novaColuna, "baixo");
checar("completo de novo apos preencher", (await medirProgresso(protocoloId)).completos, 1);

checar("remover coluna", await removerCampo(novaColuna), 1);
checar("colunas restantes", (await listarCampos(protocoloId)).length, 4);
checar(
  "valores da coluna removida somem junto",
  (await listarEstudosParaExtracao(protocoloId))[0]!.camposPreenchidos,
  4,
);

console.log("");
console.log("Sintese e exportacao");
const prisma = await montarPrisma(protocoloId);

checar("triados batem com a fase 1", prisma.triados, (await contarPorDecisao(protocoloId, TRIAGEM_INICIAL)).total);
checar("fase 2 bate com o funil", prisma.avaliadosPorTextoCompleto, (await contarPorDecisao(protocoloId, LEITURA_COMPLETA)).total);
checar("incluidos batem com a extracao", prisma.incluidos, (await listarEstudosParaExtracao(protocoloId)).length);
checar(
  "identificados nunca menor que triados",
  prisma.identificados >= prisma.triados,
  true,
);
checar(
  "soma do funil fecha na fase 1",
  prisma.excluidosNaTriagem + prisma.emDuvidaNaTriagem + prisma.pendentesNaTriagem + prisma.avaliadosPorTextoCompleto,
  prisma.triados,
);
checar("buscas listadas", prisma.buscas.length > 0, true);

const tabela = await montarTabelaDeTrabalhos(protocoloId);
checar("colunas da tabela", tabela.colunas, [
  "Objetivo",
  "Metodologia",
  "Resultados",
  "Qualidade metodológica",
]);
checar(
  "uma linha por estudo incluido",
  tabela.linhas.length,
  (await listarEstudosParaExtracao(protocoloId)).length,
);
checar(
  "cada linha tem uma celula por coluna",
  tabela.linhas.every((l) => l.celulas.length === tabela.colunas.length),
  true,
);
checar(
  "autor sem o ano embutido",
  tabela.linhas.every((l) => !l.autor.includes("(")),
  true,
);
checar("ano em coluna propria", /^\d{4}$|^s\.d\.$/.test(tabela.linhas[0]!.ano), true);
checar(
  "latex declara duas colunas simples antes das de texto",
  (await tabelaEmLatex(protocoloId, "T")).includes(String.raw`\begin{tabular}{ll`),
  true,
);
checar(
  "latex tem cabecalho de autor e ano",
  (await tabelaEmLatex(protocoloId, "T")).includes(String.raw`\textbf{Autor} & \textbf{Ano}`),
  true,
);

const incluidos = await listarEstudosIncluidos(protocoloId);
checar("lista de incluidos bate com o prisma", incluidos.length, prisma.incluidos);
checar("estudo incluido tem titulo", incluidos[0]!.titulo.length > 0, true);
checar("estudo incluido tem link", incluidos[0]!.url !== null, true);
checar("autores vem formatados", incluidos[0]!.autores.length > 0, true);

const latex = await tabelaEmLatex(protocoloId, "Revisao & Teste");
checar("latex abre o ambiente table", latex.includes(String.raw`\begin{table}`), true);
checar("e comercial escapado no caption", latex.includes(String.raw`Revisao \& Teste`), true);

const metodologia = await textoDaMetodologia(protocoloId);
checar("metodologia cita os incluidos", metodologia.includes(`${prisma.incluidos} estudo(s) compuseram`), true);
checar("metodologia cita as bases", metodologia.includes("base(s) de dados"), true);

console.log("");
console.log("Checklist de inclusao");
const criteriosParaChecar = await listarCriteriosDeInclusao(protocoloId);
checar("ha criterio de inclusao", criteriosParaChecar.length > 0, true);

const paraChecar = await listarEstudosParaEstagio(protocoloId, TRIAGEM_INICIAL);
const estudoChecado = paraChecar[0]!;

checar("comeca sem nada marcado", estudoChecado.criteriosAtendidos.length, 0);

await marcarAtendimento(estudoChecado.id, criteriosParaChecar[0]!.id);
checar(
  "marcacao e persistida",
  (await agruparAtendimentosPorEstudo(protocoloId)).get(estudoChecado.id),
  [criteriosParaChecar[0]!.id],
);
checar(
  "marcacao aparece na listagem",
  (await listarEstudosParaEstagio(protocoloId, TRIAGEM_INICIAL)).find(
    (e) => e.id === estudoChecado.id,
  )!.criteriosAtendidos.length,
  1,
);

await marcarAtendimento(estudoChecado.id, criteriosParaChecar[0]!.id);
checar(
  "marcar duas vezes nao duplica",
  (await agruparAtendimentosPorEstudo(protocoloId)).get(estudoChecado.id)!.length,
  1,
);

checar(
  "outro estudo nao e afetado",
  (await agruparAtendimentosPorEstudo(protocoloId)).get(paraChecar[1]!.id) ?? [],
  [],
);

await desmarcarAtendimento(estudoChecado.id, criteriosParaChecar[0]!.id);
checar(
  "desmarcar remove",
  (await agruparAtendimentosPorEstudo(protocoloId)).get(estudoChecado.id) ?? [],
  [],
);

console.log("");
console.log("Funil da fase 1 ate a extracao");
await removerTodasAsDecisoes(protocoloId);
const noFunil = await listarEstudosParaEstagio(protocoloId, TRIAGEM_INICIAL);

for (const e of noFunil.slice(0, 3)) {
  await salvarDecisao({ estagio: TRIAGEM_INICIAL, estudoId: e.id, decisao: "incluido", criterioId: null });
}
for (const e of await listarEstudosParaEstagio(protocoloId, LEITURA_COMPLETA)) {
  await salvarDecisao({ estagio: LEITURA_COMPLETA, estudoId: e.id, decisao: "incluido", criterioId: null });
}
checar("tres chegam a extracao", (await listarEstudosParaExtracao(protocoloId)).length, 3);

await salvarDecisao({
  estagio: TRIAGEM_INICIAL,
  estudoId: noFunil[0]!.id,
  decisao: "excluido",
  criterioId: null,
});
checar("excluir na fase 1 tira da extracao", (await listarEstudosParaExtracao(protocoloId)).length, 2);
checar(
  "e apaga a decisao de leitura, sem deixar orfao",
  (await db.select().from(triagem))
    .filter((t) => t.estudoId === noFunil[0]!.id && t.estagio === "texto_completo").length,
  0,
);

await salvarDecisao({
  estagio: TRIAGEM_INICIAL,
  estudoId: noFunil[0]!.id,
  decisao: "incluido",
  criterioId: null,
});
checar(
  "reincluir na fase 1 devolve como pendente na fase 2",
  (await listarEstudosParaEstagio(protocoloId, LEITURA_COMPLETA)).find(
    (e) => e.id === noFunil[0]!.id,
  )!.decisao,
  null,
);
checar("e nao volta direto para a extracao", (await listarEstudosParaExtracao(protocoloId)).length, 2);

await removerDecisao(noFunil[1]!.id, TRIAGEM_INICIAL);
checar("limpar decisao da fase 1 tambem limpa a fase 2", (await listarEstudosParaExtracao(protocoloId)).length, 1);

console.log("");
console.log("Busca repetida");
const protocoloDaBusca = randomUUID();
await db.insert(protocolo)
  .values({ id: protocoloDaBusca, titulo: "Busca repetida", anoInicio: 2020, anoFim: 2026 });

const artigo = (n: number) =>
  String.raw`@article{r${n}, author={Silva, J.}, title={Artigo ${n}}, year={2024}, doi={10.1109/tse.2024.${n}}}`;
const dadosDaBusca = {
  protocoloId: protocoloDaBusca,
  base: "Google Scholar",
  stringBusca: "mesma string",
  executadaEmSegundos: 1000,
};

checar(
  "nao ha busca identica antes da primeira",
  await encontrarBuscaIdentica(protocoloDaBusca, "Google Scholar", "mesma string", 1000),
  null,
);

await importarParaOProtocolo({ ...dadosDaBusca, conteudo: artigo(1) });
const identica = (await encontrarBuscaIdentica(protocoloDaBusca, "Google Scholar", "mesma string", 1000))!;
checar("busca identica e detectada", identica !== null, true);
checar("ja tem um registro vinculado", identica.registrosJaVinculados, 1);

await importarParaOProtocolo({ ...dadosDaBusca, conteudo: artigo(2), anexarABusca: identica.id });
const buscasDoProtocolo = (await db.select().from(busca))
  .filter((b) => b.protocoloId === protocoloDaBusca);
checar("anexar nao cria busca nova", buscasDoProtocolo.length, 1);
checar("total de resultados acompanha o anexo", buscasDoProtocolo[0]!.totalResultados, 2);
checar(
  "os dois estudos existem",
  (await listarEstudosParaEstagio(protocoloDaBusca, TRIAGEM_INICIAL)).length,
  2,
);

await importarParaOProtocolo({ ...dadosDaBusca, conteudo: artigo(2), anexarABusca: identica.id });
checar(
  "reanexar o mesmo artigo nao infla o total",
  (await db.select().from(busca)).find((b) => b.id === identica.id)!.totalResultados,
  2,
);

await importarParaOProtocolo({ ...dadosDaBusca, conteudo: artigo(3), executadaEmSegundos: 2000 });
checar(
  "data diferente cria busca nova",
  (await db.select().from(busca)).filter((b) => b.protocoloId === protocoloDaBusca).length,
  2,
);

console.log("\nIsolamento entre contas");

const { campoExtracao, usuario } = await import("../src/db/schema");
const { listarProtocolos } = await import("../src/lib/consultas");
const {
  campoEDoProtocolo,
  criterioEDoProtocolo,
  estudoEDoProtocolo,
  protocoloEDoUsuario,
} = await import("../src/lib/pertencimento");

const ana = randomUUID();
const bruno = randomUUID();
await db.insert(usuario).values([
  { id: ana, googleSub: "sub-ana", email: "ana@ufrpe.br", nome: "Ana" },
  { id: bruno, googleSub: "sub-bruno", email: "bruno@ufrpe.br", nome: "Bruno" },
]);

const revisaoDaAna = randomUUID();
const revisaoDoBruno = randomUUID();
const revisaoSemDono = randomUUID();
await db.insert(protocolo).values([
  { id: revisaoDaAna, usuarioId: ana, titulo: "Revisão da Ana" },
  { id: revisaoDoBruno, usuarioId: bruno, titulo: "Revisão do Bruno" },
  { id: revisaoSemDono, titulo: "Revisão órfã" },
]);

const estudoDaAna = randomUUID();
const criterioDaAna = randomUUID();
const campoDaAna = randomUUID();
await db.insert(estudo).values({
  id: estudoDaAna,
  protocoloId: revisaoDaAna,
  titulo: "Artigo da Ana",
  tituloNorm: "artigo da ana",
});
await db.insert(criterio).values({
  id: criterioDaAna,
  protocoloId: revisaoDaAna,
  tipo: "exclusao",
  codigo: "EC1",
  descricao: "Fora do escopo",
  ordem: 0,
});
await db.insert(campoExtracao).values({
  id: campoDaAna,
  protocoloId: revisaoDaAna,
  nome: "Objetivo",
  tipo: "texto",
  ordem: 0,
});

checar("dono acessa o proprio protocolo", await protocoloEDoUsuario(revisaoDaAna, ana), true);
checar("estranho nao acessa o protocolo alheio", await protocoloEDoUsuario(revisaoDaAna, bruno), false);
checar("protocolo sem dono nao e de ninguem", await protocoloEDoUsuario(revisaoSemDono, ana), false);

checar(
  "a listagem mostra so o protocolo da conta",
  (await listarProtocolos(ana)).map((p) => p.titulo),
  ["Revisão da Ana"],
);
checar(
  "a listagem do outro nao vaza nem o orfao",
  (await listarProtocolos(bruno)).map((p) => p.titulo),
  ["Revisão do Bruno"],
);

checar("dono alcanca o proprio estudo", await estudoEDoProtocolo(revisaoDaAna, ana, estudoDaAna), true);
checar(
  "estranho nao alcanca o estudo pelo protocolo certo",
  await estudoEDoProtocolo(revisaoDaAna, bruno, estudoDaAna),
  false,
);
checar(
  "estudo de outra revisao nao passa pelo protocolo proprio",
  await estudoEDoProtocolo(revisaoDoBruno, bruno, estudoDaAna),
  false,
);

checar("dono alcanca o proprio campo", await campoEDoProtocolo(revisaoDaAna, ana, campoDaAna), true);
checar("estranho nao alcanca o campo alheio", await campoEDoProtocolo(revisaoDaAna, bruno, campoDaAna), false);
checar("dono alcanca o proprio criterio", await criterioEDoProtocolo(revisaoDaAna, ana, criterioDaAna), true);
checar(
  "estranho nao alcanca o criterio alheio",
  await criterioEDoProtocolo(revisaoDaAna, bruno, criterioDaAna),
  false,
);

await salvarCriterios(revisaoDoBruno, [
  { id: criterioDaAna, tipo: "exclusao", descricao: "Sequestrado" },
]);
checar(
  "criterio de outra revisao nao e reescrito",
  (await db.select().from(criterio).where(eq(criterio.id, criterioDaAna)))[0]!.descricao,
  "Fora do escopo",
);

console.log("\nCriação de revisão");

const { criarProtocolo } = await import("../src/lib/protocolo");

const novaDaAna = await criarProtocolo(ana, {
  titulo: "Revisão nova da Ana",
  questaoPesquisa: "O que já se sabe sobre isto?",
  anoInicio: 2019,
  anoFim: 2024,
});

checar("a revisão nasce com dono", await protocoloEDoUsuario(novaDaAna, ana), true);
checar("e nao pertence a outra conta", await protocoloEDoUsuario(novaDaAna, bruno), false);
checar(
  "aparece na listagem de quem criou",
  (await listarProtocolos(ana)).map((p) => p.titulo).includes("Revisão nova da Ana"),
  true,
);
checar(
  "nao aparece na listagem alheia",
  (await listarProtocolos(bruno)).map((p) => p.titulo).includes("Revisão nova da Ana"),
  false,
);

const criteriosIniciais = await listarCriteriosEditaveis(novaDaAna);
checar("vem com criterios de inclusao", (await listarCriteriosDeInclusao(novaDaAna)).length, 2);
checar("vem com criterios de exclusao", (await listarCriteriosDeExclusao(novaDaAna)).length, 5);
checar(
  "os codigos nao repetem",
  new Set(criteriosIniciais.map((c) => c.codigo)).size,
  criteriosIniciais.length,
);
checar(
  "a ordem segue inclusao antes de exclusao",
  criteriosIniciais.map((c) => c.codigo),
  ["IC1", "IC2", "EC1", "EC2", "EC3", "EC4", "EC5"],
);

console.log(
  `\n${verificacoesQuePassaram} passaram, ${verificacoesQueFalharam} falharam`,
);
fecharBanco();
process.exitCode = verificacoesQueFalharam > 0 ? 1 : 0;
