"use client";

import { useState } from "react";
import type { TabelaDeTrabalhos as Tabela } from "@/lib/relatorio";

interface Props {
  protocoloId: string;
  tituloDaRevisao: string;
  tabela: Tabela;
  latex: string;
}

export default function TabelaDeTrabalhos({
  protocoloId,
  tituloDaRevisao,
  tabela,
  latex,
}: Props) {
  const [copiado, setCopiado] = useState(false);
  const [mostrandoLatex, setMostrandoLatex] = useState(false);

  async function copiarLatex() {
    await navigator.clipboard.writeText(latex);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  if (tabela.linhas.length === 0) {
    return (
      <section className="cartao" style={{ marginTop: "1.25rem" }}>
        <h2 style={{ fontSize: "1rem", margin: 0 }}>Tabela de trabalhos relacionados</h2>
        <p className="subtitulo">
          Inclua estudos na fase 2 e preencha a extração para gerar a tabela.
        </p>
      </section>
    );
  }

  return (
    <section className="cartao imprimivel" style={{ marginTop: "1.25rem" }}>
      <div className="lista-grupo-topo" style={{ alignItems: "center" }}>
        <div>
          <h2 style={{ fontSize: "1rem", margin: 0 }}>Trabalhos relacionados</h2>
          <p className="subtitulo">
            {tabela.linhas.length} estudo(s) incluído(s) · {tituloDaRevisao}
          </p>
        </div>
        <div className="linha-acoes sem-impressao" style={{ marginTop: 0 }}>
          <button type="button" className="botao" onClick={() => window.print()}>
            Salvar como PDF
          </button>
          <a className="botao" href={`/protocolos/${protocoloId}/tabela`}>
            Visualizar online
          </a>
          <button type="button" className="botao" onClick={() => void copiarLatex()}>
            {copiado ? "LaTeX copiado" : "Copiar LaTeX"}
          </button>
          <button
            type="button"
            className="botao"
            onClick={() => setMostrandoLatex((visivel) => !visivel)}
          >
            {mostrandoLatex ? "Ocultar código" : "Ver código LaTeX"}
          </button>
        </div>
      </div>

      <div className="rolagem-horizontal">
        <table className="tabela tabela-trabalhos">
          <thead>
            <tr>
              <th>Autor</th>
              <th>Ano</th>
              {tabela.colunas.map((coluna) => (
                <th key={coluna}>{coluna}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tabela.linhas.map((linha) => (
              <tr key={`${linha.autor}-${linha.ano}`}>
                <td style={{ whiteSpace: "nowrap" }}>{linha.autor}</td>
                <td>{linha.ano}</td>
                {linha.celulas.map((celula, posicao) => (
                  <td key={tabela.colunas[posicao] ?? posicao}>{celula}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {mostrandoLatex && (
        <pre className="saida sem-impressao" style={{ marginTop: "1rem" }}>
          {latex}
        </pre>
      )}
    </section>
  );
}
