import { notFound } from "next/navigation";
import { buscarProtocolo } from "@/lib/consultas";
import {
  listarEstudosIncluidos,
  montarPrisma,
  montarTabelaDeTrabalhos,
  tabelaEmLatex,
  textoDaMetodologia,
} from "@/lib/relatorio";
import BlocoCopiavel from "./BlocoCopiavel";
import TabelaDeTrabalhos from "./TabelaDeTrabalhos";

export default async function PaginaDeRelatorio({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const protocolo = buscarProtocolo(id);
  if (!protocolo) notFound();

  const prisma = montarPrisma(id);
  const incluidos = listarEstudosIncluidos(id);

  const etapas = [
    { rotulo: "Registros identificados nas buscas", valor: prisma.identificados },
    { rotulo: "Duplicatas removidas", valor: prisma.duplicatasRemovidas },
    { rotulo: "Triados por título e resumo", valor: prisma.triados },
    { rotulo: "Excluídos na triagem", valor: prisma.excluidosNaTriagem },
    { rotulo: "Avaliados por texto completo", valor: prisma.avaliadosPorTextoCompleto },
    { rotulo: "Excluídos na leitura completa", valor: prisma.excluidosNaLeitura },
    { rotulo: "Incluídos na revisão", valor: prisma.incluidos },
  ];

  const pendencias = prisma.pendentesNaTriagem + prisma.pendentesNaLeitura;

  return (
    <>
      <header className="cabecalho">
        <div>
          <h1>Síntese</h1>
          <p className="subtitulo">
            Os números e os textos prontos para o capítulo de metodologia.
          </p>
        </div>
        <a className="botao" href={`/protocolos/${id}`}>
          Voltar
        </a>
      </header>

      {pendencias > 0 && (
        <div className="aviso">
          Há {pendencias} estudo(s) ainda sem decisão. Os números abaixo mudam
          conforme você termina a triagem.
        </div>
      )}

      <section className="cartao">
        <h2 style={{ fontSize: "1rem", margin: "0 0 0.75rem" }}>Fluxo PRISMA</h2>
        <table className="tabela">
          <tbody>
            {etapas.map((etapa) => (
              <tr key={etapa.rotulo}>
                <td>{etapa.rotulo}</td>
                <td style={{ width: "1%", textAlign: "right" }}>
                  <strong>{etapa.valor}</strong>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {prisma.excluidosPorCriterioNaTriagem.length > 0 && (
          <>
            <h3 style={{ fontSize: "0.9rem", margin: "1.25rem 0 0.5rem" }}>
              Exclusões por critério — triagem
            </h3>
            <table className="tabela">
              <tbody>
                {prisma.excluidosPorCriterioNaTriagem.map((item) => (
                  <tr key={item.codigo}>
                    <td>
                      <strong>{item.codigo}</strong> — {item.descricao}
                    </td>
                    <td style={{ width: "1%", textAlign: "right" }}>
                      <strong>{item.quantidade}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {prisma.excluidosPorCriterioNaLeitura.length > 0 && (
          <>
            <h3 style={{ fontSize: "0.9rem", margin: "1.25rem 0 0.5rem" }}>
              Exclusões por critério — leitura completa
            </h3>
            <table className="tabela">
              <tbody>
                {prisma.excluidosPorCriterioNaLeitura.map((item) => (
                  <tr key={item.codigo}>
                    <td>
                      <strong>{item.codigo}</strong> — {item.descricao}
                    </td>
                    <td style={{ width: "1%", textAlign: "right" }}>
                      <strong>{item.quantidade}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </section>

      <BlocoCopiavel
        titulo="Texto da metodologia"
        ajuda="Com as bases, datas e contagens já preenchidas."
        conteudo={textoDaMetodologia(id)}
        vazio="Registre ao menos uma busca para gerar o texto."
      />

      <TabelaDeTrabalhos
        tituloDaRevisao={protocolo.titulo}
        tabela={montarTabelaDeTrabalhos(id)}
        latex={tabelaEmLatex(id, protocolo.titulo)}
      />

      <section className="cartao" style={{ marginTop: "1.25rem" }}>
        <h2 style={{ fontSize: "1rem", margin: 0 }}>Estudos incluídos</h2>
        <p className="subtitulo" style={{ marginBottom: "0.9rem" }}>
          Monte suas referências a partir daqui. O link leva ao registro na
          editora, que é a fonte confiável dos dados de citação.
        </p>

        {incluidos.length === 0 ? (
          <p className="subtitulo">Nenhum estudo incluído na fase 2 ainda.</p>
        ) : (
          <ol className="lista-incluidos">
            {incluidos.map((item) => (
              <li key={item.id}>
                <span className="titulo-incluido">{item.titulo}</span>
                <div className="subtitulo">
                  {item.autores} · {item.ano ?? "s/ ano"}
                  {item.veiculo ? ` · ${item.veiculo}` : ""}
                </div>
                {item.url ? (
                  <a href={item.url} target="_blank" rel="noopener noreferrer">
                    {item.doi ?? item.url}
                  </a>
                ) : (
                  <span className="subtitulo">Sem link registrado.</span>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>
    </>
  );
}
