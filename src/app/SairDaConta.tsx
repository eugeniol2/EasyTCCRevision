import { signOut } from "@/auth";

export default function SairDaConta({ email }: { email: string }) {
  return (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/entrar" });
      }}
    >
      <button type="submit" className="link-pendente" title="Encerrar a sessão">
        {email} · sair
      </button>
    </form>
  );
}
