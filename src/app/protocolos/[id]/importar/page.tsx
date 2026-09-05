import { notFound } from "next/navigation";
import { buscarProtocolo } from "@/lib/consultas";
import FormularioDeImportacao from "./FormularioDeImportacao";

export default async function PaginaDeImportacao({
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
          <h1>Importar estudos</h1>
          <p className="subtitulo">{protocolo.titulo}</p>
        </div>
      </header>

      <p className="subtitulo" style={{ marginBottom: "1.25rem" }}>
        A base, a string e a data são obrigatórias porque é o que torna a busca
        reproduzível — e é o que não dá para recuperar depois.
      </p>

      <FormularioDeImportacao protocoloId={id} />
    </>
  );
}
