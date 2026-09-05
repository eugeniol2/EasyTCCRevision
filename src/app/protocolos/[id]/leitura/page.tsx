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

  const protocolo = await buscarProtocolo(id);
  if (!protocolo) notFound();

  const estudos = await listarEstudosParaEstagio(id, LEITURA_COMPLETA);
  const naTriagem = await contarPorDecisao(id, TRIAGEM_INICIAL);
  const concluida =
    estudos.length > 0 && (await contarPorDecisao(id, LEITURA_COMPLETA)).pendente === 0;

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
          <h1>Fase 2 — {ROTULO_DO_ESTAGIO[LEITURA_COMPLETA]}</h1>
          <p className="subtitulo">
            Entram os estudos que você incluiu na fase 1. Abra e leia cada artigo,
            marcando os critérios de inclusão conforme confirma no texto. Quem
            atender a todos entra na revisão — esta é a decisão final.
          </p>
        </div>
      </header>

      {estudos.length === 0 ? (
        <div className="cartao vazio">
          <p>Nenhum estudo chegou a esta fase ainda.</p>
          <p className="subtitulo">
            Só chegam aqui os estudos que você incluiu na fase 1. Até agora são{" "}
            {naTriagem.incluido} de {naTriagem.total}, com {naTriagem.pendente}{" "}
            ainda sem decisão.
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
          criterios={await listarCriteriosDeExclusao(id)}
          criteriosDeInclusao={await listarCriteriosDeInclusao(id)}
        />
      )}
    </>
  );
}
