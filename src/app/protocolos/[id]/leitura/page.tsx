import { notFound } from "next/navigation";
import {
  buscarProtocolo,
  contarPorDecisao,
  LEITURA_COMPLETA,
  listarCriteriosDeExclusao,
  listarCriteriosDeInclusao,
  listarEstudosParaEstagio,
  ROTULO_DO_ESTAGIO,
  TRIAGEM_INICIAL,
} from "@/lib/consultas";
import PainelDeTriagem from "../triagem/PainelDeTriagem";

export default async function PaginaDeLeitura({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const protocolo = buscarProtocolo(id);
  if (!protocolo) notFound();

  const estudos = listarEstudosParaEstagio(id, LEITURA_COMPLETA);
  const naTriagem = contarPorDecisao(id, TRIAGEM_INICIAL);

  return (
    <>
      <header className="cabecalho">
        <div>
          <h1>Fase 2 — {ROTULO_DO_ESTAGIO[LEITURA_COMPLETA]}</h1>
          <p className="subtitulo">
            Leia o artigo inteiro e confirme. Aqui você é rigoroso: é a decisão final.
          </p>
        </div>
        <a className="botao" href={`/protocolos/${id}`}>
          Voltar
        </a>
      </header>

      {estudos.length === 0 ? (
        <div className="cartao vazio">
          <p>Nenhum estudo chegou a esta fase ainda.</p>
          <p className="subtitulo">
            Só entram aqui os incluídos na triagem por título e resumo — hoje{" "}
            {naTriagem.incluido} de {naTriagem.total}, com {naTriagem.pendente}{" "}
            ainda pendente(s).
          </p>
          <a className="botao" href={`/protocolos/${id}/triagem`}>
            Ir para a fase 1
          </a>
        </div>
      ) : (
        <PainelDeTriagem
          protocoloId={id}
          estagio={LEITURA_COMPLETA}
          estudos={estudos}
          criterios={listarCriteriosDeExclusao(id)}
          criteriosDeInclusao={listarCriteriosDeInclusao(id)}
        />
      )}
    </>
  );
}
