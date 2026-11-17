import { VertexAIEmbeddings } from '@langchain/google-vertexai';

import { EMBEDDING_DIMENSIONS } from '../db/schema.js';
import { modoDemoAtivo } from '../demo/modo-demo.js';
import type { EmbeddingsClient } from '../nodes/retrieve.js';
import type { EmbeddingsEmLote } from '../nodes/web-search.js';

/**
 * Cliente de embeddings REAL, que chama a Vertex AI pela rede. Não olha para o DEMO: o seed usa
 * sempre este, porque vetores de zeros no índice estragariam todas as buscas seguintes, sem erro
 * nenhum que o mostrasse. O VertexAIEmbeddings atende aos dois usos: embedQuery (retrieve) e
 * embedDocuments em lote (seed e webSearch).
 *
 * A autenticação vem do ADC (`gcloud auth application-default login`); nenhuma chave em arquivo.
 */
export function criarEmbeddingsReal(): VertexAIEmbeddings {
  const model = process.env.MODEL_EMBEDDING;
  if (!model) {
    // Nome de modelo nunca é fixo no código (ver CLAUDE.md, "Modelos"): trocar o modelo de
    // embedding invalida o índice inteiro, então a troca tem que ser explícita.
    throw new Error('MODEL_EMBEDDING não definida. Ver .env.example.');
  }

  return new VertexAIEmbeddings({
    model,
    location: process.env.GOOGLE_CLOUD_LOCATION ?? 'us-central1',
    dimensions: EMBEDDING_DIMENSIONS,
  });
}

/**
 * O cliente de embeddings do grafo. Com DEMO=true, um fake que devolve vetores de zeros, sem rede
 * nem credencial: o valor não importa, porque a busca por similaridade do demo também é fixture
 * (criarBuscarDemo) e não compara vetor nenhum.
 */
export function criarEmbeddings(): EmbeddingsClient & EmbeddingsEmLote {
  if (!modoDemoAtivo()) return criarEmbeddingsReal();

  // O embedDocuments também existe porque o grafo o pede ao webSearch; no demo o grade é sempre
  // suficiente e o webSearch nunca corre.
  const zeros = (): number[] => new Array<number>(EMBEDDING_DIMENSIONS).fill(0);
  return {
    embedQuery: async () => zeros(),
    embedDocuments: async (textos) => textos.map(() => zeros()),
  };
}
