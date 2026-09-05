import NextAuth from "next-auth";
import { configuracaoDeAutenticacao } from "@/auth.config";

// Instância própria, sem o callback que grava no banco: o middleware apenas
// decodifica o token que o login já emitiu.
const { auth } = NextAuth(configuracaoDeAutenticacao);

export default auth((requisicao) => {
  const autenticado = Boolean(requisicao.auth?.user?.id);
  const naTelaDeEntrada = requisicao.nextUrl.pathname === "/entrar";

  if (!autenticado && !naTelaDeEntrada) {
    return Response.redirect(new URL("/entrar", requisicao.nextUrl));
  }
});

export const config = {
  // Tudo exceto arquivos estáticos e as próprias rotas de autenticação.
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
