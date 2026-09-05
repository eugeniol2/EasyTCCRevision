import NextAuth from "next-auth";
import { configuracaoDeAutenticacao } from "@/auth.config";

const { auth } = NextAuth(configuracaoDeAutenticacao);

export default auth((requisicao) => {
  const autenticado = Boolean(requisicao.auth?.user?.id);
  const naTelaDeEntrada = requisicao.nextUrl.pathname === "/entrar";

  if (!autenticado && !naTelaDeEntrada) {
    return Response.redirect(new URL("/entrar", requisicao.nextUrl));
  }
});

export const config = {
  matcher: [
    "/((?!api/auth|_next/static|_next/image|tutorial/|favicon\\.ico|icon\\.svg|opengraph-image|robots\\.txt).*)",
  ],
};
