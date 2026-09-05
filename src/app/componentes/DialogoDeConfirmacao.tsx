"use client";

import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { Girando, useAcao } from "./Carregamento";

interface Props {
  titulo: string;
  rotuloConfirmar: string;
  onConfirmar: () => void | Promise<void>;
  onCancelar: () => void;
  children: ReactNode;
}

export default function DialogoDeConfirmacao({
  titulo,
  rotuloConfirmar,
  onConfirmar,
  onCancelar,
  children,
}: Props) {
  const botaoCancelar = useRef<HTMLButtonElement>(null);
  const [confirmando, iniciar] = useAcao();

  // Confirmar é o clique que apaga coisas: enquanto a ação corre, o diálogo
  // continua na tela mostrando que trabalha, e não aceita um segundo clique
  // nem o fechamento pelo fundo.
  const confirmar = useCallback(() => {
    if (confirmando) return;
    iniciar(async () => {
      await onConfirmar();
    });
  }, [confirmando, iniciar, onConfirmar]);

  // O foco vai para o botão seguro. Um botão focado é acionado por Enter ou
  // espaço pelo próprio navegador, então deixá-lo no lado destrutivo faria a
  // tecla apagar coisas mesmo sem atalho nenhum no código.
  useEffect(() => {
    botaoCancelar.current?.focus();
  }, []);

  return (
    <div
      className="fundo-modal"
      role="presentation"
      onClick={() => {
        if (!confirmando) onCancelar();
      }}
    >
      <div
        className="modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="titulo-do-dialogo"
        aria-busy={confirmando}
        onClick={(evento) => evento.stopPropagation()}
      >
        <h2 id="titulo-do-dialogo">{titulo}</h2>

        {children}

        <div className="modal-acoes">
          <button
            ref={botaoCancelar}
            type="button"
            className="botao"
            onClick={onCancelar}
            disabled={confirmando}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="botao botao-perigo"
            onClick={confirmar}
            disabled={confirmando}
          >
            {confirmando ? (
              <>
                <Girando />
                Processando…
              </>
            ) : (
              rotuloConfirmar
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
