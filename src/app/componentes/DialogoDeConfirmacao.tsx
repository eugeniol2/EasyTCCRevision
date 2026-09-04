"use client";

import { useEffect, useRef, type ReactNode } from "react";

interface Props {
  titulo: string;
  rotuloConfirmar: string;
  onConfirmar: () => void;
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

  useEffect(() => {
    botaoConfirmar.current?.focus();

    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === "Escape") {
        evento.preventDefault();
        onCancelar();
      }
      if (evento.key === "Enter") {
        evento.preventDefault();
        onConfirmar();
      }
    }

    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [onConfirmar, onCancelar]);

  return (
    <div className="fundo-modal" role="presentation" onClick={onCancelar}>
      <div
        className="modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="titulo-do-dialogo"
        onClick={(evento) => evento.stopPropagation()}
      >
        <h2 id="titulo-do-dialogo">{titulo}</h2>

        {children}

        <div className="modal-acoes">
          <button type="button" className="botao" onClick={onCancelar}>
            Cancelar <kbd>Esc</kbd>
          </button>
          <button
            ref={botaoConfirmar}
            type="button"
            className="botao botao-perigo"
            onClick={onConfirmar}
          >
            {rotuloConfirmar} <kbd>Enter</kbd>
          </button>
        </div>
      </div>
    </div>
  );
}
