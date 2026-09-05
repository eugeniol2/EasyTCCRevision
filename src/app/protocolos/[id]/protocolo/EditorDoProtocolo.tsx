"use client";

import { useActionState, useState } from "react";
import { Girando } from "@/app/componentes/Carregamento";
import type { CriterioEditavel, TipoDeCriterio } from "@/lib/protocolo";
import { salvarProtocolo, type ResultadoDaEdicao } from "./acoes";

const RESULTADO_INICIAL: ResultadoDaEdicao = { estado: "inicial", mensagem: "" };

const SECOES: { tipo: TipoDeCriterio; titulo: string; ajuda: string }[] = [
  {
    tipo: "inclusao",
    titulo: "Critérios de inclusão",
    ajuda: "O que um estudo precisa ter para entrar na revisão.",
  },
  {
    tipo: "exclusao",
    titulo: "Critérios de exclusão",
    ajuda: "Os motivos de descarte. Cada exclusão na triagem aponta um deles.",
  },
];

interface LinhaDeCriterio extends CriterioEditavel {
  chaveLocal: string;
}

interface Props {
  protocoloId: string;
  titulo: string;
  questaoPesquisa: string | null;
  anoInicio: number | null;
  anoFim: number | null;
  criterios: CriterioEditavel[];
}

export default function EditorDoProtocolo({
  protocoloId,
  titulo,
  questaoPesquisa,
  anoInicio,
  anoFim,
  criterios,
}: Props) {
  const [resultado, enviar, enviando] = useActionState(
    salvarProtocolo,
    RESULTADO_INICIAL,
  );
  const [linhas, setLinhas] = useState<LinhaDeCriterio[]>(() =>
    criterios.map((item) => ({ ...item, chaveLocal: item.id ?? crypto.randomUUID() })),
  );

  function adicionar(tipo: TipoDeCriterio) {
    setLinhas((anteriores) => [
      ...anteriores,
      {
        id: null,
        tipo,
        codigo: "novo",
        descricao: "",
        usadoEmExclusoes: 0,
        chaveLocal: crypto.randomUUID(),
      },
    ]);
  }

  function alterarDescricao(chaveLocal: string, descricao: string) {
    setLinhas((anteriores) =>
      anteriores.map((linha) =>
        linha.chaveLocal === chaveLocal ? { ...linha, descricao } : linha,
      ),
    );
  }

  function remover(chaveLocal: string) {
    setLinhas((anteriores) =>
      anteriores.filter((linha) => linha.chaveLocal !== chaveLocal),
    );
  }

  const paraEnviar = linhas.map(({ id, tipo, descricao }) => ({
    id,
    tipo,
    descricao,
  }));

  return (
    <form action={enviar} className="grade" style={{ gap: "1.25rem" }}>
      <input type="hidden" name="protocoloId" value={protocoloId} />
      <input type="hidden" name="criterios" value={JSON.stringify(paraEnviar)} />

      <section className="cartao grade">
        <div>
          <label htmlFor="titulo">Título da revisão</label>
          <input id="titulo" name="titulo" defaultValue={titulo} required />
        </div>

        <div>
          <label htmlFor="questaoPesquisa">
            Pergunta de pesquisa — o problema que esta revisão pretende responder
          </label>
          <textarea
            id="questaoPesquisa"
            name="questaoPesquisa"
            className="campo-expansivel"
            rows={2}
            defaultValue={questaoPesquisa ?? ""}
            placeholder="Quais técnicas de aprendizado de máquina são usadas para detectar anomalias em logs de auditoria?"
          />
        </div>

        <div className="linha-anos">
          <div>
            <label htmlFor="anoInicio">Recorte: de</label>
            <input
              id="anoInicio"
              name="anoInicio"
              type="number"
              min={1900}
              max={2100}
              defaultValue={anoInicio ?? ""}
            />
          </div>
          <div>
            <label htmlFor="anoFim">até</label>
            <input
              id="anoFim"
              name="anoFim"
              type="number"
              min={1900}
              max={2100}
              defaultValue={anoFim ?? ""}
            />
          </div>
        </div>
      </section>

      {SECOES.map(({ tipo, titulo: tituloDaSecao, ajuda }) => {
        const daSecao = linhas.filter((linha) => linha.tipo === tipo);

        return (
          <section key={tipo} className="cartao">
            <h2 style={{ fontSize: "1rem", margin: "0 0 0.15rem" }}>{tituloDaSecao}</h2>
            <p className="subtitulo" style={{ marginBottom: "0.9rem" }}>
              {ajuda}
            </p>

            {daSecao.length === 0 ? (
              <p className="subtitulo">Nenhum critério cadastrado.</p>
            ) : (
              <div className="grade" style={{ gap: "0.5rem" }}>
                {daSecao.map((linha) => (
                  <div key={linha.chaveLocal} className="linha-criterio">
                    <span className="codigo-criterio">{linha.codigo}</span>
                    <input
                      value={linha.descricao}
                      onChange={(evento) =>
                        alterarDescricao(linha.chaveLocal, evento.target.value)
                      }
                      placeholder="Descreva o critério"
                    />
                    <button
                      type="button"
                      className="botao-retirar"
                      title={
                        linha.usadoEmExclusoes > 0
                          ? `Usado em ${linha.usadoEmExclusoes} exclusão(ões)`
                          : "Remover critério"
                      }
                      onClick={() => remover(linha.chaveLocal)}
                    >
                      ×
                    </button>
                    {linha.usadoEmExclusoes > 0 && (
                      <span className="uso-criterio">
                        {linha.usadoEmExclusoes} exclusão(ões)
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="linha-acoes">
              <button type="button" className="botao" onClick={() => adicionar(tipo)}>
                Adicionar critério
              </button>
            </div>
          </section>
        );
      })}

      {linhas.some((linha) => linha.id !== null && linha.usadoEmExclusoes > 0) && (
        <div className="aviso">
          Remover um critério já usado apaga o motivo das exclusões que apontavam
          para ele, e esses estudos deixam de contar no relatório por motivo.
        </div>
      )}

      {resultado.estado === "erro" && <div className="aviso">{resultado.mensagem}</div>}

      <div className="linha-acoes">
        <button type="submit" className="botao botao-primario" disabled={enviando}>
          {enviando && <Girando />}
          {enviando ? "Salvando…" : "Salvar protocolo"}
        </button>
        {resultado.estado === "sucesso" && (
          <span className="subtitulo" style={{ alignSelf: "center" }}>
            {resultado.mensagem}
          </span>
        )}
      </div>
    </form>
  );
}
