import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { DESCRICAO_DO_SITE, NOME_DO_SITE, urlDoSite } from "@/lib/site";
import { ProvedorDeCarregamento } from "./componentes/Carregamento";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(urlDoSite()),
  title: {
    default: `${NOME_DO_SITE} — revisão sistemática da literatura`,
    template: `%s · ${NOME_DO_SITE}`,
  },
  description: DESCRICAO_DO_SITE,
  applicationName: NOME_DO_SITE,
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: NOME_DO_SITE,
    url: "/",
    title: `${NOME_DO_SITE} — revisão sistemática da literatura`,
    description: DESCRICAO_DO_SITE,
  },
  twitter: {
    card: "summary_large_image",
    title: `${NOME_DO_SITE} — revisão sistemática da literatura`,
    description: DESCRICAO_DO_SITE,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfaf8" },
    { media: "(prefers-color-scheme: dark)", color: "#161513" },
  ],
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
