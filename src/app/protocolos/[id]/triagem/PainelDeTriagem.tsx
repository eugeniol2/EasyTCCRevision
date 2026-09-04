"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import DialogoDeConfirmacao from "@/app/componentes/DialogoDeConfirmacao";
import { formatarAutores } from "@/lib/bibtex/autores";
import type {
  CriterioDeExclusao,
  Decisao,
  EstudoParaTriagem,
} from "@/lib/consultas";
import { descartarArtigo, desfazerDecisao, registrarDecisao } from "./acoes";

const TECLA_INCLUIR = "i";
const TECLA_DUVIDA = "d";
const TECLA_DESFAZER = "u";
const TECLA_ANTERIOR = "ArrowLeft";
const TECLA_PROXIMO = "ArrowRight";

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
  estudos: EstudoParaTriagem[];
  criterios: CriterioDeExclusao[];
}

function descreverEstudo(estudo: EstudoParaTriagem): string {
  const partes = [
    formatarAutores(estudo.autores),
    estudo.ano ? String(estudo.ano) : null,
    estudo.veiculo,
  ];
  return partes.filter(Boolean).join(" · ");
}

function primeiroPendente(estudos: EstudoParaTriagem[]): number {
  const indice = estudos.findIndex((estudo) => estudo.decisao === null);
  return indice === -1 ? 0 : indice;
}

