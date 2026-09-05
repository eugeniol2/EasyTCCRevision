import { desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { busca } from "@/db/schema";
import {
  buscarProtocolo,
  contarPorDecisao,
  LEITURA_COMPLETA,
  TRIAGEM_INICIAL,
} from "@/lib/consultas";
import { medirProgresso } from "@/lib/extracao";
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
  const protocolo = await buscarProtocolo(id);
  if (!protocolo) notFound();

  const naTriagem = await contarPorDecisao(id, TRIAGEM_INICIAL);
  const naLeitura = await contarPorDecisao(id, LEITURA_COMPLETA);
  const naExtracao = await medirProgresso(id);

  const fase2Liberada = naTriagem.incluido > 0;
  const fase3Liberada = naLeitura.incluido > 0;
  const classeDaFase = (temPendentes: boolean) =>
    `cartao${temPendentes ? " cartao-alerta" : ""}`;

  const proximoPasso =
    naTriagem.pendente > 0
      ? "triagem"
      : fase2Liberada && naLeitura.pendente > 0
        ? "leitura"
        : fase3Liberada && naExtracao.completos < naExtracao.estudos
          ? "extracao"
          : "sintese";

  const destaque = (passo: string) =>
    `botao${proximoPasso === passo ? " botao-primario" : ""}`;
  const buscas = await db
    .select()
    .from(busca)
    .where(eq(busca.protocoloId, id))
    .orderBy(desc(busca.executadaEm), desc(busca.criadoEm));

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

      <section className={classeDaFase(naTriagem.pendente > 0)}>
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
          <a className={destaque("triagem")} href={`/protocolos/${id}/triagem`}>
            {naTriagem.pendente > 0 ? "Continuar triagem" : "Revisar triagem"}
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

      <section
        className={classeDaFase(fase2Liberada && naLeitura.pendente > 0)}
        style={{ marginTop: "1.25rem" }}
      >
        <h2 style={{ fontSize: "1rem", marginTop: 0 }}>Fase 2 — Texto completo</h2>
        <p className="subtitulo" style={{ marginBottom: "0.5rem" }}>
          Recebe quem você incluiu na fase 1. É onde você lê o artigo inteiro.
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
          {fase2Liberada ? (
            <a className={destaque("leitura")} href={`/protocolos/${id}/leitura`}>
              {naLeitura.pendente > 0 ? "Ler textos completos" : "Revisar leitura"}
            </a>
          ) : (
            <span className="botao botao-bloqueado">
              Ler textos completos — inclua ao menos um estudo na fase 1
            </span>
          )}
        </div>
      </section>

      <section
        className={classeDaFase(
          fase3Liberada && naExtracao.completos < naExtracao.estudos,
        )}
        style={{ marginTop: "1.25rem" }}
      >
        <h2 style={{ fontSize: "1rem", marginTop: 0 }}>Fase 3 — Extração</h2>
        <p className="subtitulo" style={{ marginBottom: "0.5rem" }}>
          Recebe quem você incluiu na fase 2. É a tabela final da revisão.
        </p>
        <div className="contadores">
          <span>
            Estudos <strong>{naExtracao.estudos}</strong>
          </span>
          <span>
            Completos <strong>{naExtracao.completos}</strong>
          </span>
          <span>
            Colunas <strong>{naExtracao.campos}</strong>
          </span>
        </div>
        <div className="linha-acoes">
          {fase3Liberada ? (
            <a className={destaque("extracao")} href={`/protocolos/${id}/extracao`}>
              {naExtracao.completos < naExtracao.estudos
                ? "Preencher extração"
                : "Revisar extração"}
            </a>
          ) : (
            <span className="botao botao-bloqueado">
              Preencher extração — inclua ao menos um estudo na fase 2
            </span>
          )}
          <a className={destaque("sintese")} href={`/protocolos/${id}/relatorio`}>
            Ver síntese e exportar
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
