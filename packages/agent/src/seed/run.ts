import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { EmbeddingsInterface } from '@langchain/core/embeddings';
import { sql } from 'drizzle-orm';

import { db, pool } from '../db/client.js';
import { documentos } from '../db/schema.js';
import { criarEmbeddings } from './embeddings.js';
import { emLotes } from './lotes.js';
import { lerDocumentos } from './read-documentos.js';
import { paraLinha } from './to-row.js';

const DOCUMENTOS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../corpus/data/documentos',
);

// A Vertex aceita um texto por requisição no gemini-embedding-001, e o VertexAIEmbeddings dispara
// as requisições de um embedDocuments em paralelo. O lote é o controle de concorrência: 10
// chamadas simultâneas, um INSERT de 10 linhas, e só então o próximo lote.
const TAMANHO_LOTE = 10;

export interface OpcoesSeed {
  dir?: string;
  // Injetável: o modo DEMO passa um fake no lugar do cliente real.
  embeddings?: EmbeddingsInterface;
}

export async function semear({
  dir = DOCUMENTOS_DIR,
  embeddings = criarEmbeddings(),
}: OpcoesSeed = {}): Promise<number> {
  const itens = lerDocumentos(dir);

  let indexados = 0;
  for (const lote of emLotes(itens, TAMANHO_LOTE)) {
    const vetores = await embeddings.embedDocuments(lote.map((documento) => documento.paragraph));
    const linhas = lote.map((documento, indice) => paraLinha(documento, vetores[indice]));

    // Upsert por (ticker, period), o índice único do schema. Rodar o seed de novo atualiza as
    // linhas existentes em vez de duplicar. `excluded` é a linha que tentou entrar.
    await db
      .insert(documentos)
      .values(linhas)
      .onConflictDoUpdate({
        target: [documentos.ticker, documentos.period],
        set: {
          companyName: sql`excluded.company_name`,
          setor: sql`excluded.setor`,
          periodEnd: sql`excluded.period_end`,
          receitaLiquida: sql`excluded.receita_liquida`,
          lucroBruto: sql`excluded.lucro_bruto`,
          lucroLiquido: sql`excluded.lucro_liquido`,
          ativoTotal: sql`excluded.ativo_total`,
          patrimonioLiquido: sql`excluded.patrimonio_liquido`,
          caixaOperacional: sql`excluded.caixa_operacional`,
          receitaMesmoTrimestreAnoAnterior: sql`excluded.receita_mesmo_trimestre_ano_anterior`,
          sourceUrl: sql`excluded.source_url`,
          fetchedAt: sql`excluded.fetched_at`,
          paragraph: sql`excluded.paragraph`,
          embedding: sql`excluded.embedding`,
        },
      });

    indexados += linhas.length;
    console.log(`${indexados}/${itens.length} documentos indexados.`);
  }

  return indexados;
}

const executadoDiretamente = process.argv[1] === fileURLToPath(import.meta.url);
if (executadoDiretamente) {
  semear()
    .then((total) => console.log(`Seed concluído: ${total} documento(s).`))
    .catch((erro: unknown) => {
      console.error(erro);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
