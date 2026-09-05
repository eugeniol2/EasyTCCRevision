import { notFound } from "next/navigation";
import {
  buscarProtocolo,
  listarCriteriosDeExclusao,
  listarEstudosParaEstagio,
  ROTULO_DO_ESTAGIO,
  TRIAGEM_INICIAL,
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

  const criterios = listarCriteriosDeExclusao(id);

  return (
    <>
      <header className="cabecalho">
        <div>
          <h1>Fase 1 — {ROTULO_DO_ESTAGIO[TRIAGEM_INICIAL]}</h1>
          <p className="subtitulo">
            Decida pelo título e pelo resumo, sem abrir o artigo. Na dúvida, inclua.
          </p>
        </div>
        <a className="botao" href={`/protocolos/${id}`}>
          Voltar
        </a>
      </header>

      {criterios.length === 0 ? (
        <div className="aviso">
          Este protocolo não tem critérios de exclusão.{" "}
          <a href={`/protocolos/${id}/protocolo`}>Defina os critérios</a> antes de
          triar — sem eles não é possível registrar o motivo de uma exclusão.
        </div>
      ) : (
        <PainelDeTriagem
          protocoloId={id}
          estagio={TRIAGEM_INICIAL}
          estudos={listarEstudosParaEstagio(id, TRIAGEM_INICIAL)}
          criterios={criterios}
          criteriosDeInclusao={[]}
        />
      )}
    </>
  );
}
