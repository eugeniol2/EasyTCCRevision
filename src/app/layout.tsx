import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ProvedorDeCarregamento } from "./componentes/Carregamento";
import "./globals.css";

export const metadata: Metadata = {
  title: "Revisa",
  description: "Organizador de revisão sistemática da literatura",
};

export default function LayoutRaiz({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <ProvedorDeCarregamento>
          <div className="container">{children}</div>
        </ProvedorDeCarregamento>
      </body>
    </html>
  );
}
