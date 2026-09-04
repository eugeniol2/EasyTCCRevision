import { notFound } from "next/navigation";
import { buscarProtocolo, contarPorDecisao, LEITURA_COMPLETA } from "@/lib/consultas";
import { listarCampos, listarEstudosParaExtracao } from "@/lib/extracao";
import PainelDeExtracao from "./PainelDeExtracao";

export default async function PaginaDeExtracao({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const protocolo = buscarProtocolo(id);
  if (!protocolo) notFound();

  const estudos = listarEstudosParaExtracao(id);
  const naLeitura = contarPorDecisao(id, LEITURA_COMPLETA);

  return (
    <>
      <header className="cabecalho">
        <div>
          <h1>Fase 3 — Extração</h1>
          <p className="subtitulo">
            Os dados de cada estudo incluído. Autores, ano e veículo já vêm
            preenchidos; o resto exige sua leitura.
          </p>
        </div>
        <a className="botao" href={`/protocolos/${id}`}>
          Voltar
        </a>
      </header>

      {estudos.length === 0 ? (
        <div className="cartao vazio">
          <p>Nenhum estudo foi incluído na leitura de texto completo ainda.</p>
          <p className="subtitulo">
            A extração trabalha sobre o conjunto final: hoje {naLeitura.incluido} de{" "}
            {naLeitura.total} na fase 2, com {naLeitura.pendente} pendente(s).
          </p>
          <a className="botao" href={`/protocolos/${id}/leitura`}>
            Ir para a fase 2
          </a>
        </div>
      ) : (
        <PainelDeExtracao
          protocoloId={id}
          estudos={estudos}
          campos={listarCampos(id)}
        />
      )}
    </>
  );
}
