"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAcao } from "@/app/componentes/Carregamento";
import DialogoDeConfirmacao from "@/app/componentes/DialogoDeConfirmacao";
import { formatarAutores } from "@/lib/bibtex/autores";
import { formatarMes } from "@/lib/publicacao";
import type {
  CriterioDoProtocolo,
  Decisao,
  EstagioDeTriagem,
  EstudoParaTriagem,
} from "@/lib/consultas";
import {
  alternarAtendimento,
  descartarArtigo,
  desfazerDecisao,
  registrarDecisao,
} from "./acoes";

const ROTULO_DA_DECISAO: Record<Decisao, string> = {
  incluido: "Incluído",
  excluido: "Excluído",
  duvida: "Em dúvida",
  pendente: "Pendente",
};

const CLASSE_DO_SELO: Record<Decisao, string> = {
  incluido: "selo-incluido",
  excluido: "selo-excluido",
  duvida: "selo-duvida",
  pendente: "selo-pendente",
};

type Filtro = "decididos" | Decisao;

const FILTROS: { chave: Filtro; rotulo: string }[] = [
  { chave: "decididos", rotulo: "Decididos" },
  { chave: "incluido", rotulo: "Incluídos" },
  { chave: "duvida", rotulo: "Em dúvida" },
  { chave: "excluido", rotulo: "Excluídos" },
  { chave: "pendente", rotulo: "Pendentes" },
];

interface DecisaoLocal {
  decisao: Decisao;
  criterioId: string | null;
}

interface Props {
  protocoloId: string;
  estagio: EstagioDeTriagem;
  estudos: EstudoParaTriagem[];
  criterios: CriterioDoProtocolo[];
  criteriosDeInclusao: CriterioDoProtocolo[];
}

function descreverEstudo(estudo: EstudoParaTriagem): string {
  const partes = [
    formatarAutores(estudo.autores),
    estudo.ano ? String(estudo.ano) : null,
    estudo.veiculo,
  ];
  return partes.filter(Boolean).join(" · ");
}

function Origens({ bases }: { bases: string[] }) {
  if (bases.length === 0) return null;

  return (
    <>
      {bases.map((base) => (
        <span key={base} className="origem" title="Base em que este estudo foi encontrado">
          {base}
        </span>
      ))}
    </>
  );
}

function Detalhe({
  rotulo,
  valor,
}: {
  rotulo: string;
  valor: string | number | null | undefined;
}) {
  if (valor === null || valor === undefined || valor === "") return null;

  return (
    <>
      <dt>{rotulo}</dt>
      <dd>{valor}</dd>
    </>
  );
}

function primeiroPendente(estudos: EstudoParaTriagem[]): number {
  const indice = estudos.findIndex((estudo) => estudo.decisao === null);
  return indice === -1 ? 0 : indice;
}

