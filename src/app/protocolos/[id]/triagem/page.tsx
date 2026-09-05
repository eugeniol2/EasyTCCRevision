import { notFound } from "next/navigation";
import {
  buscarProtocolo,
  contarPorDecisao,
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
  const concluida =
    contarPorDecisao(id, TRIAGEM_INICIAL).pendente === 0;

  return (
    <>
      <a
        className={`voltar${concluida ? " voltar-destacado" : ""}`}
        href={`/protocolos/${id}`}
      >
        ← {concluida ? "Fase concluída — voltar ao protocolo" : "Voltar ao protocolo"}
      </a>

      <header className="cabecalho">
        <div>
          <h1>Fase 1 — {ROTULO_DO_ESTAGIO[TRIAGEM_INICIAL]}</h1>
          <p className="subtitulo">
            Entram todos os estudos importados. Leia só o título e o resumo — não abra o
            artigo ainda — e descarte o que claramente não serve. Na dúvida, inclua:
            o que sobra você reavalia na fase 2, mas o que sai aqui não volta.
          </p>
        </div>
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
