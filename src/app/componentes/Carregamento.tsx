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

/**
 * O indicador global responde "algo está acontecendo?", que é a pergunta de
 * quem clicou e não viu nada mudar. Ele não bloqueia a tela: quem impede o
 * clique repetido é o próprio botão, que se desabilita enquanto sua ação
 * corre. Um véu sobre tudo tornaria a triagem, onde cada decisão é gravada em
 * segundo plano, lenta de usar sem necessidade.
 */
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

/**
 * Substitui o `useTransition` cru nos pontos que chamam server actions: além
 * do estado local para desabilitar o botão, anuncia a ação ao indicador
 * global. A contagem cai sozinha quando a ação termina ou quando o componente
 * sai da tela no meio dela.
 */
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
