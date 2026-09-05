import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";

export default async function PaginaDeEntrada({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const sessao = await auth();
  if (sessao?.user?.id) redirect("/");

  const { erro } = await searchParams;
  const dominio = process.env.DOMINIO_PERMITIDO;

  return (
    <div className="cartao entrada">
      <h1>Revisa</h1>
      <p className="subtitulo">
        Organize sua revisão sistemática: protocolo, buscas, triagem, extração e
        a tabela final do TCC.
      </p>

      {erro && (
        <div className="aviso">
          Não foi possível entrar
          {dominio ? ` — use sua conta @${dominio}.` : "."}
        </div>
      )}

      <form
        action={async () => {
          "use server";
          await signIn("google", { redirectTo: "/" });
        }}
      >
        <button type="submit" className="botao botao-primario">
          Entrar com Google
        </button>
      </form>

      {dominio && (
        <p className="subtitulo">Acesso restrito a contas @{dominio}.</p>
      )}
    </div>
  );
}
