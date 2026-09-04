import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { busca } from "@/db/schema";
import { buscarProtocolo, contarPorDecisao } from "@/lib/consultas";

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

  const contagem = contarPorDecisao(id, "titulo_resumo");
  const buscas = db.select().from(busca).where(eq(busca.protocoloId, id)).all();

  return (
    <>
      <header className="cabecalho">
        <div>
          <h1>{protocolo.titulo}</h1>
          <p className="subtitulo">{protocolo.questaoPesquisa}</p>
        </div>
        <a className="botao" href="/">
          Todos os protocolos
        </a>
      </header>

      <section className="cartao">
        <h2 style={{ fontSize: "1rem", marginTop: 0 }}>Triagem por título e resumo</h2>
        <div className="contadores">
          <span>
            Total <strong>{contagem.total}</strong>
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
        <div className="linha-acoes">
          <a className="botao botao-primario" href={`/protocolos/${id}/triagem`}>
            Continuar triagem
          </a>
          <a className="botao" href={`/protocolos/${id}/importar`}>
            Importar .bib
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
