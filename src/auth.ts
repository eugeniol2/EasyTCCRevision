import NextAuth from "next-auth";
import { configuracaoDeAutenticacao, pertenceAoDominio } from "@/auth.config";
import { registrarAcesso } from "@/lib/usuarios";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...configuracaoDeAutenticacao,

  callbacks: {
    ...configuracaoDeAutenticacao.callbacks,

    async jwt({ token, profile }) {
      if (!profile?.sub || !profile.email) return token;
      if (!pertenceAoDominio(profile.email)) return token;

      const usuario = await registrarAcesso({
        googleSub: profile.sub,
        email: profile.email,
        nome: profile.name ?? null,
        imagem: (profile.picture as string | undefined) ?? null,
      });

      token.usuarioId = usuario.id;
      return token;
    },
  },
});
