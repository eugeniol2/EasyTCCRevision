export type DominiosPermitidos = string[] | "todos";

export const ACEITA_QUALQUER_CONTA = "*";

export function analisarDominios(configuracao: string | undefined): DominiosPermitidos {
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

  const normalizado = email?.trim().toLowerCase() ?? "";
  return permitidos.some((dominio) => normalizado.endsWith(`@${dominio}`));
}
