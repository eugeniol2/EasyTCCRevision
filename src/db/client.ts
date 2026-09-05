import { readFileSync } from "node:fs";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

function urlDoBanco(): string {
  const doAmbiente = process.env.DATABASE_URL;
  if (doAmbiente) return doAmbiente;

  const doArquivo = lerDoArquivoLocal();
  if (!doArquivo) throw new Error("DATABASE_URL não configurada");
  return doArquivo;
}

function lerDoArquivoLocal(): string | undefined {
  try {
    return readFileSync(".env.local", "utf8").match(
      /DATABASE_URL="([^"]+)"/,
    )?.[1];
  } catch {
    return undefined;
  }
}

const conexoesPorProcesso = globalThis as unknown as {
  conexaoPostgres?: ReturnType<typeof postgres>;
};

const CONEXOES_SIMULTANEAS = 5;
const SEGUNDOS_OCIOSO_ATE_FECHAR = 20;

const conexao =
  conexoesPorProcesso.conexaoPostgres ??
  postgres(urlDoBanco(), {
    max: CONEXOES_SIMULTANEAS,
    idle_timeout: SEGUNDOS_OCIOSO_ATE_FECHAR,
  });

if (process.env.NODE_ENV !== "production") {
  conexoesPorProcesso.conexaoPostgres = conexao;
}

export const db = drizzle(conexao, { schema });

export async function fecharBanco(): Promise<void> {
  await conexao.end();
}
