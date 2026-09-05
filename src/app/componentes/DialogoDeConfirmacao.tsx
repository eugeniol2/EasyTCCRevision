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
  const botaoConfirmar = useRef<HTMLButtonElement>(null);
  const [confirmando, iniciar] = useAcao();

  // Confirmar é o clique que apaga coisas: enquanto a ação corre, o diálogo
  // continua na tela mostrando que trabalha, e não aceita um segundo clique
  // nem o fechamento por Esc ou pelo fundo.
  const confirmar = useCallback(() => {
    if (confirmando) return;
    iniciar(async () => {
      await onConfirmar();
    });
  }, [confirmando, iniciar, onConfirmar]);

  useEffect(() => {
    botaoConfirmar.current?.focus();
  }, []);

  useEffect(() => {
    function aoTeclar(evento: KeyboardEvent) {
      if (confirmando) return;

      if (evento.key === "Escape") {
        evento.preventDefault();
        onCancelar();
      }
      if (evento.key === "Enter") {
        evento.preventDefault();
        confirmar();
      }
    }

    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [confirmando, confirmar, onCancelar]);

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
            type="button"
            className="botao"
            onClick={onCancelar}
            disabled={confirmando}
          >
            Cancelar <kbd>Esc</kbd>
          </button>
          <button
            ref={botaoConfirmar}
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
              <>
                {rotuloConfirmar} <kbd>Enter</kbd>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
