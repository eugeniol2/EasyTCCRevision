import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { usuario } from "@/db/schema";

export interface UsuarioAutenticado {
  id: string;
  email: string;
  nome: string | null;
  imagem: string | null;
}

export async function registrarAcesso(dados: {
  googleSub: string;
  email: string;
  nome: string | null;
  imagem: string | null;
}): Promise<UsuarioAutenticado> {
  const agora = Math.floor(Date.now() / 1000);

  const [salvo] = await db
    .insert(usuario)
    .values({
      id: randomUUID(),
      googleSub: dados.googleSub,
      email: dados.email,
      nome: dados.nome,
      imagem: dados.imagem,
      ultimoAcesso: agora,
    })
    .onConflictDoUpdate({
      target: usuario.googleSub,
      set: {
        email: dados.email,
        nome: dados.nome,
        imagem: dados.imagem,
        ultimoAcesso: agora,
      },
    })
    .returning();

  return {
    id: salvo!.id,
    email: salvo!.email,
    nome: salvo!.nome,
    imagem: salvo!.imagem,
  };
}

export async function buscarUsuario(id: string): Promise<UsuarioAutenticado | undefined> {
  const [encontrado] = await db.select().from(usuario).where(eq(usuario.id, id));
  if (!encontrado) return undefined;

  return {
    id: encontrado.id,
    email: encontrado.email,
    nome: encontrado.nome,
    imagem: encontrado.imagem,
  };
}
