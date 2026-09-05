"use client";

import { useActionState, useState } from "react";
import { criarRevisao, type ResultadoDaCriacao } from "./acoes";

const RESULTADO_INICIAL: ResultadoDaCriacao = { estado: "inicial", mensagem: "" };

const ANO_ATUAL = new Date().getFullYear();
const RECORTE_PADRAO = 5;

interface Props {
  comecarAberto: boolean;
}

export default function NovaRevisao({ comecarAberto }: Props) {
  const [resultado, enviar, enviando] = useActionState(
    criarRevisao,
    RESULTADO_INICIAL,
  );
  const [aberto, setAberto] = useState(comecarAberto);

  if (!aberto) {
    return (
      <button
        type="button"
        className="botao botao-primario nova-revisao"
        onClick={() => setAberto(true)}
      >
        Nova revisão
      </button>
    );
  }

  return (
    <form action={enviar} className="cartao grade nova-revisao">
      <div>
        <label htmlFor="novoTitulo">Título da revisão</label>
        <input id="novoTitulo" name="titulo" required />
      </div>

      <div>
        <label htmlFor="novaQuestao">
          Pergunta de pesquisa — o problema que esta revisão pretende responder
        </label>
        <textarea id="novaQuestao" name="questaoPesquisa" rows={3} />
      </div>

      <div className="linha-anos">
        <div>
          <label htmlFor="novoAnoInicio">Recorte: de</label>
          <input
            id="novoAnoInicio"
            name="anoInicio"
            type="number"
            defaultValue={ANO_ATUAL - RECORTE_PADRAO}
          />
        </div>
        <div>
          <label htmlFor="novoAnoFim">até</label>
          <input
            id="novoAnoFim"
            name="anoFim"
            type="number"
            defaultValue={ANO_ATUAL}
          />
        </div>
      </div>

      <p className="subtitulo">
        A revisão começa com os critérios de inclusão e exclusão mais comuns.
        Você ajusta o texto de cada um, e apaga o que não servir, na tela do
        protocolo.
      </p>

      {resultado.estado === "erro" && (
        <div className="aviso">{resultado.mensagem}</div>
      )}

      <div className="linha-acoes">
        <button type="submit" className="botao botao-primario" disabled={enviando}>
          {enviando ? "Criando..." : "Criar revisão"}
        </button>
        {!comecarAberto && (
          <button
            type="button"
            className="botao"
            onClick={() => setAberto(false)}
            disabled={enviando}
          >
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}
