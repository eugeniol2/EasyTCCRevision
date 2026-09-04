"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatarAutores } from "@/lib/bibtex/autores";
import type {
  CriterioDeExclusao,
  Decisao,
  EstagioDeTriagem,
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
  estagio: EstagioDeTriagem;
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
  estagio,
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

  const contagem = useMemo(() => {
    const totais = { incluido: 0, excluido: 0, duvida: 0, pendente: 0 };
    for (const estudo of estudos) {
      const decisao = decisoes.get(estudo.id) ?? "pendente";
      totais[decisao as keyof typeof totais]++;
    }
    return totais;
  }, [estudos, decisoes]);

  const irParaProximoPendente = useCallback(
    (aPartirDe: number) => {
      const proximo = estudos.findIndex(
        (estudo, indice) => indice > aPartirDe && !decisoes.has(estudo.id),
      );
      setIndiceAtual(proximo === -1 ? Math.min(aPartirDe + 1, estudos.length - 1) : proximo);
    },
    [estudos, decisoes],
  );

  const decidir = useCallback(
    (decisao: Decisao, criterioId: string | null) => {
      if (!estudoAtual) return;

      setDecisoes((anteriores) =>
        new Map(anteriores).set(estudoAtual.id, decisao),
      );
      void registrarDecisao({
        protocoloId,
        estudoId: estudoAtual.id,
        estagio,
        decisao,
        criterioId,
      });
      irParaProximoPendente(indiceAtual);
    },
    [estudoAtual, protocoloId, estagio, indiceAtual, irParaProximoPendente],
  );

  const desfazer = useCallback(() => {
    if (!estudoAtual) return;

    setDecisoes((anteriores) => {
      const atualizadas = new Map(anteriores);
      atualizadas.delete(estudoAtual.id);
      return atualizadas;
    });
    void desfazerDecisao(protocoloId, estudoAtual.id, estagio);
  }, [estudoAtual, protocoloId, estagio]);

  useEffect(() => {
    function aoTeclar(evento: KeyboardEvent) {
      const alvo = evento.target as HTMLElement | null;
      const estaDigitando =
        alvo?.tagName === "INPUT" || alvo?.tagName === "TEXTAREA";
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
        desfazer();
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
  }, [decidir, desfazer, criterios, estudos.length]);

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

  if (!estudoAtual) return null;

  const decisaoAtual = decisoes.get(estudoAtual.id) ?? "pendente";
  const decididos = estudos.length - contagem.pendente;
  const percentual = Math.round((decididos / estudos.length) * 100);

  return (
    <>
      <div className="contadores">
        <span>
          Estudo <strong>{indiceAtual + 1}</strong> de <strong>{estudos.length}</strong>
        </span>
        <span>
          Incluídos <strong>{contagem.incluido}</strong>
        </span>
        <span>
          Excluídos <strong>{contagem.excluido}</strong>
        </span>
        <span>
          Em dúvida <strong>{contagem.duvida}</strong>
        </span>
        <span>
          Pendentes <strong>{contagem.pendente}</strong>
        </span>
      </div>

      <div className="barra-progresso">
        <div style={{ width: `${percentual}%` }} />
      </div>

      <article className="cartao">
        {decisaoAtual !== "pendente" && (
          <p>
            <span className={`selo ${CLASSE_DO_SELO[decisaoAtual]}`}>
              {ROTULO_DA_DECISAO[decisaoAtual]}
            </span>
          </p>
        )}

        <h2 className="estudo-titulo">{estudoAtual.titulo}</h2>
        <p className="estudo-meta">
          {descreverEstudo(estudoAtual)}
          {estudoAtual.url && (
            <>
              {" · "}
              <a href={estudoAtual.url} target="_blank" rel="noopener noreferrer">
                {estudoAtual.doi ?? "abrir"}
              </a>
            </>
          )}
        </p>

        {estudoAtual.resumo ? (
          <div className="estudo-resumo">{estudoAtual.resumo}</div>
        ) : (
          <div className="estudo-resumo">
            <em>Sem resumo no registro importado.</em>
          </div>
        )}

        <div className="linha-acoes">
          <button
            type="button"
            className="botao botao-primario"
            onClick={() => decidir("incluido", null)}
          >
            Incluir <kbd>I</kbd>
          </button>
          <button
            type="button"
            className="botao"
            onClick={() => decidir("duvida", null)}
          >
            Em dúvida <kbd>D</kbd>
          </button>
          <button type="button" className="botao" onClick={desfazer}>
            Desfazer <kbd>U</kbd>
          </button>
        </div>

        <div className="criterios">
          {criterios.map((criterioDeExclusao, posicao) => (
            <button
              type="button"
              key={criterioDeExclusao.id}
              className="criterio"
              onClick={() => decidir("excluido", criterioDeExclusao.id)}
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
    </>
  );
}
