"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useTransition,
  type ReactNode,
} from "react";

type Registrar = (variacao: number) => void;

const ContagemDeAcoes = createContext<Registrar>(() => {});

export function ProvedorDeCarregamento({ children }: { children: ReactNode }) {
  const [acoesEmAndamento, setAcoesEmAndamento] = useState(0);

  const registrar = useCallback<Registrar>((variacao) => {
    setAcoesEmAndamento((total) => Math.max(0, total + variacao));
  }, []);

  return (
    <ContagemDeAcoes.Provider value={registrar}>
      {children}
      {acoesEmAndamento > 0 && (
        <div className="indicador-global" role="status" aria-live="polite">
          <Girando />
          <span>Salvando…</span>
        </div>
      )}
    </ContagemDeAcoes.Provider>
  );
}

export function useAcao(): [boolean, (acao: () => void | Promise<void>) => void] {
  const registrar = useContext(ContagemDeAcoes);
  const [executando, iniciar] = useTransition();

  useEffect(() => {
    if (!executando) return;

    registrar(1);
    return () => registrar(-1);
  }, [executando, registrar]);

  return [executando, iniciar];
}

export function Girando({ rotulo }: { rotulo?: string }) {
  return (
    <span
      className="girando"
      role={rotulo ? "status" : undefined}
      aria-label={rotulo}
      aria-hidden={rotulo ? undefined : true}
    />
  );
}
