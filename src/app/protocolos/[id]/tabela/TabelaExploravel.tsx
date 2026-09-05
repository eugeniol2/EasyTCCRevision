"use client";

import { useCallback, useRef, useState, type PointerEvent } from "react";
import type { TabelaDeTrabalhos } from "@/lib/relatorio";

const LARGURA_INICIAL_DO_AUTOR = 170;
const LARGURA_INICIAL_DO_ANO = 80;
const LARGURA_INICIAL_DO_CAMPO = 280;
const LARGURA_MINIMA = 70;
const LARGURA_MAXIMA_AO_AJUSTAR = 600;
const CARACTERES_POR_PIXEL = 7.5;

interface Props {
  tabela: TabelaDeTrabalhos;
}

function chaveDaLinha(autor: string, ano: string, posicao: number): string {
  return `${posicao}:${autor}:${ano}`;
}

/**
 * Clicar na linha alterna a expansão, mas selecionar texto dentro de uma
 * linha expandida também dispara clique — sem esta guarda, copiar um
 * trecho fecharia a linha no mesmo gesto.
 */
function estaSelecionandoTexto(): boolean {
  return (window.getSelection()?.toString().length ?? 0) > 0;
}

export default function TabelaExploravel({ tabela }: Props) {
  const cabecalho = ["Autor", "Ano", ...tabela.colunas];

  const [larguras, setLarguras] = useState<number[]>(() => [
    LARGURA_INICIAL_DO_AUTOR,
    LARGURA_INICIAL_DO_ANO,
    ...tabela.colunas.map(() => LARGURA_INICIAL_DO_CAMPO),
  ]);
  const [expandidas, setExpandidas] = useState<Set<string>>(new Set());

  const arraste = useRef<{
    coluna: number;
    inicioX: number;
    larguraInicial: number;
  } | null>(null);

  const aoMover = useCallback((evento: globalThis.PointerEvent) => {
    const emCurso = arraste.current;
    if (!emCurso) return;

    const nova = Math.max(
      LARGURA_MINIMA,
      emCurso.larguraInicial + (evento.clientX - emCurso.inicioX),
    );

    setLarguras((anteriores) =>
      anteriores.map((largura, indice) => (indice === emCurso.coluna ? nova : largura)),
    );
  }, []);

  const aoSoltar = useCallback(() => {
    arraste.current = null;
    window.removeEventListener("pointermove", aoMover);
    window.removeEventListener("pointerup", aoSoltar);
    document.body.classList.remove("redimensionando");
  }, [aoMover]);

  function iniciarArraste(evento: PointerEvent<HTMLSpanElement>, coluna: number) {
    evento.preventDefault();
    evento.stopPropagation();

    arraste.current = {
      coluna,
      inicioX: evento.clientX,
      larguraInicial: larguras[coluna] ?? LARGURA_INICIAL_DO_CAMPO,
    };
    document.body.classList.add("redimensionando");
    window.addEventListener("pointermove", aoMover);
    window.addEventListener("pointerup", aoSoltar);
  }

  function ajustarAoConteudo(coluna: number) {
    const conteudos = [
      cabecalho[coluna] ?? "",
      ...tabela.linhas.map((linha) =>
        coluna === 0
          ? linha.autor
          : coluna === 1
            ? linha.ano
            : (linha.celulas[coluna - 2] ?? ""),
      ),
    ];
    const maisLongo = Math.max(...conteudos.map((texto) => texto.length));

    setLarguras((anteriores) =>
      anteriores.map((largura, indice) =>
        indice === coluna
          ? Math.min(
              LARGURA_MAXIMA_AO_AJUSTAR,
              Math.max(LARGURA_MINIMA, maisLongo * CARACTERES_POR_PIXEL),
            )
          : largura,
      ),
    );
  }

  function alternarLinha(chave: string) {
    if (estaSelecionandoTexto()) return;

    setExpandidas((anteriores) => {
      const atualizadas = new Set(anteriores);
      if (!atualizadas.delete(chave)) atualizadas.add(chave);
      return atualizadas;
    });
  }

  return (
    <>
      <div className="controles-tabela">
        <span className="subtitulo">
          {expandidas.size > 0
            ? `${expandidas.size} linha(s) expandida(s)`
            : "Clique em uma linha para expandi-la"}
        </span>
        {expandidas.size > 0 && (
          <button
            type="button"
            className="filtro"
            onClick={() => setExpandidas(new Set())}
          >
            Recolher todas
          </button>
        )}
        <span className="subtitulo dica-tabela">
          Arraste a borda de uma coluna para redimensioná-la, ou clique duas vezes
          para ajustar ao conteúdo. O canto inferior direito redimensiona a área.
        </span>
      </div>

      <div className="area-tabela">
        <table className="tabela tabela-exploravel">
          <thead>
            <tr>
              {cabecalho.map((titulo, indice) => (
                <th key={titulo} style={{ width: larguras[indice] }}>
                  {titulo}
                  <span
                    className="alca-coluna"
                    onPointerDown={(evento) => iniciarArraste(evento, indice)}
                    onDoubleClick={() => ajustarAoConteudo(indice)}
                    title="Arraste para redimensionar · duplo clique ajusta ao conteúdo"
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tabela.linhas.map((linha, posicao) => {
              const chave = chaveDaLinha(linha.autor, linha.ano, posicao);
              const expandida = expandidas.has(chave);

              return (
                <tr
                  key={chave}
                  className={`linha-exploravel${expandida ? " linha-expandida" : ""}`}
                  onClick={() => alternarLinha(chave)}
                  title={expandida ? "Clique para recolher" : "Clique para expandir"}
                >
                  {[linha.autor, linha.ano, ...linha.celulas].map((valor, indice) => (
                    <td key={cabecalho[indice] ?? indice}>
                      {indice === 0 && (
                        <span className="marca-expansao">{expandida ? "▾" : "▸"}</span>
                      )}
                      <div className={expandida ? "celula-inteira" : "celula-compacta"}>
                        {valor}
                      </div>
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
