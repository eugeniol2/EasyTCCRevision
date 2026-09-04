"use client";

import { useCallback, useMemo, useState } from "react";
import { formatarAutores } from "@/lib/bibtex/autores";
import type { CampoDeExtracao, EstudoParaExtracao } from "@/lib/extracao";
import {
  criarAvaliacaoDeQualidade,
  criarCampo,
  excluirCampo,
  salvarValor,
  usarCamposPadrao,
} from "./acoes";

interface Props {
  protocoloId: string;
  estudos: EstudoParaExtracao[];
  campos: CampoDeExtracao[];
}

type ValoresPorEstudo = Record<string, Record<string, string>>;

function chaveDaCelula(estudoId: string, campoId: string): string {
  return `${estudoId}:${campoId}`;
}

export default function PainelDeExtracao({
  protocoloId,
  estudos,
  campos,
}: Props) {
  const [valores, setValores] = useState<ValoresPorEstudo>(() =>
    Object.fromEntries(estudos.map((item) => [item.id, { ...item.valores }])),
  );
  const [indiceAtual, setIndiceAtual] = useState(0);
  const [salvando, setSalvando] = useState<string | null>(null);
  const [nomeDoNovoCampo, setNomeDoNovoCampo] = useState("");

  const estudoAtual = estudos[indiceAtual];

  const preenchidosPorEstudo = useMemo(() => {
    const contagem: Record<string, number> = {};
    for (const item of estudos) {
      const doEstudo = valores[item.id] ?? {};
      contagem[item.id] = campos.filter(
        (campo) => (doEstudo[campo.id] ?? "").trim() !== "",
      ).length;
    }
    return contagem;
  }, [estudos, valores, campos]);

  const completos = estudos.filter(
    (item) => campos.length > 0 && preenchidosPorEstudo[item.id] === campos.length,
  ).length;

  const alterar = useCallback((estudoId: string, campoId: string, valor: string) => {
    setValores((anteriores) => ({
      ...anteriores,
      [estudoId]: { ...(anteriores[estudoId] ?? {}), [campoId]: valor },
    }));
  }, []);

  const gravar = useCallback(
    async (estudoId: string, campoId: string, valor: string) => {
      setSalvando(chaveDaCelula(estudoId, campoId));
      await salvarValor(protocoloId, estudoId, campoId, valor);
      setSalvando(null);
    },
    [protocoloId],
  );

  if (campos.length === 0) {
    return (
      <div className="cartao vazio">
        <p>Nenhuma coluna de extração definida.</p>
        <p className="subtitulo">
          O padrão são objetivo, metodologia e resultados. Você pode acrescentar
          outras depois.
        </p>
        <button
          type="button"
          className="botao botao-primario"
          onClick={() => void usarCamposPadrao(protocoloId)}
        >
          Criar as três colunas padrão
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="contadores">
        <span>
          Estudos incluídos <strong>{estudos.length}</strong>
        </span>
        <span>
          Completos <strong>{completos}</strong>
        </span>
        <span>
          Colunas <strong>{campos.length}</strong>
        </span>
      </div>

      <div className="barra-progresso">
        <div style={{ width: `${Math.round((completos / estudos.length) * 100)}%` }} />
      </div>

      <section className="cartao lista-grupo">
        <div className="lista-rolagem">
          <table className="tabela">
            <thead>
              <tr>
                <th>Estudo</th>
                <th style={{ width: "1%", whiteSpace: "nowrap" }}>Preenchido</th>
              </tr>
            </thead>
            <tbody>
              {estudos.map((item, posicao) => (
                <tr
                  key={item.id}
                  className={`linha-estudo${
                    item.id === estudoAtual?.id ? " linha-atual" : ""
                  }`}
                >
                  <td>
                    <button
                      type="button"
                      className="link-estudo"
                      onClick={() => setIndiceAtual(posicao)}
                    >
                      {item.titulo}
                    </button>
                    <div className="subtitulo">
                      {formatarAutores(item.autores)} · {item.ano ?? "s/ ano"} ·{" "}
                      {item.veiculo ?? "veículo não informado"}
                    </div>
                  </td>
                  <td className="celula-acao">
                    <span
                      className={`selo ${
                        preenchidosPorEstudo[item.id] === campos.length
                          ? "selo-incluido"
                          : "selo-pendente"
                      }`}
                    >
                      {preenchidosPorEstudo[item.id]}/{campos.length}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

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

      {estudoAtual && (
        <article className="cartao">
          <h2 className="estudo-titulo">{estudoAtual.titulo}</h2>
          <p className="estudo-meta">
            {formatarAutores(estudoAtual.autores, 20)} · {estudoAtual.ano ?? "s/ ano"}
            {estudoAtual.veiculo ? ` · ${estudoAtual.veiculo}` : ""}
            {estudoAtual.url && (
              <>
                {" · "}
                <a href={estudoAtual.url} target="_blank" rel="noopener noreferrer">
                  {estudoAtual.doi ?? "abrir"}
                </a>
              </>
            )}
          </p>

          <div className="grade">
            {campos.map((campo) => {
              const valor = valores[estudoAtual.id]?.[campo.id] ?? "";
              const estaSalvando = salvando === chaveDaCelula(estudoAtual.id, campo.id);

              return (
                <div key={campo.id}>
                  <label htmlFor={`campo-${campo.id}`}>
                    {campo.nome}
                    {estaSalvando && <span className="uso-criterio"> salvando...</span>}
                  </label>
                  {campo.tipo === "opcoes" ? (
                    <select
                      id={`campo-${campo.id}`}
                      value={valor}
                      onChange={(evento) => {
                        alterar(estudoAtual.id, campo.id, evento.target.value);
                        void gravar(estudoAtual.id, campo.id, evento.target.value);
                      }}
                    >
                      <option value="">Não avaliado</option>
                      {(campo.opcoes ?? []).map((opcao) => (
                        <option key={opcao} value={opcao}>
                          {opcao}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <textarea
                      id={`campo-${campo.id}`}
                      className="campo-extraido"
                      rows={3}
                      value={valor}
                      placeholder={`${campo.nome} deste estudo`}
                      onChange={(evento) =>
                        alterar(estudoAtual.id, campo.id, evento.target.value)
                      }
                      onBlur={(evento) =>
                        void gravar(estudoAtual.id, campo.id, evento.target.value)
                      }
                    />
                  )}
                </div>
              );
            })}
          </div>
        </article>
      )}

      <section className="cartao" style={{ marginTop: "1.25rem" }}>
        <h2 style={{ fontSize: "1rem", margin: "0 0 0.75rem" }}>Colunas da tabela</h2>

        <div className="grade" style={{ gap: "0.4rem" }}>
          {campos.map((campo) => (
            <div key={campo.id} className="linha-criterio">
              <span className="codigo-criterio">
                {campo.tipo === "opcoes" ? "opções" : campo.tipo}
              </span>
              <span style={{ flex: 1 }}>
                {campo.nome}
                {campo.opcoes && (
                  <span className="uso-criterio"> {campo.opcoes.join(" · ")}</span>
                )}
              </span>
              <button
                type="button"
                className="botao-retirar"
                title="Remover coluna e todos os valores preenchidos nela"
                onClick={() => void excluirCampo(protocoloId, campo.id)}
              >
                ×
              </button>
            </div>
          ))}
        </div>

        <div className="linha-acoes">
          <input
            value={nomeDoNovoCampo}
            onChange={(evento) => setNomeDoNovoCampo(evento.target.value)}
            placeholder="Nome da nova coluna"
            style={{ flex: 1, minWidth: "12rem" }}
          />
          <button
            type="button"
            className="botao"
            disabled={nomeDoNovoCampo.trim() === ""}
            onClick={() => {
              void criarCampo(protocoloId, nomeDoNovoCampo, "texto", null);
              setNomeDoNovoCampo("");
            }}
          >
            Adicionar coluna
          </button>
          {!campos.some((campo) => campo.tipo === "opcoes") && (
            <button
              type="button"
              className="botao"
              onClick={() => void criarAvaliacaoDeQualidade(protocoloId)}
            >
              Adicionar avaliação de qualidade
            </button>
          )}
        </div>
      </section>
    </>
  );
}