export default function PainelDeTriagem({
  protocoloId,
  estagio,
  estudos,
  criterios,
  criteriosDeInclusao,
}: Props) {
  const [decisoes, setDecisoes] = useState<Map<string, DecisaoLocal>>(
    () =>
      new Map(
        estudos
          .filter((estudo) => estudo.decisao !== null)
          .map((estudo) => [
            estudo.id,
            { decisao: estudo.decisao!, criterioId: estudo.criterioId },
          ]),
      ),
  );
  const [indiceAtual, setIndiceAtual] = useState(() => primeiroPendente(estudos));
  const [filtro, setFiltro] = useState<Filtro>("decididos");
  const [remocaoPendente, setRemocaoPendente] = useState<string | null>(null);
  const [descartePendente, setDescartePendente] = useState<string | null>(null);
  const [atendidos, setAtendidos] = useState<Map<string, Set<string>>>(
    () =>
      new Map(
        estudos.map((item) => [item.id, new Set(item.criteriosAtendidos)]),
      ),
  );

  // A tela muda na hora e a gravação corre atrás. Essas ações não desabilitam
  // nada — na triagem se decide um estudo atrás do outro, e travar o botão a
  // cada clique atrapalharia mais do que ajuda. Elas só se anunciam ao
  // indicador, para quem quiser saber que ainda há coisa sendo salva.
  const [, gravarEmSegundoPlano] = useAcao();

  const alternarCriterio = useCallback(
    (estudoId: string, criterioId: string, marcado: boolean) => {
      setAtendidos((anteriores) => {
        const atualizados = new Map(anteriores);
        const doEstudo = new Set(atualizados.get(estudoId) ?? []);
        if (marcado) doEstudo.add(criterioId);
        else doEstudo.delete(criterioId);
        atualizados.set(estudoId, doEstudo);
        return atualizados;
      });
      gravarEmSegundoPlano(async () => {
        await alternarAtendimento(protocoloId, estudoId, criterioId, marcado);
      });
    },
    [protocoloId, gravarEmSegundoPlano],
  );

  const estudoAtual = estudos[indiceAtual];

  const codigoDoCriterio = useMemo(
    () => new Map(criterios.map((criterio) => [criterio.id, criterio.codigo])),
    [criterios],
  );

  const decisaoDe = useCallback(
    (estudoId: string): Decisao => decisoes.get(estudoId)?.decisao ?? "pendente",
    [decisoes],
  );

  const contagem = useMemo(() => {
    const totais: Record<Filtro, number> = {
      decididos: 0,
      incluido: 0,
      excluido: 0,
      duvida: 0,
      pendente: 0,
    };
    for (const estudo of estudos) {
      const decisao = decisaoDe(estudo.id);
      totais[decisao]++;
      if (decisao !== "pendente") totais.decididos++;
    }
    return totais;
  }, [estudos, decisaoDe]);

  const ordemDaDecisao = useMemo(() => {
    const ordem = new Map<string, number>();
    let posicao = 0;
    for (const estudoId of decisoes.keys()) ordem.set(estudoId, posicao++);
    return ordem;
  }, [decisoes]);

  const estudosDoFiltro = useCallback(
    (qual: Filtro) => {
      const doFiltro = estudos.filter((estudo) =>
        qual === "decididos"
          ? decisaoDe(estudo.id) !== "pendente"
          : decisaoDe(estudo.id) === qual,
      );

      if (qual === "pendente") return doFiltro;

      return [...doFiltro].sort(
        (um, outro) =>
          (ordemDaDecisao.get(outro.id) ?? 0) - (ordemDaDecisao.get(um.id) ?? 0),
      );
    },
    [estudos, decisaoDe, ordemDaDecisao],
  );

  const estudosFiltrados = useMemo(
    () => estudosDoFiltro(filtro),
    [estudosDoFiltro, filtro],
  );

  const selecionarFiltro = useCallback(
    (qual: Filtro) => {
      setFiltro(qual);

      const primeiro = estudosDoFiltro(qual)[0];
      if (!primeiro) return;

      setIndiceAtual(estudos.findIndex((estudo) => estudo.id === primeiro.id));
    },
    [estudosDoFiltro, estudos],
  );

  const irParaProximoPendente = useCallback(
    (aPartirDe: number) => {
      const proximo = estudos.findIndex(
        (estudo, indice) => indice > aPartirDe && !decisoes.has(estudo.id),
      );
      setIndiceAtual(
        proximo === -1 ? Math.min(aPartirDe + 1, estudos.length - 1) : proximo,
      );
    },
    [estudos, decisoes],
  );

  const decidir = useCallback(
    (decisao: Decisao, criterioId: string | null) => {
      if (!estudoAtual) return;

      setDecisoes((anteriores) => {
        const atualizadas = new Map(anteriores);
        atualizadas.delete(estudoAtual.id);
        return atualizadas.set(estudoAtual.id, { decisao, criterioId });
      });
      gravarEmSegundoPlano(async () => {
        await registrarDecisao({
          protocoloId,
          estudoId: estudoAtual.id,
          estagio,
          decisao,
          criterioId,
        });
      });
      irParaProximoPendente(indiceAtual);
    },
    [
      estudoAtual,
      protocoloId,
      estagio,
      indiceAtual,
      irParaProximoPendente,
      gravarEmSegundoPlano,
    ],
  );

  const pedirRemocao = useCallback(
    (estudoId: string) => {
      if (decisoes.has(estudoId)) setRemocaoPendente(estudoId);
    },
    [decisoes],
  );

  const confirmarRemocao = useCallback(async () => {
    const estudoId = remocaoPendente;
    if (estudoId === null) return;

    setDecisoes((anteriores) => {
      const atualizadas = new Map(anteriores);
      atualizadas.delete(estudoId);
      return atualizadas;
    });
    await desfazerDecisao(protocoloId, estudoId, estagio);
    setRemocaoPendente(null);
  }, [remocaoPendente, protocoloId, estagio]);

  const desfazerAtual = useCallback(() => {
    if (estudoAtual) pedirRemocao(estudoAtual.id);
  }, [estudoAtual, pedirRemocao]);

  useEffect(() => {
    setIndiceAtual((indice) => Math.min(indice, Math.max(0, estudos.length - 1)));
  }, [estudos.length]);

  useEffect(() => {
    if (decisoes.size === 0) setIndiceAtual(0);
  }, [decisoes.size]);

  const confirmarDescarte = useCallback(async () => {
    const estudoId = descartePendente;
    if (estudoId === null) return;

    await descartarArtigo(protocoloId, estudoId);
    setDescartePendente(null);
  }, [descartePendente, protocoloId]);

  const irParaPendente = useCallback(() => {
    const aFrente = estudos.findIndex(
      (estudo, indice) => indice > indiceAtual && !decisoes.has(estudo.id),
    );
    const escolhido =
      aFrente === -1
        ? estudos.findIndex((estudo) => !decisoes.has(estudo.id))
        : aFrente;
    if (escolhido !== -1) setIndiceAtual(escolhido);
  }, [estudos, indiceAtual, decisoes]);

  const irPara = useCallback(
    (estudoId: string) => {
      setIndiceAtual(estudos.findIndex((estudo) => estudo.id === estudoId));
    },
    [estudos],
  );

  if (estudos.length === 0) {
    return (
      <div className="cartao vazio">
        <p>Nenhum estudo importado ainda.</p>
        <a className="botao" href={`/protocolos/${protocoloId}/importar`}>
          Importar arquivo .bib
        </a>
      </div>
    );
  }

  const percentual = Math.round(
    ((estudos.length - contagem.pendente) / estudos.length) * 100,
  );

  return (
    <>
      <nav className="filtros">
        {FILTROS.map(({ chave, rotulo }) => (
          <button
            type="button"
            key={chave}
            className={`filtro${filtro === chave ? " filtro-ativo" : ""}`}
            disabled={contagem[chave] === 0}
            onClick={() => selecionarFiltro(chave)}
          >
            {rotulo} <strong>{contagem[chave]}</strong>
          </button>
        ))}
      </nav>

      <section className="cartao lista-grupo">
        {estudosFiltrados.length === 0 ? (
          <p className="subtitulo" style={{ margin: 0 }}>
            {filtro === "decididos"
              ? "Nenhuma decisão ainda — comece pelo artigo abaixo."
              : "Nenhum estudo neste grupo."}
          </p>
        ) : (
          <div className="lista-rolagem">
            <table className="tabela">
              <tbody>
                {estudosFiltrados.map((estudo) => {
                  const decisao = decisaoDe(estudo.id);
                  const criterioId = decisoes.get(estudo.id)?.criterioId;
                  return (
                    <tr
                      key={estudo.id}
                      className={`linha-estudo${
                        estudo.id === estudoAtual?.id ? " linha-atual" : ""
                      }`}
                    >
                      <td className="celula-selo">
                        <span className={`selo ${CLASSE_DO_SELO[decisao]}`}>
                          {ROTULO_DA_DECISAO[decisao]}
                          {criterioId ? ` · ${codigoDoCriterio.get(criterioId)}` : ""}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="link-estudo"
                          onClick={() => irPara(estudo.id)}
                        >
                          {estudo.titulo}
                        </button>
                        <div className="subtitulo">
                          {descreverEstudo(estudo)}
                          <Origens bases={estudo.bases} />
                        </div>
                      </td>
                      <td className="celula-acao">
                        {decisao !== "pendente" && (
                          <button
                            type="button"
                            className="botao-retirar"
                            title="Voltar para pendente"
                            onClick={() => pedirRemocao(estudo.id)}
                          >
                            ↺
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="barra-progresso">
        <div style={{ width: `${percentual}%` }} />
      </div>

      <div className="navegacao">
        <button
          type="button"
          className="botao"
          disabled={indiceAtual === 0}
          onClick={() => setIndiceAtual((indice) => Math.max(0, indice - 1))}
        >
          ← Anterior
        </button>
        <div className="posicao">
          <span>
            Estudo <strong>{indiceAtual + 1}</strong> de{" "}
            <strong>{estudos.length}</strong>
          </span>
          {contagem.pendente > 0 && (
            <button type="button" className="link-pendente" onClick={irParaPendente}>
              ir para o próximo pendente
            </button>
          )}
        </div>
        <button
          type="button"
          className="botao"
          disabled={indiceAtual === estudos.length - 1}
          onClick={() =>
            setIndiceAtual((indice) => Math.min(estudos.length - 1, indice + 1))
          }
        >
          Próximo →
        </button>
      </div>

      {remocaoPendente !== null && (
        <DialogoDeConfirmacao
          titulo="Remover esta decisão?"
          rotuloConfirmar="Remover"
          onConfirmar={confirmarRemocao}
          onCancelar={() => setRemocaoPendente(null)}
        >
          <p className="modal-corpo">
            O estudo volta para <strong>pendente</strong> e você precisará
            decidir de novo.
          </p>
          <div className="modal-estudo">
            <span className={`selo ${CLASSE_DO_SELO[decisaoDe(remocaoPendente)]}`}>
              {ROTULO_DA_DECISAO[decisaoDe(remocaoPendente)]}
            </span>
            <p>{estudos.find((estudo) => estudo.id === remocaoPendente)?.titulo}</p>
          </div>
        </DialogoDeConfirmacao>
      )}

      {descartePendente !== null && (
        <DialogoDeConfirmacao
          titulo="Descartar este artigo?"
          rotuloConfirmar="Descartar"
          onConfirmar={confirmarDescarte}
          onCancelar={() => setDescartePendente(null)}
        >
          <p className="modal-corpo">
            O artigo sai do protocolo inteiro, com todas as decisões e dados
            extraídos. Não dá para desfazer — só reimportando o arquivo.
          </p>
          <div className="modal-estudo">
            <p>{estudos.find((estudo) => estudo.id === descartePendente)?.titulo}</p>
          </div>
          <p className="aviso modal-alternativa">
            Se você só quer deixá-lo de fora da revisão, cancele e use{" "}
            <strong>Não incluir</strong>, apontando o motivo. Assim ele
            continua no protocolo e aparece no PRISMA como excluído — que é o
            que a metodologia pede.
          </p>
        </DialogoDeConfirmacao>
      )}

      {estudoAtual && (
        <ArtigoEmTriagem
          estudo={estudoAtual}
          decisao={decisaoDe(estudoAtual.id)}
          criterioAplicado={
            decisoes.get(estudoAtual.id)?.criterioId
              ? codigoDoCriterio.get(decisoes.get(estudoAtual.id)!.criterioId!)
              : undefined
          }
          criterios={criterios}
          criteriosDeInclusao={criteriosDeInclusao}
          atendidos={atendidos.get(estudoAtual.id) ?? new Set()}
          onAlternarCriterio={(criterioId, marcado) =>
            alternarCriterio(estudoAtual.id, criterioId, marcado)
          }
          onDecidir={decidir}
          onDesfazer={desfazerAtual}
          onDescartar={() => setDescartePendente(estudoAtual.id)}
        />
      )}
    </>
  );
}

interface PropsDoArtigo {
  estudo: EstudoParaTriagem;
  decisao: Decisao;
  criterioAplicado: string | undefined;
  criterios: CriterioDoProtocolo[];
  criteriosDeInclusao: CriterioDoProtocolo[];
  atendidos: Set<string>;
  onAlternarCriterio: (criterioId: string, marcado: boolean) => void;
  onDecidir: (decisao: Decisao, criterioId: string | null) => void;
  onDesfazer: () => void;
  onDescartar: () => void;
}

function ArtigoEmTriagem({
  estudo,
  decisao,
  criterioAplicado,
  criterios,
  criteriosDeInclusao,
  atendidos,
  onAlternarCriterio,
  onDecidir,
  onDesfazer,
  onDescartar,
}: PropsDoArtigo) {
  const ehLeituraCompleta = criteriosDeInclusao.length > 0;
  const criteriosPendentes = criteriosDeInclusao.filter(
    (item) => !atendidos.has(item.id),
  );
  const podeIncluir = !ehLeituraCompleta || criteriosPendentes.length === 0;

  return (
    <article className="cartao">
      {decisao !== "pendente" && (
        <p>
          <span className={`selo ${CLASSE_DO_SELO[decisao]}`}>
            {ROTULO_DA_DECISAO[decisao]}
            {criterioAplicado ? ` · ${criterioAplicado}` : ""}
          </span>
        </p>
      )}

      <h2 className="estudo-titulo">{estudo.titulo}</h2>

      <dl className="ficha">
        <Detalhe rotulo="Autores" valor={formatarAutores(estudo.autores, 20)} />
        <Detalhe rotulo="Ano" valor={estudo.ano} />
        <Detalhe rotulo="Mês" valor={formatarMes(estudo.mes)} />
        <Detalhe rotulo="Veículo" valor={estudo.veiculo} />
        <Detalhe rotulo="Tipo" valor={estudo.tipo} />
        <Detalhe rotulo="DOI" valor={estudo.doi} />

        {estudo.url && (
          <>
            <dt>Link</dt>
            <dd>
              <a href={estudo.url} target="_blank" rel="noopener noreferrer">
                {estudo.url}
              </a>
            </dd>
          </>
        )}

        {estudo.palavrasChave.length > 0 && (
          <>
            <dt>Temas</dt>
            <dd className="temas">
              {estudo.palavrasChave.map((tema) => (
                <span key={tema} className="tema">
                  {tema}
                </span>
              ))}
            </dd>
          </>
        )}

        {estudo.bases.length > 0 && (
          <>
            <dt>Origem</dt>
            <dd>{estudo.bases.join(", ")}</dd>
          </>
        )}
      </dl>

      {estudo.resumo && <div className="estudo-resumo">{estudo.resumo}</div>}

      {criteriosDeInclusao.length > 0 && (
        <div className="alvo">
          <p className="alvo-titulo">
            Confirme no texto e marque (
            {atendidos.size}/{criteriosDeInclusao.length})
          </p>
          <ul className="lista-limpa">
            {criteriosDeInclusao.map((criterioDeInclusao) => (
              <li key={criterioDeInclusao.id}>
                <label className="checagem">
                  <input
                    type="checkbox"
                    checked={atendidos.has(criterioDeInclusao.id)}
                    onChange={(evento) =>
                      onAlternarCriterio(criterioDeInclusao.id, evento.target.checked)
                    }
                  />
                  <span>
                    <strong>{criterioDeInclusao.codigo}</strong> —{" "}
                    {criterioDeInclusao.descricao}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="linha-acoes">
        <button
          type="button"
          className="botao botao-primario"
          disabled={!podeIncluir || decisao === "incluido"}
          title={
            decisao === "incluido"
              ? "Este estudo já está incluído"
              : podeIncluir
                ? undefined
                : `Faltam ${criteriosPendentes.length} critério(s) de inclusão`
          }
          onClick={() => onDecidir("incluido", null)}
        >
          Incluir
        </button>

        {ehLeituraCompleta && (
          <button
            type="button"
            className="botao botao-perigo-suave"
            disabled={decisao === "excluido"}
            title={
              decisao === "excluido"
                ? "Este estudo já está marcado como não incluído"
                : "Registra o primeiro critério de inclusão não atendido"
            }
            onClick={() =>
              onDecidir("excluido", criteriosPendentes[0]?.id ?? null)
            }
          >
            Não incluir
          </button>
        )}
        <button
          type="button"
          className="botao"
          disabled={decisao === "duvida"}
          title={decisao === "duvida" ? "Este estudo já está em dúvida" : undefined}
          onClick={() => onDecidir("duvida", null)}
        >
          Em dúvida
        </button>
        <button
          type="button"
          className="botao"
          disabled={decisao === "pendente"}
          title={
            decisao === "pendente"
              ? "Este estudo ainda não tem decisão"
              : "Volta o estudo para pendente"
          }
          onClick={onDesfazer}
        >
          Limpar decisão
        </button>
        {!ehLeituraCompleta && (
          <button
            type="button"
            className="botao botao-perigo-suave botao-a-direita"
            title="Remove o artigo do protocolo inteiro, não apenas desta fase"
            onClick={onDescartar}
          >
            Descartar artigo
          </button>
        )}
      </div>

      {!ehLeituraCompleta && (
        <>
          <p className="alvo-titulo" style={{ marginTop: "1.5rem" }}>
Para não incluir, aponte o motivo
          </p>
          <div className="criterios">
            {criterios.map((criterioDeExclusao) => (
              <button
                type="button"
                key={criterioDeExclusao.id}
                className="criterio"
                disabled={criterioAplicado === criterioDeExclusao.codigo}
                title={
                  criterioAplicado === criterioDeExclusao.codigo
                    ? "Já excluído por este motivo"
                    : undefined
                }
                onClick={() => onDecidir("excluido", criterioDeExclusao.id)}
              >
                <span className="marca-criterio">{criterioDeExclusao.codigo}</span>
                <span className="texto-criterio">{criterioDeExclusao.descricao}</span>
              </button>
            ))}
          </div>
        </>
      )}

    </article>
  );
}
