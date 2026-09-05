import { ImageResponse } from "next/og";
import { DESCRICAO_DO_SITE, NOME_DO_SITE } from "@/lib/site";

export const alt = `${NOME_DO_SITE} — revisão sistemática da literatura`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const FUNDO = "#fbfaf8";
const SUPERFICIE = "#ffffff";
const BORDA = "#e3dfd8";
const TEXTO = "#1c1a17";
const TEXTO_SUAVE = "#6b655c";
const DESTAQUE = "#8a5a2b";

const BARRAS = [
  { largura: 150, opacidade: 0.5 },
  { largura: 98, opacidade: 0.75 },
  { largura: 45, opacidade: 1 },
];

export default function ImagemDeCompartilhamento() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          background: FUNDO,
          padding: "0 96px",
          borderBottom: `24px solid ${DESTAQUE}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 16,
              width: 210,
              height: 210,
              borderRadius: 48,
              background: DESTAQUE,
            }}
          >
            {BARRAS.map((barra) => (
              <div
                key={barra.largura}
                style={{
                  width: barra.largura,
                  height: 30,
                  borderRadius: 15,
                  background: SUPERFICIE,
                  opacity: barra.opacidade,
                }}
              />
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 108, color: TEXTO, letterSpacing: -3 }}>
              {NOME_DO_SITE}
            </div>
            <div style={{ fontSize: 38, color: DESTAQUE, marginTop: 4 }}>
              revisão sistemática da literatura
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            marginTop: 56,
            paddingTop: 40,
            borderTop: `2px solid ${BORDA}`,
            fontSize: 30,
            lineHeight: 1.45,
            color: TEXTO_SUAVE,
          }}
        >
          {DESCRICAO_DO_SITE}
        </div>
      </div>
    ),
    size,
  );
}
