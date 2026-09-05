import { readFileSync } from "node:fs";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

function urlDoBanco(): string {
  const doAmbiente = process.env.DATABASE_URL;
  if (doAmbiente) return doAmbiente;

  // Em scripts locais o .env.local não é carregado automaticamente. Em
  // produção o arquivo não existe, e o erro de leitura esconderia a causa
  // real, que é a variável não ter sido definida no provedor.
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

// Em serverless cada invocação vive em seu próprio processo: um pool de 5 por
// instância multiplica conexões contra o Neon sem ganho nenhum, já que uma
// requisição só usa uma por vez.
const CONEXOES_SIMULTANEAS = process.env.VERCEL ? 1 : 5;

// O Next em desenvolvimento reavalia módulos a cada alteração; sem o cache
// global, cada recarga abriria um novo pool contra o Neon.
const conexao =
  conexoesPorProcesso.conexaoPostgres ??
  postgres(urlDoBanco(), { max: CONEXOES_SIMULTANEAS });

if (process.env.NODE_ENV !== "production") {
  conexoesPorProcesso.conexaoPostgres = conexao;
}

export const db = drizzle(conexao, { schema });

export async function fecharBanco(): Promise<void> {
  await conexao.end();
}
