import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { buscarProtocolo } from "@/lib/consultas";
import {
  campoEDoProtocolo,
  criterioEDoProtocolo,
  estudoEDoProtocolo,
  protocoloEDoUsuario,
} from "@/lib/pertencimento";

export async function usuarioAtual(): Promise<string> {
  const sessao = await auth();
  const usuarioId = sessao?.user?.id;
  if (!usuarioId) redirect("/entrar");

  return usuarioId;
}

export async function protocoloDaPagina(protocoloId: string) {
  const usuarioId = await usuarioAtual();
  const encontrado = await buscarProtocolo(protocoloId);
  if (!encontrado || encontrado.usuarioId !== usuarioId) notFound();

  return encontrado;
}

class SemAcesso extends Error {
  constructor() {
    super("Sem acesso a este item.");
    this.name = "SemAcesso";
  }
}

export async function exigirProtocolo(protocoloId: string): Promise<void> {
  const usuarioId = await usuarioAtual();
  if (!(await protocoloEDoUsuario(protocoloId, usuarioId))) throw new SemAcesso();
}

export async function exigirEstudo(
  protocoloId: string,
  estudoId: string,
): Promise<void> {
  const usuarioId = await usuarioAtual();
  if (!(await estudoEDoProtocolo(protocoloId, usuarioId, estudoId))) {
    throw new SemAcesso();
  }
}

export async function exigirCampo(
  protocoloId: string,
  campoId: string,
): Promise<void> {
  const usuarioId = await usuarioAtual();
  if (!(await campoEDoProtocolo(protocoloId, usuarioId, campoId))) {
    throw new SemAcesso();
  }
}

export async function exigirCriterio(
  protocoloId: string,
  criterioId: string | null,
): Promise<void> {
  if (criterioId === null) return await exigirProtocolo(protocoloId);

  const usuarioId = await usuarioAtual();
  if (!(await criterioEDoProtocolo(protocoloId, usuarioId, criterioId))) {
    throw new SemAcesso();
  }
}
