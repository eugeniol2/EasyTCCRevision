# Revisa — núcleo

Organizador de revisão sistemática da literatura. Guarda metadado, DOI e
link — **nunca o PDF**, o que elimina o risco de direito autoral e reduz o
problema de durabilidade a um dump de texto.

Este commit tem só o núcleo: modelo de dados e importação de BibTeX. Sem
UI, sem auth, sem servidor.

## Rodar

```bash
npm install
npm run db:push    # cria revisa.db a partir do schema
npm run db:seed    # cria um protocolo com critérios padrão
npm run dev        # http://localhost:3000
```

```bash
npm test           # 46 verificações do núcleo + 21 de integração
npm run db:studio  # navegador de dados do Drizzle
```

O núcleo (`src/lib/bibtex/`, `normalizar`, `dedup`) não depende de Next.js
nem do banco — é TypeScript puro, e `scripts/smoke.ts` roda sem instalar
nada.

## Onde está o quê

| Arquivo | Papel |
|---|---|
| `src/db/schema.ts` | Modelo de dados completo |
| `src/lib/bibtex/parser.ts` | Parser de `.bib` (varredura, não regex) |
| `src/lib/bibtex/latex.ts` | `\~ao` → `ão` |
| `src/lib/bibtex/autores.ts` | Separação e parse de nomes |
| `src/lib/bibtex/paraEstudo.ts` | Entrada BibTeX → domínio |
| `src/lib/normalizar.ts` | DOI/título canônicos, similaridade |
| `src/lib/dedup.ts` | Fusão de duplicatas entre bases |
| `src/lib/importacao.ts` | Importação: parse → dedupe → grava |
| `src/lib/triagem.ts` | Grava e desfaz decisões |
| `src/lib/consultas.ts` | Leituras usadas pelas páginas |
| `src/app/.../triagem/` | A tela de triagem por teclado |

**Server action é só transporte.** Toda regra mora em `src/lib/`, e a
action valida entrada, chama a lib e revalida o cache. É o que permite
testar o caminho real sem subir o Next: `revalidatePath` explode fora de
uma request, então lógica misturada com action é lógica não testável.

## Decisões que não são óbvias no código

O código de `src/` não tem comentários por opção: nomes e funções pequenas
carregam o "o quê". O "porquê" — rationale que nenhum nome consegue
carregar — fica aqui embaixo.

**A string de busca é entidade, não campo.** Cada base tem sintaxe
diferente, e `busca.executadaEm` é obrigatório: é o que torna a revisão
reproduzível, e é o dado que todo mundo esquece de anotar.

**`estudo_busca` é N:N.** O mesmo artigo vem da Scopus *e* da IEEE. Sem
registrar todas as origens não dá para reportar a dedupe no PRISMA. Essa
tabela é a principal razão de o modelo ser relacional e não documento.

**Exclusão aponta o critério (FK).** O PRISMA exige reportar quantos
saíram por cada motivo. Com FK, o relatório é uma query; com texto livre,
é trabalho manual no fim.

**Triagem é histórico, não estado.** Uma linha por estágio, nunca UPDATE
— o caminho até a inclusão é parte do que se reporta.

**Fusão automática exige título idêntico após normalizar.** Nunca
aproximado. "Testes em microsserviços parte I" e "...parte II" dão 0.98 de
similaridade e são trabalhos distintos: em título longo, o caractere que
difere costuma ser justamente o que separa os dois. Acima de 0.88 e abaixo
de idêntico vira **suspeita**, e ambos os registros continuam existindo.
Fundir errado some com um trabalho sem deixar rastro; duplicata que passa
é só chateação.

**Nenhum caractere invisível no fonte.** Marcas combinantes e sentinelas
são declaradas com `String.fromCharCode` e nome próprio (`CEDILHA`,
`ACENTO_AGUDO`, `MARCADOR_CHAVE_ABERTA_LITERAL`) em vez de coladas
literalmente, que é ilegível e some em copiar/colar.

## Armadilhas já pagas

**`better-sqlite3` precisa ser >= 13 no Node 23+.** Na v11 o destrutor
nativo de `Statement` roda depois que o Next dev descarta o contexto do
módulo (o que `revalidatePath` provoca), e a assertion
`RemoveEnvironmentCleanupHook` **aborta o processo inteiro** — o servidor
morre no meio de uma ação e o navegador só mostra "Failed to fetch". Não
aparece em teste fora do Next, porque depende do descarte de contexto.

**Arquivo `"use server"` só exporta função async.** Constante ou objeto
exportado ali quebra em runtime, e `next build` não pega — a validação
acontece quando o módulo de action é registrado. Por isso
`resultado.ts` existe separado de `acoes.ts`.

**Env var lida por módulo tem que ser definida antes do import.** `import`
é içado, então `process.env.X = ...` no topo de um script roda *depois*.
Em `scripts/integracao.ts` os módulos do app entram por `await import()`
— sem isso o teste roda contra `revisa.db` e passa mentindo.

## Limitações conhecidas

- `@comment(...)` e `@preamble(...)` com **parênteses** em vez de chaves
  não são pulados corretamente. A forma com chaves — que é a que todas as
  bases exportam — funciona.
- Importação de RIS ainda não existe; o parser cobre só BibTeX.
- Sem integração com CrossRef/OpenAlex ainda (preencher por DOI).

## Próximos passos

- **Diagrama PRISMA** a partir das contagens — já é uma query, porque a
  exclusão aponta o critério e as buscas guardam o total retornado.
- **Exportar** a tabela de trabalhos relacionados em LaTeX/Markdown e o
  `.bib` só com os incluídos.
- **CrossRef/OpenAlex**: colar o DOI e preencher os metadados.
- **Extração**: usar `campo_extracao` e `extracao`, que já existem no
  schema mas ainda não têm tela.
