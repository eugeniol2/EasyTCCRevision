"use client";

import {
  useActionState,
  useDeferredValue,
  useMemo,
  useRef,
  useState,
  type DragEvent,
} from "react";
import { parseBibtex } from "@/lib/bibtex/parser";
import { importarBibtex } from "./acoes";
import { RESULTADO_INICIAL } from "./resultado";

const BASES_SUGERIDAS = [
  "Scopus",
  "Web of Science",
  "IEEE Xplore",
  "ACM Digital Library",
  "ScienceDirect",
  "SciELO",
  "Portal de Periódicos CAPES",
  "Google Scholar",
];

const EXTENSOES_ACEITAS = ".bib,.bibtex,.txt";
const CARACTERE_DE_SUBSTITUICAO = "�";

function hoje(): string {
  return new Date().toISOString().slice(0, 10);
}

async function lerComoTexto(arquivo: File): Promise<string> {
  const bytes = await arquivo.arrayBuffer();
  const comoUtf8 = new TextDecoder("utf-8").decode(bytes);

  const houveErroDeDecodificacao = comoUtf8.includes(CARACTERE_DE_SUBSTITUICAO);
  return houveErroDeDecodificacao
    ? new TextDecoder("windows-1252").decode(bytes)
    : comoUtf8;
}

export default function FormularioDeImportacao({
  protocoloId,
}: {
  protocoloId: string;
}) {
  const [resultado, enviar, enviando] = useActionState(
    importarBibtex,
    RESULTADO_INICIAL,
  );
  const [conteudo, setConteudo] = useState("");
  const [nomeDoArquivo, setNomeDoArquivo] = useState<string | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const campoDeArquivo = useRef<HTMLInputElement>(null);

  const conteudoAdiado = useDeferredValue(conteudo);
  const analise = useMemo(() => {
    if (conteudoAdiado.trim() === "") return null;
    const { entradas, erros } = parseBibtex(conteudoAdiado);
    return { entradas: entradas.length, erros: erros.length };
  }, [conteudoAdiado]);

  async function carregar(arquivo: File | undefined) {
    if (!arquivo) return;
    setConteudo(await lerComoTexto(arquivo));
    setNomeDoArquivo(arquivo.name);
  }

  function aoSoltar(evento: DragEvent<HTMLDivElement>) {
    evento.preventDefault();
    setArrastando(false);
    void carregar(evento.dataTransfer.files[0]);
  }

  return (
    <>
      <form action={enviar} className="cartao grade">
        <input type="hidden" name="protocoloId" value={protocoloId} />

        <div>
          <label htmlFor="base">Base consultada</label>
          <input id="base" name="base" list="bases" required placeholder="Scopus" />
          <datalist id="bases">
            {BASES_SUGERIDAS.map((base) => (
              <option key={base} value={base} />
            ))}
          </datalist>
        </div>

        <div>
          <label htmlFor="stringBusca">String de busca usada nesta base</label>
          <input
            id="stringBusca"
            name="stringBusca"
            required
            placeholder='TITLE-ABS-KEY("systematic review" AND "code review")'
          />
        </div>

        <div>
          <label htmlFor="executadaEm">Data de execução da busca</label>
          <input
            id="executadaEm"
            name="executadaEm"
            type="date"
            required
            defaultValue={hoje()}
          />
        </div>

        <div>
          <label>Arquivo exportado da base</label>
          <div
            className={`area-arquivo${arrastando ? " arrastando" : ""}`}
            onDragOver={(evento) => {
              evento.preventDefault();
              setArrastando(true);
            }}
            onDragLeave={() => setArrastando(false)}
            onDrop={aoSoltar}
          >
            <input
              ref={campoDeArquivo}
              type="file"
              accept={EXTENSOES_ACEITAS}
              hidden
              onChange={(evento) => void carregar(evento.target.files?.[0])}
            />
            <button
              type="button"
              className="botao"
              onClick={() => campoDeArquivo.current?.click()}
            >
              Escolher arquivo .bib
            </button>
            <span className="subtitulo">
              {nomeDoArquivo ?? "ou arraste o arquivo aqui"}
            </span>
          </div>
        </div>

        <div>
          <label htmlFor="conteudo">
            Conteúdo {nomeDoArquivo ? "(carregado do arquivo, editável)" : "(ou cole aqui)"}
          </label>
          <textarea
            id="conteudo"
            name="conteudo"
            required
            placeholder="@article{...}"
            value={conteudo}
            onChange={(evento) => setConteudo(evento.target.value)}
          />
          {analise && (
            <p className="subtitulo" style={{ marginTop: "0.4rem" }}>
              {analise.entradas === 0
                ? "Nenhuma entrada BibTeX reconhecida — confira se o arquivo é .bib e não .ris ou .csv."
                : `${analise.entradas} entrada(s) reconhecida(s)${
                    analise.erros > 0 ? `, ${analise.erros} com erro de formato` : ""
                  }.`}
            </p>
          )}
        </div>

        <div className="linha-acoes">
          <button type="submit" className="botao botao-primario" disabled={enviando}>
            {enviando ? "Importando..." : "Importar"}
          </button>
        </div>
      </form>

      {resultado.estado === "erro" && <div className="aviso">{resultado.mensagem}</div>}

      {resultado.estado === "sucesso" && (
        <section className="cartao" style={{ marginTop: "1.25rem" }}>
          <h2 style={{ fontSize: "1rem", marginTop: 0 }}>{resultado.mensagem}</h2>

          <div className="contadores">
            <span>
              Novos <strong>{resultado.importados}</strong>
            </span>
            <span>
              Duplicatas no arquivo <strong>{resultado.duplicatasNoArquivo}</strong>
            </span>
            <span>
              Já estavam no protocolo <strong>{resultado.jaExistiamNoProtocolo}</strong>
            </span>
          </div>

          {resultado.suspeitas.length > 0 && (
            <div className="aviso">
              <strong>
                {resultado.suspeitas.length} possível(is) duplicata(s) para conferir
              </strong>
              <ul className="lista-limpa" style={{ marginTop: "0.5rem" }}>
                {resultado.suspeitas.map((suspeita) => (
                  <li key={`${suspeita.titulo}-${suspeita.parecidoCom}`}>
                    “{suspeita.titulo}” parece “{suspeita.parecidoCom}” (
                    {Math.round(suspeita.confianca * 100)}%). Os dois foram mantidos.
                  </li>
                ))}
              </ul>
            </div>
          )}

          {resultado.linhasComErro.length > 0 && (
            <div className="aviso">
              <strong>Entradas ignoradas por erro de formato</strong>
              <ul className="lista-limpa" style={{ marginTop: "0.5rem" }}>
                {resultado.linhasComErro.map((erro) => (
                  <li key={erro}>{erro}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="linha-acoes">
            <a className="botao botao-primario" href={`/protocolos/${protocoloId}/triagem`}>
              Ir para a triagem
            </a>
            <a className="botao" href={`/protocolos/${protocoloId}`}>
              Voltar ao protocolo
            </a>
          </div>
        </section>
      )}
    </>
  );
}
