"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatarAutores } from "@/lib/bibtex/autores";
import type {
  CriterioDeExclusao,
  Decisao,
  EstudoParaTriagem,
} from "@/lib/consultas";
import { desfazerDecisao, registrarDecisao } from "./acoes";

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
  pendente: "",
};

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
  const [decisoes, setDecisoes] = useState<Map<string, Decisao>>(
    () =>
      new Map(
        estudos
          .filter((estudo) => estudo.decisao !== null)
          .map((estudo) => [estudo.id, estudo.decisao!]),
      ),
  );
  const [indiceAtual, setIndiceAtual] = useState(() => primeiroPendente(estudos));

  const estudoAtual = estudos[indiceAtual];

  const porId = useMemo(
    () => new Map(estudos.map((estudo) => [estudo.id, estudo])),
    [estudos],
  );

  const contagem = useMemo(() => {
    const totais = { incluido: 0, excluido: 0, duvida: 0, pendente: 0 };
    for (const estudo of estudos) {
      const decisao = decisoes.get(estudo.id) ?? "pendente";
      totais[decisao as keyof typeof totais]++;
    }
    return totais;
  }, [estudos, decisoes]);

  const incluidos = useMemo(
    () =>
      [...decisoes.entries()]
        .filter(([, decisao]) => decisao === "incluido")
        .map(([id]) => porId.get(id))
        .filter((estudo): estudo is EstudoParaTriagem => estudo !== undefined)
        .reverse(),
    [decisoes, porId],
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

      setDecisoes((anteriores) => new Map(anteriores).set(estudoAtual.id, decisao));
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

  const retirarDecisao = useCallback(
    (estudoId: string) => {
      setDecisoes((anteriores) => {
        const atualizadas = new Map(anteriores);
        atualizadas.delete(estudoId);
        return atualizadas;
      });
      void desfazerDecisao(protocoloId, estudoId);
    },
    [protocoloId],
  );

  const desfazerAtual = useCallback(() => {
    if (estudoAtual) retirarDecisao(estudoAtual.id);
  }, [estudoAtual, retirarDecisao]);

  useEffect(() => {
    function aoTeclar(evento: KeyboardEvent) {
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
  }, [decidir, desfazerAtual, criterios, estudos.length]);

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

  const decididos = estudos.length - contagem.pendente;
  const percentual = Math.round((decididos / estudos.length) * 100);

  return (
    <>
      {incluidos.length > 0 && (
        <section className="cartao incluidos">
          <div className="incluidos-topo">
            <h2>
              Incluídos <span className="selo selo-incluido">{incluidos.length}</span>
            </h2>
            <span className="subtitulo">clique para revisitar</span>
          </div>

          <div className="incluidos-rolagem">
            <table className="tabela">
              <tbody>
                {incluidos.map((estudo) => (
                  <tr key={estudo.id} className="linha-incluido">
                    <td>
                      <button
                        type="button"
                        className="link-estudo"
                        onClick={() =>
                          setIndiceAtual(estudos.findIndex((e) => e.id === estudo.id))
                        }
                      >
                        {estudo.titulo}
                      </button>
                      <div className="subtitulo">{descreverEstudo(estudo)}</div>
                    </td>
                    <td style={{ width: "1%", whiteSpace: "nowrap" }}>
                      <button
                        type="button"
                        className="botao-retirar"
                        title="Retirar da lista"
                        onClick={() => retirarDecisao(estudo.id)}
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <div className="contadores" style={{ marginTop: incluidos.length > 0 ? "1.25rem" : 0 }}>
        <span>
          Restam <strong>{contagem.pendente}</strong> de <strong>{estudos.length}</strong>
        </span>
        <span>
          Excluídos <strong>{contagem.excluido}</strong>
        </span>
        <span>
          Em dúvida <strong>{contagem.duvida}</strong>
        </span>
      </div>

      <div className="barra-progresso">
        <div style={{ width: `${percentual}%` }} />
      </div>

      {estudoAtual && <ArtigoEmTriagem
        estudo={estudoAtual}
        decisao={decisoes.get(estudoAtual.id) ?? "pendente"}
        criterios={criterios}
        onDecidir={decidir}
        onDesfazer={desfazerAtual}
      />}
    </>
  );
}

interface PropsDoArtigo {
  estudo: EstudoParaTriagem;
  decisao: Decisao;
  criterios: CriterioDeExclusao[];
  onDecidir: (decisao: Decisao, criterioId: string | null) => void;
  onDesfazer: () => void;
}

function ArtigoEmTriagem({
  estudo,
  decisao,
  criterios,
  onDecidir,
  onDesfazer,
}: PropsDoArtigo) {
  return (
    <article className="cartao">
      {decisao !== "pendente" && (
        <p>
          <span className={`selo ${CLASSE_DO_SELO[decisao]}`}>
            {ROTULO_DA_DECISAO[decisao]}
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
        <button type="button" className="botao" onClick={onDesfazer}>
          Desfazer <kbd>U</kbd>
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
