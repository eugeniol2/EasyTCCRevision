export type DominiosPermitidos = string[] | "todos";

export const ACEITA_QUALQUER_CONTA = "*";

/**
 * Aceitar qualquer conta precisa ser uma escolha escrita, não a consequência
 * de uma variável esquecida: sem isso, "abri o sistema ao público" e "errei o
 * nome da variável no deploy" teriam o mesmo efeito, e o segundo é silencioso.
 */
export function analisarDominios(configuracao: string | undefined): DominiosPermitidos {
  // As aspas pertencem à sintaxe do .env, não ao valor. Copiar de lá para o
  // painel de um provedor as traria junto, e o sistema recusaria todo mundo
  // comparando com um domínio que tem aspas no nome.
  const texto = (configuracao?.trim() ?? "").replace(/^["']|["']$/g, "").trim();

  if (texto === "") {
    throw new Error(
      `DOMINIO_PERMITIDO não configurada. Use "${ACEITA_QUALQUER_CONTA}" para aceitar qualquer conta Google, ou uma lista como "ufrpe.br,ufpe.br".`,
    );
  }

  if (texto === ACEITA_QUALQUER_CONTA) return "todos";

  const dominios = texto
    .split(",")
    .map((parte) => parte.trim().toLowerCase().replace(/^@/, ""))
    .filter((parte) => parte !== "");

  if (dominios.length === 0) {
    throw new Error("DOMINIO_PERMITIDO não contém nenhum domínio válido.");
  }

  return dominios;
}

export function emailPermitido(
  email: string | null | undefined,
  permitidos: DominiosPermitidos,
): boolean {
  if (permitidos === "todos") return true;

  // O arroba faz parte da comparação de propósito: sem ele, "ufrpe.br"
  // aceitaria também um domínio terminado em "ufrpe.br".
  const normalizado = email?.trim().toLowerCase() ?? "";
  return permitidos.some((dominio) => normalizado.endsWith(`@${dominio}`));
}
