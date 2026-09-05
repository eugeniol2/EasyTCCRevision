import { protocoloDaPagina } from "@/lib/autorizacao";
import { montarTabelaDeTrabalhos } from "@/lib/relatorio";
import TabelaExploravel from "./TabelaExploravel";

export default async function PaginaDaTabela({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const protocolo = await protocoloDaPagina(id);

  const tabela = await montarTabelaDeTrabalhos(id);

  return (
    <div className="tela-cheia">
      <a className="voltar" href={`/protocolos/${id}/relatorio`}>
        ← Voltar à síntese
      </a>

      <header className="cabecalho">
        <div>
          <h1>Trabalhos relacionados</h1>
          <p className="subtitulo">
            {tabela.linhas.length} estudo(s) incluído(s) · {protocolo.titulo}
          </p>
        </div>
      </header>

      {tabela.linhas.length === 0 ? (
        <div className="cartao vazio">
          <p>Nenhum estudo incluído na fase 2 ainda.</p>
          <a className="botao" href={`/protocolos/${id}/leitura`}>
            Ir para a fase 2
          </a>
        </div>
      ) : (
        <TabelaExploravel tabela={tabela} />
      )}
    </div>
  );
}
