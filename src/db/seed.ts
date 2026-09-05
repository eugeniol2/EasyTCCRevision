import { randomUUID } from "node:crypto";
import { db, fecharBanco } from "./client";
import { criterio, protocolo } from "./schema";

const CRITERIOS_INICIAIS = [
  { tipo: "inclusao" as const, codigo: "IC1", descricao: "Estudo primário sobre o tema da questão de pesquisa" },
  { tipo: "inclusao" as const, codigo: "IC2", descricao: "Texto completo disponível" },
  { tipo: "exclusao" as const, codigo: "EC1", descricao: "Não responde à questão de pesquisa" },
  { tipo: "exclusao" as const, codigo: "EC2", descricao: "Fora do recorte temporal" },
  { tipo: "exclusao" as const, codigo: "EC3", descricao: "Não é estudo primário (editorial, resumo, pôster)" },
  { tipo: "exclusao" as const, codigo: "EC4", descricao: "Idioma fora do definido no protocolo" },
  { tipo: "exclusao" as const, codigo: "EC5", descricao: "Duplicata de outro estudo já incluído" },
];

async function criarProtocoloDeExemplo(): Promise<string> {
  const id = randomUUID();

  await db.insert(protocolo)
    .values({
      id,
      titulo: "Minha revisão sistemática",
      questaoPesquisa: "Qual a pergunta que esta revisão pretende responder?",
      anoInicio: new Date().getFullYear() - 5,
      anoFim: new Date().getFullYear(),
    });

  await db.insert(criterio)
    .values(
      CRITERIOS_INICIAIS.map((definicao, ordem) => ({
        id: randomUUID(),
        protocoloId: id,
        ordem,
        ...definicao,
      })),
    );

  return id;
}

const protocolosExistentes = await db.select().from(protocolo);

if (protocolosExistentes.length > 0) {
  console.log(`Já existem ${protocolosExistentes.length} protocolo(s). Nada a fazer.`);
} else {
  const id = await criarProtocoloDeExemplo();
  console.log(`Protocolo criado: ${id}`);
  console.log(`${CRITERIOS_INICIAIS.length} critérios cadastrados.`);
}

await fecharBanco();
