export const MAXIMO_DE_CARACTERES = 2_000_000;

export const MAXIMO_DE_ENTRADAS = 500;

function emMilhares(numero: number): string {
  return numero.toLocaleString("pt-BR");
}

export function recusaPorTamanho(conteudo: string): string | null {
  if (conteudo.length <= MAXIMO_DE_CARACTERES) return null;

  return `O conteúdo tem ${emMilhares(conteudo.length)} caracteres e o limite é ${emMilhares(
    MAXIMO_DE_CARACTERES,
  )}. Exporte a busca em partes — por faixa de ano, por exemplo — e importe uma de cada vez.`;
}

export function recusaPorQuantidade(entradas: number): string | null {
  if (entradas <= MAXIMO_DE_ENTRADAS) return null;

  return `O arquivo traz ${emMilhares(entradas)} registros e o limite por importação é ${emMilhares(
    MAXIMO_DE_ENTRADAS,
  )}. A comparação que detecta duplicatas cresce com o quadrado do número de registros, então lotes maiores travariam o servidor. Exporte a busca em partes e importe uma de cada vez — o sistema junta tudo no mesmo protocolo e continua removendo as duplicatas entre os lotes.`;
}
