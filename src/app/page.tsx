import { contarEstudos, listarProtocolos } from "@/lib/consultas";

export default async function PaginaInicial() {
  const protocolos = listarProtocolos();

  return (
    <>
      <header className="cabecalho">
        <div>
          <h1>Revisa</h1>
          <p className="subtitulo">Suas revisões sistemáticas</p>
        </div>
      </header>

      {protocolos.length === 0 ? (
        <div className="cartao vazio">
          <p>Nenhum protocolo ainda.</p>
          <p>
            Rode <code>npx tsx src/db/seed.ts</code> para criar um de exemplo.
          </p>
        </div>
      ) : (
        <ul className="lista-limpa">
          {protocolos.map((protocolo) => (
            <li key={protocolo.id} className="cartao">
              <h2 style={{ fontSize: "1.05rem", margin: 0 }}>
                <a href={`/protocolos/${protocolo.id}`}>{protocolo.titulo}</a>
              </h2>
              <p className="subtitulo">{protocolo.questaoPesquisa}</p>
              <div className="contadores">
                <span>
                  Estudos <strong>{contarEstudos(protocolo.id)}</strong>
                </span>
                <span>
                  Recorte{" "}
                  <strong>
                    {protocolo.anoInicio}–{protocolo.anoFim}
                  </strong>
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
