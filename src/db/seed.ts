import { eq } from "drizzle-orm";
import { criarProtocolo } from "../lib/protocolo";
import { db, fecharBanco } from "./client";
import { usuario } from "./schema";

// Protocolo sem dono fica invisível para todo mundo, então o seed precisa
// saber de quem é. A conta tem que existir: ela nasce no primeiro login.
const email = process.argv[2];

if (!email) {
  console.error("Uso: npx tsx src/db/seed.ts <email da conta>");
  process.exit(1);
}

const [dono] = await db
  .select()
  .from(usuario)
  .where(eq(usuario.email, email));

if (!dono) {
  console.error(`Nenhuma conta com o e-mail ${email}. Entre no sistema uma vez para criá-la.`);
  await fecharBanco();
  process.exit(1);
}

const anoAtual = new Date().getFullYear();
const id = await criarProtocolo(dono.id, {
  titulo: "Minha revisão sistemática",
  questaoPesquisa: "Qual a pergunta que esta revisão pretende responder?",
  anoInicio: anoAtual - 5,
  anoFim: anoAtual,
});

console.log(`Protocolo criado para ${email}: ${id}`);
await fecharBanco();
