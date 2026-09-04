import { eq } from "drizzle-orm";
import { db, fecharBanco } from "../src/db/client";
import { estudo } from "../src/db/schema";
import { parseAutores } from "../src/lib/bibtex/autores";
import { parseBibtex } from "../src/lib/bibtex/parser";
import { extrairMes, extrairPalavrasChave } from "../src/lib/publicacao";

const registros = db
  .select({
    id: estudo.id,
    autores: estudo.autores,
    mes: estudo.mes,
    palavrasChave: estudo.palavrasChave,
    bibtexRaw: estudo.bibtexRaw,
  })
  .from(estudo)
  .all();

let atualizados = 0;

for (const registro of registros) {
  if (!registro.bibtexRaw?.trimStart().startsWith("@")) continue;

  const campos = parseBibtex(registro.bibtexRaw).entradas[0]?.campos;
  if (!campos) continue;

  const mes = registro.mes ?? extrairMes(campos.month ?? campos.date);
  const palavrasChave =
    registro.palavrasChave.length > 0
      ? registro.palavrasChave
      : extrairPalavrasChave(campos.keywords ?? campos.keyword);
  const autores = parseAutores(campos.author ?? campos.editor);

  const nadaMudou =
    mes === registro.mes &&
    palavrasChave.length === registro.palavrasChave.length &&
    JSON.stringify(autores) === JSON.stringify(registro.autores);
  if (nadaMudou) continue;

  db.update(estudo)
    .set({ mes, palavrasChave, autores })
    .where(eq(estudo.id, registro.id))
    .run();
  atualizados++;
}

console.log(`${registros.length} estudo(s) verificado(s), ${atualizados} atualizado(s).`);
fecharBanco();
