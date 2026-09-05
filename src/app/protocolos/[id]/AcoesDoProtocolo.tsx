"use client";

import { useState } from "react";
import DialogoDeConfirmacao from "@/app/componentes/DialogoDeConfirmacao";
import { descartarTudo, zerarTriagem } from "./acoes";

type AcaoPendente = "zerar" | "descartar" | null;

interface Props {
  protocoloId: string;
  decisoesTomadas: number;
  totalDeEstudos: number;
  buscasRegistradas: number;
}

export default function AcoesDoProtocolo({
  protocoloId,
  decisoesTomadas,
  totalDeEstudos,
  buscasRegistradas,
}: Props) {
  const [acaoPendente, setAcaoPendente] = useState<AcaoPendente>(null);

  async function confirmar() {
    if (acaoPendente === "zerar") await zerarTriagem(protocoloId);
    else if (acaoPendente === "descartar") await descartarTudo(protocoloId);

    setAcaoPendente(null);
  }

  return (
    <>
      <button
        type="button"
        className="botao"
        disabled={decisoesTomadas === 0}
        onClick={() => setAcaoPendente("zerar")}
      >
        Zerar triagem
      </button>

      <button
        type="button"
        className="botao botao-perigo-suave"
        disabled={totalDeEstudos === 0}
        onClick={() => setAcaoPendente("descartar")}
      >
        Descartar tudo
      </button>

      {acaoPendente === "zerar" && (
        <DialogoDeConfirmacao
          titulo="Zerar a triagem?"
          rotuloConfirmar="Zerar decisões"
          onConfirmar={confirmar}
          onCancelar={() => setAcaoPendente(null)}
        >
          <p className="modal-corpo">
            As {decisoesTomadas} decisão(ões) voltam para pendente e a triagem
            recomeça. Não dá para desfazer.
          </p>
          <div className="modal-estudo">
            <p>Os {totalDeEstudos} estudo(s) continuam no protocolo.</p>
            <p className="subtitulo">
              Use isto para refazer a triagem sem reimportar nada.
            </p>
          </div>
        </DialogoDeConfirmacao>
      )}

      {acaoPendente === "descartar" && (
        <DialogoDeConfirmacao
          titulo="Descartar tudo e recomeçar do zero?"
          rotuloConfirmar={`Descartar ${totalDeEstudos} estudo(s)`}
          onConfirmar={confirmar}
          onCancelar={() => setAcaoPendente(null)}
        >
          <p className="modal-corpo">
            Isto apaga o corpus inteiro deste protocolo. Não dá para desfazer,
            e você precisará importar os arquivos novamente.
          </p>
          <div className="modal-estudo">
            <p>
              Serão apagados {totalDeEstudos} estudo(s), {buscasRegistradas}{" "}
              busca(s) e todas as decisões de triagem.
            </p>
            <p className="subtitulo">
              O protocolo e os critérios de inclusão e exclusão permanecem.
            </p>
          </div>
        </DialogoDeConfirmacao>
      )}
    </>
  );
}
