import { notFound } from "next/navigation";
import { buscarProtocolo } from "@/lib/consultas";
import { listarCriteriosEditaveis } from "@/lib/protocolo";
import EditorDoProtocolo from "./EditorDoProtocolo";

export default async function PaginaDoProtocoloEditavel({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const protocolo = buscarProtocolo(id);
  if (!protocolo) notFound();

  return (
    <>
      <header className="cabecalho">
        <div>
          <h1>Protocolo</h1>
          <p className="subtitulo">
            Pergunta de pesquisa e critérios de seleção — definidos antes da triagem,
            editáveis a qualquer momento.
          </p>
        </div>
        <a className="botao" href={`/protocolos/${id}`}>
          Voltar
        </a>
      </header>

      <EditorDoProtocolo
        protocoloId={id}
        titulo={protocolo.titulo}
        questaoPesquisa={protocolo.questaoPesquisa}
        anoInicio={protocolo.anoInicio}
        anoFim={protocolo.anoFim}
        criterios={listarCriteriosEditaveis(id)}
      />
    </>
  );
}