export default function PainelDeTriagem({
  protocoloId,
  estudos,
  criterios,
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

  const estudosFiltrados = useMemo(() => {
    const doFiltro = estudos.filter((estudo) =>
      filtro === "decididos"
        ? decisaoDe(estudo.id) !== "pendente"
        : decisaoDe(estudo.id) === filtro,
    );

    if (filtro === "pendente") return doFiltro;

    return doFiltro.sort(
      (um, outro) =>
        (ordemDaDecisao.get(outro.id) ?? 0) - (ordemDaDecisao.get(um.id) ?? 0),
    );
  }, [estudos, filtro, decisaoDe, ordemDaDecisao]);

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
      void registrarDecisao({
        protocoloId,
        estudoId: estudoAtual.id,
        decisao,
        criterioId,
      });
      irParaProximoPendente(indiceAtual);
    },
    [estudoAtual, protocoloId, indiceAtual, irParaProximoPendente],
  );

  const pedirRemocao = useCallback(
    (estudoId: string) => {
      if (decisoes.has(estudoId)) setRemocaoPendente(estudoId);
    },
    [decisoes],
  );

  const confirmarRemocao = useCallback(() => {
    const estudoId = remocaoPendente;
    if (estudoId === null) return;

    setDecisoes((anteriores) => {
      const atualizadas = new Map(anteriores);
      atualizadas.delete(estudoId);
      return atualizadas;
    });
    void desfazerDecisao(protocoloId, estudoId);
    setRemocaoPendente(null);
  }, [remocaoPendente, protocoloId]);

  const desfazerAtual = useCallback(() => {
    if (estudoAtual) pedirRemocao(estudoAtual.id);
  }, [estudoAtual, pedirRemocao]);

  useEffect(() => {
    setIndiceAtual((indice) => Math.min(indice, Math.max(0, estudos.length - 1)));
  }, [estudos.length]);

  const confirmarDescarte = useCallback(() => {
    const estudoId = descartePendente;
    if (estudoId === null) return;

    void descartarArtigo(protocoloId, estudoId);
    setDescartePendente(null);
  }, [descartePendente, protocoloId]);

  const irPara = useCallback(
    (estudoId: string) => {
      setIndiceAtual(estudos.findIndex((estudo) => estudo.id === estudoId));
    },
    [estudos],
  );

  useEffect(() => {
    function aoTeclar(evento: KeyboardEvent) {
      if (remocaoPendente !== null || descartePendente !== null) return;

      const alvo = evento.target as HTMLElement | null;
      const estaDigitando = alvo?.tagName === "INPUT" || alvo?.tagName === "TEXTAREA";
      if (estaDigitando || evento.metaKey || evento.ctrlKey || evento.altKey) return;

      const tecla = evento.key.toLowerCase();

      if (tecla === TECLA_INCLUIR) {
        evento.preventDefault();
        decidir("incluido", null);
        return;
      }
      if (tecla === TECLA_DUVIDA) {
        evento.preventDefault();
        decidir("duvida", null);
        return;
      }
      if (tecla === TECLA_DESFAZER) {
        evento.preventDefault();
        desfazerAtual();
        return;
      }
      if (evento.key === TECLA_ANTERIOR) {
        evento.preventDefault();
        setIndiceAtual((indice) => Math.max(0, indice - 1));
        return;
      }
      if (evento.key === TECLA_PROXIMO) {
        evento.preventDefault();
        setIndiceAtual((indice) => Math.min(estudos.length - 1, indice + 1));
        return;
      }

      const posicaoDoCriterio = Number(evento.key) - 1;
      const criterioEscolhido = criterios[posicaoDoCriterio];
      if (criterioEscolhido) {
        evento.preventDefault();
        decidir("excluido", criterioEscolhido.id);
      }
    }

    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [
    decidir,
    desfazerAtual,
    criterios,
    estudos.length,
    remocaoPendente,
    descartePendente,
  ]);

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
            onClick={() => setFiltro(chave)}
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
                        <div className="subtitulo">{descreverEstudo(estudo)}</div>
                      </td>
                      <td className="celula-acao">
                        {decisao !== "pendente" && (
                          <button
                            type="button"
                            className="botao-retirar"
                            title="Voltar para pendente"
                            onClick={() => pedirRemocao(estudo.id)}
                          >
                            ×
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
        <span className="posicao">
          Estudo <strong>{indiceAtual + 1}</strong> de <strong>{estudos.length}</strong>
        </span>
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
            O artigo sai do protocolo junto com sua decisão de triagem. Não dá
            para desfazer — só reimportando o .bib.
          </p>
          <div className="modal-estudo">
            <p>{estudos.find((estudo) => estudo.id === descartePendente)?.titulo}</p>
          </div>
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
  criterios: CriterioDeExclusao[];
  onDecidir: (decisao: Decisao, criterioId: string | null) => void;
  onDesfazer: () => void;
  onDescartar: () => void;
}

function ArtigoEmTriagem({
  estudo,
  decisao,
  criterioAplicado,
  criterios,
  onDecidir,
  onDesfazer,
  onDescartar,
}: PropsDoArtigo) {
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
      <p className="estudo-meta">
        {descreverEstudo(estudo)}
        {estudo.url && (
          <>
            {" · "}
            <a href={estudo.url} target="_blank" rel="noopener noreferrer">
              {estudo.doi ?? "abrir"}
            </a>
          </>
        )}
      </p>

      <div className="estudo-resumo">
        {estudo.resumo ?? <em>Sem resumo no registro importado.</em>}
      </div>

      <div className="linha-acoes">
        <button
          type="button"
          className="botao botao-primario"
          onClick={() => onDecidir("incluido", null)}
        >
          Incluir <kbd>I</kbd>
        </button>
        <button type="button" className="botao" onClick={() => onDecidir("duvida", null)}>
          Em dúvida <kbd>D</kbd>
        </button>
        <button
          type="button"
          className="botao"
          disabled={decisao === "pendente"}
          onClick={onDesfazer}
        >
          Desfazer <kbd>U</kbd>
        </button>
        <button
          type="button"
          className="botao botao-perigo-suave botao-a-direita"
          onClick={onDescartar}
        >
          Descartar artigo
        </button>
      </div>

      <div className="criterios">
        {criterios.map((criterioDeExclusao, posicao) => (
          <button
            type="button"
            key={criterioDeExclusao.id}
            className="criterio"
            onClick={() => onDecidir("excluido", criterioDeExclusao.id)}
          >
            <kbd>{posicao + 1}</kbd>
            <span>
              <strong>{criterioDeExclusao.codigo}</strong> — {criterioDeExclusao.descricao}
            </span>
          </button>
        ))}
      </div>

      <div className="atalhos">
        <span>
          <kbd>I</kbd> incluir
        </span>
        <span>
          <kbd>1</kbd>–<kbd>{criterios.length}</kbd> excluir pelo critério
        </span>
        <span>
          <kbd>D</kbd> dúvida
        </span>
        <span>
          <kbd>U</kbd> desfazer
        </span>
        <span>
          <kbd>←</kbd> <kbd>→</kbd> navegar
        </span>
      </div>
    </article>
  );
}
