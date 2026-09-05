import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import { analisarDominios, emailPermitido } from "@/lib/dominio";

const DOMINIOS_PERMITIDOS = analisarDominios(process.env.DOMINIO_PERMITIDO);

export function pertenceAoDominio(email: string | null | undefined): boolean {
  return emailPermitido(email, DOMINIOS_PERMITIDOS);
}

/**
 * A parte da configuração que o middleware consegue executar: o Edge Runtime
 * não carrega `node:crypto` nem o driver do Postgres, então nada aqui pode
 * tocar o banco. O callback que grava o usuário vive em `auth.ts`, que só roda
 * no runtime Node.
 */
export const configuracaoDeAutenticacao = {
  providers: [Google],
  session: { strategy: "jwt" },
  pages: { signIn: "/entrar" },

  callbacks: {
    /**
     * O app é interno na organização, então o Google já barra quem é de fora.
     * A checagem aqui é redundante de propósito: se um dia o consentimento
     * mudar para externo, o domínio continua exigido.
     */
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
