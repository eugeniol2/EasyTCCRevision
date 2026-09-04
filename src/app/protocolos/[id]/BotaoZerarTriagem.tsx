"use client";

import { useState, useTransition } from "react";
import DialogoDeConfirmacao from "@/app/componentes/DialogoDeConfirmacao";
import { zerarTriagem } from "./acoes";

interface Props {
  protocoloId: string;
  decisoesTomadas: number;
  totalDeEstudos: number;
  buscasRegistradas: number;
}

export default function BotaoZerarTriagem({
  protocoloId,
  decisoesTomadas,
  totalDeEstudos,
  buscasRegistradas,
}: Props) {
  const [confirmando, setConfirmando] = useState(false);
  const [zerando, iniciarZeramento] = useTransition();

  function confirmar() {
    setConfirmando(false);
    iniciarZeramento(() => {
      void zerarTriagem(protocoloId);
    });
  }

  return (
    <>
      <button
        type="button"
        className="botao"
        disabled={decisoesTomadas === 0 || zerando}
        onClick={() => setConfirmando(true)}
      >
        {zerando ? "Zerando..." : "Zerar triagem"}
      </button>

      {confirmando && (
        <DialogoDeConfirmacao
          titulo="Zerar a triagem?"
          rotuloConfirmar={`Zerar ${decisoesTomadas} decisão(ões)`}
          onConfirmar={confirmar}
          onCancelar={() => setConfirmando(false)}
        >
          <p className="modal-corpo">
            Todas as decisões voltam para pendente e a triagem recomeça do
            zero. Não dá para desfazer.
          </p>

          <div className="modal-estudo">
            <p>Serão apagadas {decisoesTomadas} decisão(ões).</p>
            <p className="subtitulo">
              Os {totalDeEstudos} estudo(s) importado(s) e as{" "}
              {buscasRegistradas} busca(s) registrada(s) permanecem.
            </p>
          </div>
        </DialogoDeConfirmacao>
      )}
    </>
  );
}
