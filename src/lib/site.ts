export const NOME_DO_SITE = "Revisa";

export const DESCRICAO_DO_SITE =
  "Organize sua revisão sistemática da literatura do começo ao fim: protocolo e critérios, strings de busca por base, triagem em duas fases, extração de dados e a tabela de trabalhos relacionados do TCC.";

export function urlDoSite(): string {
  const daVercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (daVercel) return `https://${daVercel}`;

  return process.env.AUTH_URL ?? "http://localhost:3000";
}
