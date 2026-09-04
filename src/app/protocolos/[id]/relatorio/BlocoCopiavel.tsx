"use client";

import { useState } from "react";

interface Props {
  titulo: string;
  ajuda: string;
  conteudo: string;
  vazio: string;
}

export default function BlocoCopiavel({ titulo, ajuda, conteudo, vazio }: Props) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    await navigator.clipboard.writeText(conteudo);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  return (
    <section className="cartao" style={{ marginTop: "1.25rem" }}>
      <div className="lista-grupo-topo" style={{ alignItems: "center" }}>
        <div>
          <h2 style={{ fontSize: "1rem", margin: 0 }}>{titulo}</h2>
          <p className="subtitulo">{ajuda}</p>
        </div>
        {conteudo !== "" && (
          <button type="button" className="botao" onClick={() => void copiar()}>
            {copiado ? "Copiado" : "Copiar"}
          </button>
        )}
      </div>

      {conteudo === "" ? (
        <p className="subtitulo">{vazio}</p>
      ) : (
        <pre className="saida">{conteudo}</pre>
      )}
    </section>
  );
}
