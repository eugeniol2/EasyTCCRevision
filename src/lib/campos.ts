export type TipoDeCampo = "texto" | "booleano" | "numero" | "opcoes";

export const AVALIACAO_DE_QUALIDADE = {
  nome: "Qualidade metodológica",
  tipo: "opcoes" as TipoDeCampo,
  opcoes: ["Alta", "Média", "Baixa"],
};

export const CAMPOS_PADRAO: {
  nome: string;
  tipo: TipoDeCampo;
  opcoes?: string[];
}[] = [
  { nome: "Objetivo", tipo: "texto" },
  { nome: "Metodologia", tipo: "texto" },
  { nome: "Resultados", tipo: "texto" },
  {
    nome: AVALIACAO_DE_QUALIDADE.nome,
    tipo: AVALIACAO_DE_QUALIDADE.tipo,
    opcoes: AVALIACAO_DE_QUALIDADE.opcoes,
  },
];

export function ehCampoObrigatorio(nome: string): boolean {
  return nome === AVALIACAO_DE_QUALIDADE.nome;
}
