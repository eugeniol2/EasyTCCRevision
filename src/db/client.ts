import { readFileSync } from "node:fs";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

function urlDoBanco(): string {
  const doAmbiente = process.env.DATABASE_URL;
  if (doAmbiente) return doAmbiente;

  // Em scripts locais o .env.local não é carregado automaticamente.
  const doArquivo = readFileSync(".env.local", "utf8").match(
    /DATABASE_URL="([^"]+)"/,
  )?.[1];

  if (!doArquivo) throw new Error("DATABASE_URL não configurada");
  return doArquivo;
}

const conexoesPorProcesso = globalThis as unknown as {
  conexaoPostgres?: ReturnType<typeof postgres>;
};

// O Next em desenvolvimento reavalia módulos a cada alteração; sem o cache
// global, cada recarga abriria um novo pool contra o Neon.
const conexao =
  conexoesPorProcesso.conexaoPostgres ?? postgres(urlDoBanco(), { max: 5 });

if (process.env.NODE_ENV !== "production") {
  conexoesPorProcesso.conexaoPostgres = conexao;
}

export const db = drizzle(conexao, { schema });

export async function fecharBanco(): Promise<void> {
  await conexao.end();
}
