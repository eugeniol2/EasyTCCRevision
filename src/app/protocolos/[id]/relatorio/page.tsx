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
      <a className="voltar" href={`/protocolos/${id}`}>
        ← Voltar ao protocolo
      </a>

      <header className="cabecalho">
        <div>
          <h1>Síntese</h1>
          <p className="subtitulo">
            O fluxo PRISMA e os textos prontos para colar no seu capítulo de
            metodologia.
          </p>
        </div>
      </header>

      {pendencias > 0 && (
        <a
          className="aviso aviso-clicavel"
          href={`/protocolos/${id}/${
            prisma.pendentesNaTriagem > 0 ? "triagem" : "leitura"
          }`}
        >
          <strong>
            {`Há ${pendencias} estudo(s) ainda sem decisão na fase ${
              prisma.pendentesNaTriagem > 0 ? 1 : 2
            }.`}
          </strong>{" "}
          Os números abaixo mudam conforme você termina. Clique para continuar de
          onde parou. →
        </a>
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
        protocoloId={id}
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
