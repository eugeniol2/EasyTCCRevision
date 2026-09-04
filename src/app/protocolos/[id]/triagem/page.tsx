import { notFound } from "next/navigation";
import {
  buscarProtocolo,
  listarCriteriosDeExclusao,
  listarEstudosParaTriagem,
  type EstagioDeTriagem,
} from "@/lib/consultas";
import PainelDeTriagem from "./PainelDeTriagem";

const ESTAGIOS: Record<EstagioDeTriagem, string> = {
  titulo_resumo: "Título e resumo",
  texto_completo: "Texto completo",
};

function estagioValido(valor: string | undefined): EstagioDeTriagem {
  return valor === "texto_completo" ? "texto_completo" : "titulo_resumo";
}

export default async function PaginaDeTriagem({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ estagio?: string }>;
}) {
  const { id } = await params;
  const { estagio: estagioBruto } = await searchParams;

  const protocolo = buscarProtocolo(id);
  if (!protocolo) notFound();

  const estagio = estagioValido(estagioBruto);
  const estudos = listarEstudosParaTriagem(id, estagio);
  const criterios = listarCriteriosDeExclusao(id);
  const outroEstagio: EstagioDeTriagem =
    estagio === "titulo_resumo" ? "texto_completo" : "titulo_resumo";

  return (
    <>
      <header className="cabecalho">
        <div>
          <h1>Triagem — {ESTAGIOS[estagio]}</h1>
          <p className="subtitulo">{protocolo.titulo}</p>
        </div>
        <div className="linha-acoes" style={{ marginTop: 0 }}>
          <a className="botao" href={`/protocolos/${id}/triagem?estagio=${outroEstagio}`}>
            Ir para {ESTAGIOS[outroEstagio].toLowerCase()}
          </a>
          <a className="botao" href={`/protocolos/${id}`}>
            Voltar
          </a>
        </div>
      </header>

      {criterios.length === 0 ? (
        <div className="aviso">
          Este protocolo não tem critérios de exclusão cadastrados, então não é
          possível registrar o motivo de uma exclusão.
        </div>
      ) : (
        <PainelDeTriagem
          protocoloId={id}
          estagio={estagio}
          estudos={estudos}
          criterios={criterios}
        />
      )}
    </>
  );
}
