import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

const ARQUIVO_DO_BANCO = process.env.DATABASE_FILE ?? "revisa.db";

const conexoesPorProcesso = globalThis as unknown as {
  conexaoSqlite?: Database.Database;
};

function abrirConexao(): Database.Database {
  const conexao = new Database(ARQUIVO_DO_BANCO);
  conexao.pragma("journal_mode = WAL");
  conexao.pragma("foreign_keys = ON");
  return conexao;
}

const conexao = conexoesPorProcesso.conexaoSqlite ?? abrirConexao();

if (process.env.NODE_ENV !== "production") {
  conexoesPorProcesso.conexaoSqlite = conexao;
}

export const db = drizzle(conexao, { schema });

export function fecharBanco(): void {
  if (conexao.open) conexao.close();
}
