import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import { analisarDominios, emailPermitido } from "@/lib/dominio";

const DOMINIOS_PERMITIDOS = analisarDominios(process.env.DOMINIO_PERMITIDO);

export function pertenceAoDominio(email: string | null | undefined): boolean {
  return emailPermitido(email, DOMINIOS_PERMITIDOS);
}

export const configuracaoDeAutenticacao = {
  providers: [Google],
  session: { strategy: "jwt" },
  pages: { signIn: "/entrar" },

  callbacks: {
    signIn({ profile }) {
      return pertenceAoDominio(profile?.email);
    },

    session({ session, token }) {
      if (typeof token.usuarioId === "string") {
        session.user.id = token.usuarioId;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
