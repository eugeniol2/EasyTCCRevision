const ASPAS = '"';
const VIRGULA = ",";
const CR = "\r";
const LF = "\n";

export function parseCsv(conteudo: string): string[][] {
  const linhas: string[][] = [];
  let campos: string[] = [];
  let campo = "";
  let dentroDeAspas = false;
  let posicao = 0;

  const fecharCampo = () => {
    campos.push(campo);
    campo = "";
  };

  const fecharLinha = () => {
    fecharCampo();
    if (campos.some((valor) => valor !== "")) linhas.push(campos);
    campos = [];
  };

  while (posicao < conteudo.length) {
    const caractere = conteudo[posicao]!;

    if (dentroDeAspas) {
      if (caractere === ASPAS) {
        const aspasEscapadas = conteudo[posicao + 1] === ASPAS;
        if (aspasEscapadas) {
          campo += ASPAS;
          posicao += 2;
          continue;
        }
        dentroDeAspas = false;
        posicao++;
        continue;
      }
      campo += caractere;
      posicao++;
      continue;
    }

    if (caractere === ASPAS) {
      dentroDeAspas = true;
      posicao++;
      continue;
    }
    if (caractere === VIRGULA) {
      fecharCampo();
      posicao++;
      continue;
    }
    if (caractere === CR || caractere === LF) {
      fecharLinha();
      posicao += caractere === CR && conteudo[posicao + 1] === LF ? 2 : 1;
      continue;
    }

    campo += caractere;
    posicao++;
  }

  if (campo !== "" || campos.length > 0) fecharLinha();
  return linhas;
}
