# Revisa

Organizador de revisão sistemática da literatura, para quem está escrevendo
TCC. Guarda metadado, DOI e link — **nunca o PDF**, o que elimina o risco de
direito autoral e reduz o problema de durabilidade a um dump de texto.

Cobre as seis etapas que uma revisão pede: questão de pesquisa, protocolo de
busca com a string usada em cada base, critérios de inclusão e exclusão,
triagem em duas fases, extração de dados e a síntese — diagrama PRISMA,
tabela de trabalhos relacionados e o texto da metodologia.

Aplicação multiusuário com login Google restrito a um domínio. Cada conta só
enxerga as próprias revisões.

## Rodar

Precisa de um `.env.local` com:

```
DATABASE_URL="postgres://..."        # Neon, conexão -pooler
DATABASE_URL_TESTE="postgres://..."  # outro database no mesmo projeto
AUTH_GOOGLE_ID="..."
AUTH_GOOGLE_SECRET="..."
AUTH_SECRET="..."                    # npx auth secret
DOMINIO_PERMITIDO="ufrpe.br"         # lista separada por vírgula, ou "*"
```

```bash
npm install
npm run db:push                        # aplica o schema no banco
npm run dev                            # http://localhost:3000
npm run db:seed eugenio.chagas@ufrpe.br  # opcional: protocolo de exemplo
```

O seed exige o e-mail de uma conta que já existe — ela nasce no primeiro
login. Protocolo sem dono é invisível para todo mundo.

```bash
npm test           # 126 verificações do núcleo + 167 de integração
npm run db:studio  # navegador de dados do Drizzle
```

`scripts/smoke.ts` é TypeScript puro e não toca no banco. `scripts/integracao.ts`
roda contra `DATABASE_URL_TESTE` e trunca as tabelas ao iniciar — nunca aponte
essa variável para o banco de produção.

## Onde está o quê

| Arquivo | Papel |
|---|---|
| `src/db/schema.ts` | Modelo de dados completo |
| `src/auth.config.ts` | Configuração que roda no Edge (sem banco) |
| `src/auth.ts` | Configuração completa, com gravação do usuário |
| `src/middleware.ts` | Redireciona quem não tem sessão |
| `src/lib/autorizacao.ts` | Guardas de página e de server action |
| `src/lib/pertencimento.ts` | "Este item é deste protocolo, e ele é seu?" |
| `src/lib/dominio.ts` | Quais domínios de e-mail podem entrar |
| `src/lib/limites.ts` | Teto de tamanho e de registros por importação |
| `src/lib/bibtex/parser.ts` | Parser de `.bib` (varredura, não regex) |
| `src/lib/bibtex/latex.ts` | `\~ao` → `ão` |
| `src/lib/bibtex/autores.ts` | Separação e parse de nomes |
| `src/lib/csv/` | Parser de CSV (RFC 4180) e conversão para domínio |
| `src/lib/normalizar.ts` | DOI/título canônicos, similaridade |
| `src/lib/dedup.ts` | Fusão de duplicatas entre bases |
| `src/lib/importacao.ts` | Importação: parse → dedupe → grava |
| `src/lib/triagem.ts` | Grava e desfaz decisões |
| `src/lib/relatorio.ts` | PRISMA, tabela de trabalhos, metodologia |
| `src/lib/consultas.ts` | Leituras usadas pelas páginas |

**Server action é só transporte.** Toda regra mora em `src/lib/`, e a action
autoriza, valida entrada, chama a lib e revalida o cache. É o que permite
testar o caminho real sem subir o Next: `revalidatePath` explode fora de uma
request, então lógica misturada com action é lógica não testável.

## Decisões que não são óbvias no código

O código de `src/` não tem comentários por opção: nomes e funções pequenas
carregam o "o quê". O "porquê" — rationale que nenhum nome consegue carregar
— fica aqui embaixo.

**A string de busca é entidade, não campo.** Cada base tem sintaxe diferente,
e `busca.executadaEm` é obrigatório: é o que torna a revisão reproduzível, e é
o dado que todo mundo esquece de anotar.

**`estudo_busca` é N:N.** O mesmo artigo vem da Scopus *e* da IEEE. Sem
registrar todas as origens não dá para reportar a dedupe no PRISMA. Essa
tabela é a principal razão de o modelo ser relacional e não documento.

**Exclusão aponta o critério (FK).** O PRISMA exige reportar quantos saíram
por cada motivo. Com FK, o relatório é uma query; com texto livre, é trabalho
manual no fim.

**Triagem é histórico, não estado.** Uma linha por estágio, nunca UPDATE — o
caminho até a inclusão é parte do que se reporta.

**Fusão automática exige título idêntico após normalizar.** Nunca aproximado.
"Testes em microsserviços parte I" e "...parte II" dão 0.98 de similaridade e
são trabalhos distintos: em título longo, o caractere que difere costuma ser
justamente o que separa os dois. Acima de 0.88 e abaixo de idêntico vira
**suspeita**, e ambos os registros continuam existindo. Fundir errado some com
um trabalho sem deixar rastro; duplicata que passa é só chateação.

**A identidade do usuário é o `sub` do Google, não o e-mail.** Instituição
reatribui endereço: o `sub` é estável, o e-mail não. `usuario.email` existe só
para exibir e para o seed encontrar a conta.

**Revisão de outra conta responde 404, não 403.** Um "sem permissão"
confirmaria que aquele identificador existe em alguma outra conta. Ver
`protocoloDaPagina` em `src/lib/autorizacao.ts`.

