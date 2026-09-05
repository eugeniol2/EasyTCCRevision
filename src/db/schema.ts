import { sql } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const AGORA = sql`extract(epoch from now())::int`;
const LISTA_VAZIA = sql`'[]'::jsonb`;

export interface Autor {
  given?: string;
  family?: string;
  literal?: string;
}

export const usuario = pgTable(
  "usuario",
  {
    id: text("id").primaryKey(),
    googleSub: text("google_sub").notNull(),
    email: text("email").notNull(),
    nome: text("nome"),
    imagem: text("imagem"),
    criadoEm: integer("criado_em").notNull().default(AGORA),
    ultimoAcesso: integer("ultimo_acesso").notNull().default(AGORA),
  },
  (tabela) => ({
    subUnico: uniqueIndex("usuario_google_sub_unq").on(tabela.googleSub),
    porEmail: index("usuario_email_idx").on(tabela.email),
  }),
);

export const protocolo = pgTable("protocolo", {
  id: text("id").primaryKey(),
  usuarioId: text("usuario_id").references(() => usuario.id, {
    onDelete: "cascade",
  }),
  titulo: text("titulo").notNull(),
  questaoPesquisa: text("questao_pesquisa"),
  anoInicio: integer("ano_inicio"),
  anoFim: integer("ano_fim"),
  criadoEm: integer("criado_em").notNull().default(AGORA),
});

export const criterio = pgTable(
  "criterio",
  {
    id: text("id").primaryKey(),
    protocoloId: text("protocolo_id")
      .notNull()
      .references(() => protocolo.id, { onDelete: "cascade" }),
    tipo: text("tipo", { enum: ["inclusao", "exclusao"] }).notNull(),
    codigo: text("codigo").notNull(),
    descricao: text("descricao").notNull(),
    ordem: integer("ordem").notNull().default(0),
  },
  (tabela) => ({
    codigoUnicoPorProtocolo: uniqueIndex("criterio_codigo_unq").on(
      tabela.protocoloId,
      tabela.codigo,
    ),
  }),
);

export const busca = pgTable(
  "busca",
  {
    id: text("id").primaryKey(),
    protocoloId: text("protocolo_id")
      .notNull()
      .references(() => protocolo.id, { onDelete: "cascade" }),
    base: text("base").notNull(),
    stringBusca: text("string_busca").notNull(),
    executadaEm: integer("executada_em").notNull(),
    totalResultados: integer("total_resultados"),
    notas: text("notas"),
    criadoEm: integer("criado_em").notNull().default(AGORA),
  },
  (tabela) => ({
    porProtocolo: index("busca_protocolo_idx").on(tabela.protocoloId),
  }),
);

export const estudo = pgTable(
  "estudo",
  {
    id: text("id").primaryKey(),
    protocoloId: text("protocolo_id")
      .notNull()
      .references(() => protocolo.id, { onDelete: "cascade" }),

    titulo: text("titulo").notNull(),
    tituloNorm: text("titulo_norm").notNull(),
    autores: jsonb("autores")
      .$type<Autor[]>()
      .notNull()
      .default(LISTA_VAZIA),
    ano: integer("ano"),
    mes: integer("mes"),
    veiculo: text("veiculo"),
    palavrasChave: jsonb("palavras_chave")
      .$type<string[]>()
      .notNull()
      .default(LISTA_VAZIA),
    tipo: text("tipo"),

    doi: text("doi"),
    doiNorm: text("doi_norm"),
    url: text("url"),
    resumo: text("resumo"),

    bibtexRaw: text("bibtex_raw"),
    chaveBibtex: text("chave_bibtex"),

    criadoEm: integer("criado_em").notNull().default(AGORA),
  },
  (tabela) => ({
    doiUnicoPorProtocolo: uniqueIndex("estudo_doi_unq")
      .on(tabela.protocoloId, tabela.doiNorm)
      .where(sql`doi_norm is not null`),
    porTituloNormalizado: index("estudo_titulo_norm_idx").on(
      tabela.protocoloId,
      tabela.tituloNorm,
    ),
  }),
);

export const estudoBusca = pgTable(
  "estudo_busca",
  {
    estudoId: text("estudo_id")
      .notNull()
      .references(() => estudo.id, { onDelete: "cascade" }),
    buscaId: text("busca_id")
      .notNull()
      .references(() => busca.id, { onDelete: "cascade" }),
  },
  (tabela) => ({
    chave: primaryKey({ columns: [tabela.estudoId, tabela.buscaId] }),
  }),
);

export const triagem = pgTable(
  "triagem",
  {
    id: text("id").primaryKey(),
    estudoId: text("estudo_id")
      .notNull()
      .references(() => estudo.id, { onDelete: "cascade" }),
    estagio: text("estagio", {
      enum: ["titulo_resumo", "texto_completo"],
    }).notNull(),
    decisao: text("decisao", {
      enum: ["incluido", "excluido", "pendente", "duvida"],
    }).notNull(),
    criterioId: text("criterio_id").references(() => criterio.id, {
      onDelete: "set null",
    }),
    notas: text("notas"),
    decididoEm: integer("decidido_em").notNull().default(AGORA),
  },
  (tabela) => ({
    umaDecisaoPorEstagio: uniqueIndex("triagem_estagio_unq").on(
      tabela.estudoId,
      tabela.estagio,
    ),
    porDecisao: index("triagem_decisao_idx").on(tabela.decisao),
  }),
);

export const atendimento = pgTable(
  "atendimento",
  {
    estudoId: text("estudo_id")
      .notNull()
      .references(() => estudo.id, { onDelete: "cascade" }),
    criterioId: text("criterio_id")
      .notNull()
      .references(() => criterio.id, { onDelete: "cascade" }),
  },
  (tabela) => ({
    chave: primaryKey({ columns: [tabela.estudoId, tabela.criterioId] }),
  }),
);

export const campoExtracao = pgTable(
  "campo_extracao",
  {
    id: text("id").primaryKey(),
    protocoloId: text("protocolo_id")
      .notNull()
      .references(() => protocolo.id, { onDelete: "cascade" }),
    nome: text("nome").notNull(),
    tipo: text("tipo", { enum: ["texto", "booleano", "numero", "opcoes"] })
      .notNull()
      .default("texto"),
    opcoes: jsonb("opcoes").$type<string[]>(),
    ordem: integer("ordem").notNull().default(0),
  },
  (tabela) => ({
    porProtocolo: index("campo_protocolo_idx").on(tabela.protocoloId),
  }),
);

export const extracao = pgTable(
  "extracao",
  {
    estudoId: text("estudo_id")
      .notNull()
      .references(() => estudo.id, { onDelete: "cascade" }),
    campoId: text("campo_id")
      .notNull()
      .references(() => campoExtracao.id, { onDelete: "cascade" }),
    valor: text("valor"),
  },
  (tabela) => ({
    chave: primaryKey({ columns: [tabela.estudoId, tabela.campoId] }),
  }),
);
