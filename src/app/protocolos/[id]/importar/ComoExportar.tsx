"use client";

import { useState } from "react";

interface Passo {
  texto: string;
  imagem?: string;
  alt?: string;
}

interface Instrucoes {
  formato: string;
  passos: Passo[];
  observacao: string;
}

const POR_BASE: Record<string, Instrucoes> = {
  "IEEE Xplore": {
    formato: "BibTeX (.bib)",
    passos: [
      { texto: "Faça a busca em ieeexplore.ieee.org." },
      {
        texto:
          "Marque os resultados. A caixa Select All on Page, no alto da lista, marca a página inteira de uma vez.",
        imagem: "/tutorial/ieee-selecionar.png",
        alt: "Lista de resultados da IEEE Xplore com a caixa Select All on Page marcada acima dos artigos.",
      },
      {
        texto:
          "Clique em Export, na barra acima dos resultados, ao lado de Set Search Alerts.",
        imagem: "/tutorial/ieee-exportar.png",
        alt: "Barra superior da IEEE Xplore com os botões Export, Set Search Alerts e Search History.",
      },
      {
        texto:
          "Na janela que abrir, vá para a aba Citations e confira o número em “You have selected N citations for download” — é o que virá no arquivo.",
      },
      {
        texto:
          "Em Format, marque BibTeX. Em Include, troque para Citation and Abstract: ele vem marcado em Citation Only.",
        imagem: "/tutorial/ieee-formato.png",
        alt: "Janela Download Citations da IEEE com BibTeX marcado em Format e as opções Citation Only e Citation and Abstract em Include.",
      },
      { texto: "Clique em Download e traga o arquivo para cá." },
    ],
    observacao:
      "O passo do Include é o que mais custa: em Citation Only o arquivo chega sem os resumos, e a triagem por título e resumo fica sem o texto para ler. Se o download vier sem extensão ou como .txt, abra em qualquer editor e cole o conteúdo no campo de texto mais abaixo.",
  },
  SpringerLink: {
    formato: "CSV",
    passos: [
      { texto: "Faça a busca em link.springer.com." },
      {
        texto:
          "Aplique os filtros antes de exportar — a Springer baixa a busca inteira, não os itens que você marcou.",
      },
      {
        texto:
          "Clique em Download results (.csv), logo acima do primeiro resultado, ao lado do RSS feed.",
        imagem: "/tutorial/springer-download.png",
        alt: "Lista de resultados da SpringerLink com o link Download results (.csv) destacado acima do primeiro artigo.",
      },
      { texto: "Traga o arquivo .csv para cá." },
    ],
    observacao:
      "O CSV da Springer traz título, autores, ano, DOI e link, mas não traz o resumo. Na triagem por título e resumo os artigos dessa base virão sem o texto do resumo.",
  },
  "Google Scholar": {
    formato: "BibTeX, colado como texto",
    passos: [
      {
        texto:
          "Abra o menu do Google Acadêmico, no canto superior esquerdo, e vá em Configurações.",
        imagem: "/tutorial/scholar-configuracoes.png",
        alt: "Menu lateral do Google Acadêmico aberto, com o botão de menu e a opção Configurações destacados.",
      },
      {
        texto:
          "Em Gerenciador de bibliografias, marque “Mostre links para importar citações para o” e escolha BibTeX na lista ao lado. Salve.",
        imagem: "/tutorial/scholar-bibtex.png",
        alt: "Configurações do Google Acadêmico com a opção de mostrar links para importar citações marcada e BibTeX escolhido.",
      },
      {
        texto:
          "Cada resultado passa a ter o link Importe para o BibTeX no fim da linha de ações. Ele resolve um artigo por vez — para poucos, já basta.",
        imagem: "/tutorial/scholar-link-bibtex.png",
        alt: "Resultado de busca do Google Acadêmico com o link Importe para o BibTeX destacado ao lado de Salvar e Citar.",
      },
      {
        texto:
          "Para levar vários de uma vez, clique em Salvar, a estrela abaixo de cada resultado que interessa.",
        imagem: "/tutorial/scholar-salvar.png",
        alt: "Resultado de busca do Google Acadêmico com o botão Salvar, em forma de estrela, destacado.",
      },
      {
        texto:
          "Ao salvar, escolha um marcador. Crie um só para esta revisão se ainda não tiver.",
        imagem: "/tutorial/scholar-marcador.png",
        alt: "Caixa Marcar como do Google Acadêmico, com um marcador chamado resultados selecionado e a opção Criar novo.",
      },
      {
        texto: "Terminada a seleção, abra Minha biblioteca, no topo da página.",
        imagem: "/tutorial/scholar-biblioteca.png",
        alt: "Topo do Google Acadêmico com o link Minha biblioteca destacado.",
      },
      {
        texto: "Clique em Exportar tudo e escolha BibTeX.",
        imagem: "/tutorial/scholar-exportar.png",
        alt: "Biblioteca do Google Acadêmico com o menu Exportar tudo aberto, mostrando as opções BibTeX, EndNote, RefMan e CSV.",
      },
      {
        texto:
          "Copie o texto inteiro que aparecer e cole no campo Conteúdo (ou cole aqui), logo abaixo.",
        imagem: "/tutorial/scholar-colar.png",
        alt: "Página com várias entradas BibTeX geradas pelo Google Acadêmico, prontas para copiar.",
      },
    ],
    observacao:
      "O Exportar tudo leva todos os artigos da sua biblioteca, não apenas os do marcador — se você usa a biblioteca para outras coisas, elas virão junto e vão parar no protocolo. Colar várias citações seguidas no mesmo campo funciona: o sistema lê todas de uma vez.",
  },
};

export default function ComoExportar({ base }: { base: string }) {
  const [abertos, setAbertos] = useState<Set<number>>(new Set());
  const [semImagem, setSemImagem] = useState<Set<number>>(new Set());

  const instrucoes = POR_BASE[base];
  if (!instrucoes) return null;

  function alternar(indice: number) {
    setAbertos((anteriores) => {
      const atualizados = new Set(anteriores);
      if (!atualizados.delete(indice)) atualizados.add(indice);
      return atualizados;
    });
  }

  function marcarSemImagem(indice: number) {
    setSemImagem((anteriores) => new Set(anteriores).add(indice));
  }

  return (
    <div className="como-exportar">
      <p className="como-exportar-titulo">
        Como tirar o arquivo da {base} — formato: <strong>{instrucoes.formato}</strong>
      </p>
      <ol>
        {instrucoes.passos.map((passo, indice) => (
          <li key={passo.texto}>
            {passo.texto}
            {passo.imagem && (
              <div className="passo-imagem">
                <button
                  type="button"
                  className="link-pendente"
                  onClick={() => alternar(indice)}
                >
                  {abertos.has(indice) ? "Ocultar imagem" : "Mostrar imagem"}
                </button>
                {abertos.has(indice) &&
                  (semImagem.has(indice) ? (
                    <p className="subtitulo">
                      Não foi possível carregar a imagem ({passo.imagem}).
                    </p>
                  ) : (
                    <img
                      src={passo.imagem}
                      alt={passo.alt}
                      onError={() => marcarSemImagem(indice)}
                    />
                  ))}
              </div>
            )}
          </li>
        ))}
      </ol>
      <p className="como-exportar-nota">{instrucoes.observacao}</p>
    </div>
  );
}
