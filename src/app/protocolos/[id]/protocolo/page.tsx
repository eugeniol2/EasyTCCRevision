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
      <a className="voltar" href={`/protocolos/${id}`}>
        ← Voltar ao protocolo
      </a>

      <header className="cabecalho">
        <div>
          <h1>Protocolo</h1>
          <p className="subtitulo">
            O que você procura e as regras para decidir. Vale definir antes de
            começar a triagem, mas dá para ajustar a qualquer momento.
          </p>
        </div>
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