**As guardas conferem as duas pontas na mesma consulta.** `exigirEstudo`
verifica que o estudo é daquele protocolo *e* que o protocolo é de quem pediu,
com um `innerJoin`. Checar só o dono deixaria passar um `estudoId` de outra
revisão; checar só o protocolo deixaria passar a revisão alheia.

**`DOMINIO_PERMITIDO` ausente derruba a aplicação.** Liberar o acesso geral
exige o valor `"*"`, escrito de propósito. Se a ausência significasse "sem
restrição", esquecer a variável no deploy e abrir o sistema ao público seriam
indistinguíveis — e o segundo é silencioso.

**A importação recusa acima de 500 registros.** A deduplicação compara os
estudos sem DOI par a par, então o custo cresce com o quadrado do número de
registros: 500 levam ~4,5 s no pior caso, 1000 levam ~18 s e 2000 levam ~71 s.
O teto sobe quando `dedup.ts` agrupar os candidatos por faixa de tamanho de
título antes de comparar.

**Decisão de triagem grava em segundo plano; ação destrutiva bloqueia.** Na
triagem se decide um estudo atrás do outro, e travar a tela a cada clique
custaria mais do que entrega — a decisão é otimista e a gravação corre atrás.
Já descartar ou zerar segura o diálogo aberto até terminar, porque um clique
repetido ali apaga duas vezes.

**Nenhum caractere invisível no fonte.** Marcas combinantes e sentinelas são
declaradas com `String.fromCharCode` e nome próprio (`CEDILHA`,
`ACENTO_AGUDO`, `MARCADOR_CHAVE_ABERTA_LITERAL`) em vez de coladas
literalmente, que é ilegível e some em copiar/colar.

## Armadilhas já pagas

**O Edge Runtime não carrega `node:crypto` nem o driver do Postgres.** O
middleware roda no Edge, então a configuração do Auth.js é dividida:
`auth.config.ts` tem só o que o Edge executa e `auth.ts` acrescenta o callback
que grava no banco. Juntar os dois quebra o middleware, não o build.

**O matcher do middleware engole rotas de metadado.** `robots.txt`,
`opengraph-image` e `icon.svg` são buscados por robôs e por quem gera a prévia
do link — sem sessão. Se não estiverem nas exceções, respondem 302 para
`/entrar` e falham em silêncio: a aba fica sem ícone e o card de
compartilhamento vem vazio.

**`count(*)` no Postgres volta como string.** Sem `::int` no SQL, `0 + "1"`
vira `"01"` e as contagens do PRISMA passam a mentir sem erro nenhum.

**`drizzle-kit push` falha em banco com dados.** Ao adicionar coluna com FK
ele tenta recriar a chave primária e para em `column "id" is in a primary key`.
Em banco novo funciona; em banco com dados, aplique o `CREATE TABLE` /
`ALTER TABLE` à mão e confira as contagens antes e depois.

**Arquivo `"use server"` só exporta função async.** Constante ou objeto
exportado ali quebra em runtime, e `next build` não pega — a validação acontece
quando o módulo de action é registrado. Por isso `resultado.ts` existe separado
de `acoes.ts`.

**Env var lida por módulo tem que ser definida antes do import.** `import` é
içado, então `process.env.X = ...` no topo de um script roda *depois*. Em
`scripts/integracao.ts` os módulos do app entram por `await import()` — sem
isso o teste roda contra o banco de desenvolvimento e passa mentindo.

**Botão com foco é acionado por Enter pelo próprio navegador.** No diálogo de
confirmação o foco inicial vai para *Cancelar*: deixá-lo no botão destrutivo
faria a tecla apagar coisas mesmo sem atalho nenhum no código.

## Deploy

Vercel, com as mesmas variáveis do `.env.local` **menos** `AUTH_URL` e
`DATABASE_URL_TESTE`. O `AUTH_URL` apontando para localhost quebra o callback
em produção; sem ele o Auth.js infere o host sozinho. No painel os valores vão
sem aspas.

No Google Cloud, o cliente OAuth precisa da URI de redirecionamento
`https://<dominio>/api/auth/callback/google` **e** da de localhost, para o
desenvolvimento continuar funcionando.

Vale mudar a região das funções para `gru1` (São Paulo): o padrão é Washington
e o Neon está em `sa-east-1`, então cada consulta cruzaria o continente.

## Limitações conhecidas

- Importação em lotes de até 500 registros (ver o rationale acima).
- `@comment(...)` e `@preamble(...)` com **parênteses** em vez de chaves não
  são pulados corretamente. A forma com chaves — que é a que todas as bases
  exportam — funciona.
- Importação de RIS ainda não existe; o parser cobre BibTeX e CSV.
- O CSV da SpringerLink não traz resumo, então a triagem por título e resumo
  fica sem texto para os artigos dessa base.
- Sem integração com CrossRef/OpenAlex (preencher metadados por DOI).
- As páginas de protocolo não têm título dinâmico na aba: exigiria uma
  consulta a mais por carregamento.

## Próximos passos

- **Agrupar candidatos antes de comparar** em `dedup.ts`, para subir o teto de
  500 registros por importação.
- **CrossRef/OpenAlex**: colar o DOI e preencher os metadados.
- **Compartilhar uma revisão** entre contas, para orientador acompanhar.
- **Exportar o `.bib`** só com os estudos incluídos.
