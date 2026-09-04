import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { busca } from "@/db/schema";
import {
  buscarProtocolo,
  contarPorDecisao,
  LEITURA_COMPLETA,
  TRIAGEM_INICIAL,
} from "@/lib/consultas";
import AcoesDoProtocolo from "./AcoesDoProtocolo";

function formatarData(segundosUnix: number): string {
  return new Date(segundosUnix * 1000).toLocaleDateString("pt-BR");
}

export default async function PaginaDoProtocolo({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const protocolo = buscarProtocolo(id);
  if (!protocolo) notFound();

  const naTriagem = contarPorDecisao(id, TRIAGEM_INICIAL);
  const naLeitura = contarPorDecisao(id, LEITURA_COMPLETA);
  const buscas = db.select().from(busca).where(eq(busca.protocoloId, id)).all();

  return (
    <>
      <header className="cabecalho">
        <div>
          <h1>{protocolo.titulo}</h1>
          <p className="subtitulo">
            {protocolo.questaoPesquisa ?? "Pergunta de pesquisa ainda não definida."}
          </p>
        </div>
        <div className="linha-acoes" style={{ marginTop: 0 }}>
          <a className="botao" href={`/protocolos/${id}/protocolo`}>
            Editar protocolo
          </a>
          <a className="botao" href="/">
            Todos os protocolos
          </a>
        </div>
      </header>

      <section className="cartao">
        <h2 style={{ fontSize: "1rem", marginTop: 0 }}>Fase 1 — Título e resumo</h2>
        <div className="contadores">
          <span>
            Total <strong>{naTriagem.total}</strong>
          </span>
          <span>
            Incluídos <strong>{naTriagem.incluido}</strong>
          </span>
          <span>
            Excluídos <strong>{naTriagem.excluido}</strong>
          </span>
          <span>
            Em dúvida <strong>{naTriagem.duvida}</strong>
          </span>
          <span>
            Pendentes <strong>{naTriagem.pendente}</strong>
          </span>
        </div>
        <div className="linha-acoes">
          <a className="botao botao-primario" href={`/protocolos/${id}/triagem`}>
            Continuar triagem
          </a>
          <a className="botao" href={`/protocolos/${id}/importar`}>
            Importar .bib ou .csv
          </a>
          <AcoesDoProtocolo
            protocoloId={id}
            decisoesTomadas={naTriagem.total - naTriagem.pendente}
            totalDeEstudos={naTriagem.total}
            buscasRegistradas={buscas.length}
          />
        </div>
      </section>

      <section className="cartao" style={{ marginTop: "1.25rem" }}>
        <h2 style={{ fontSize: "1rem", marginTop: 0 }}>Fase 2 — Texto completo</h2>
        <p className="subtitulo" style={{ marginBottom: "0.5rem" }}>
          Recebe apenas os incluídos na fase 1.
        </p>
        <div className="contadores">
          <span>
            Chegaram <strong>{naLeitura.total}</strong>
          </span>
          <span>
            Incluídos <strong>{naLeitura.incluido}</strong>
          </span>
          <span>
            Excluídos <strong>{naLeitura.excluido}</strong>
          </span>
          <span>
            Em dúvida <strong>{naLeitura.duvida}</strong>
          </span>
          <span>
            Pendentes <strong>{naLeitura.pendente}</strong>
          </span>
        </div>
        <div className="linha-acoes">
          <a
            className={`botao${naLeitura.total > 0 ? " botao-primario" : ""}`}
            href={`/protocolos/${id}/leitura`}
          >
            Ler textos completos
          </a>
        </div>
      </section>

      <section className="cartao" style={{ marginTop: "1.25rem" }}>
        <h2 style={{ fontSize: "1rem", marginTop: 0 }}>Buscas executadas</h2>

        {buscas.length === 0 ? (
          <p className="subtitulo">
            Nenhuma busca registrada. Cada importação cria uma.
          </p>
        ) : (
          <table className="tabela">
            <thead>
              <tr>
                <th>Base</th>
                <th>String</th>
                <th>Data</th>
                <th>Resultados</th>
              </tr>
            </thead>
            <tbody>
              {buscas.map((execucao) => (
                <tr key={execucao.id}>
                  <td>{execucao.base}</td>
                  <td>
                    <code style={{ fontSize: "0.8rem" }}>{execucao.stringBusca}</code>
                  </td>
                  <td>{formatarData(execucao.executadaEm)}</td>
                  <td>{execucao.totalResultados ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
