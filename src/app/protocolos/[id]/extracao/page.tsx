import { protocoloDaPagina } from "@/lib/autorizacao";
import { contarPorDecisao, LEITURA_COMPLETA } from "@/lib/consultas";
import {
  listarCampos,
  listarEstudosParaExtracao,
  medirProgresso,
} from "@/lib/extracao";
import PainelDeExtracao from "./PainelDeExtracao";

export default async function PaginaDeExtracao({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const protocolo = await protocoloDaPagina(id);

  const estudos = await listarEstudosParaExtracao(id);
  const naLeitura = await contarPorDecisao(id, LEITURA_COMPLETA);
  const progresso = await medirProgresso(id);
  const concluida = progresso.estudos > 0 && progresso.completos === progresso.estudos;

  return (
    <>
      <a
        className={`voltar${concluida ? " voltar-destacado" : ""}`}
        href={`/protocolos/${id}`}
      >
        ← {concluida ? "Extração completa — voltar ao protocolo" : "Voltar ao protocolo"}
      </a>

      <header className="cabecalho">
        <div>
          <h1>Fase 3 — Extração</h1>
          <p className="subtitulo">
            Entram os estudos que sobreviveram à fase 2 — o conjunto final da revisão.
            Aqui você monta a tabela que vai para o TCC: autores, ano e veículo já
            vieram das bases; objetivo, metodologia e resultados só você escreve.
          </p>
        </div>
      </header>

      {estudos.length === 0 ? (
        <div className="cartao vazio">
          <p>Nenhum estudo foi incluído na leitura de texto completo ainda.</p>
          <p className="subtitulo">
            Esta fase trabalha sobre o conjunto final da revisão. Na fase 2 você
            incluiu {naLeitura.incluido} de {naLeitura.total}, com{" "}
            {naLeitura.pendente} ainda sem decisão.
          </p>
          <a className="botao" href={`/protocolos/${id}/leitura`}>
            Ir para a fase 2
          </a>
        </div>
      ) : (
        <PainelDeExtracao
          protocoloId={id}
          estudos={estudos}
          campos={await listarCampos(id)}
        />
      )}
    </>
  );
}
