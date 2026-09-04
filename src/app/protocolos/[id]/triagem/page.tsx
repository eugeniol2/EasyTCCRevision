import { notFound } from "next/navigation";
import {
  buscarProtocolo,
  listarCriteriosDeExclusao,
  listarEstudosParaTriagem,
} from "@/lib/consultas";
import PainelDeTriagem from "./PainelDeTriagem";

export default async function PaginaDeTriagem({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const protocolo = buscarProtocolo(id);
  if (!protocolo) notFound();

  const estudos = listarEstudosParaTriagem(id);
  const criterios = listarCriteriosDeExclusao(id);

  return (
    <>
      <header className="cabecalho">
        <div>
          <h1>Triagem</h1>
          <p className="subtitulo">{protocolo.titulo}</p>
        </div>
        <a className="botao" href={`/protocolos/${id}`}>
          Voltar
        </a>
      </header>

      {criterios.length === 0 ? (
        <div className="aviso">
          Este protocolo não tem critérios de exclusão cadastrados, então não é
          possível registrar o motivo de uma exclusão.
        </div>
      ) : (
        <PainelDeTriagem protocoloId={id} estudos={estudos} criterios={criterios} />
      )}
    </>
  );
}
