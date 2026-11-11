import type { EmbeddingsInterface } from '@langchain/core/embeddings';
import { VertexAIEmbeddings } from '@langchain/google-vertexai';

import { EMBEDDING_DIMENSIONS } from '../db/schema.js';

/**
 * Cliente de embeddings REAL, que chama a Vertex AI pela rede. Fica isolado nesta função para que
 * o modo DEMO possa passar ao seed um fake com a mesma interface (EmbeddingsInterface, do
 * LangChain), sem rede e sem credencial.
 *
 * A autenticação vem do ADC (`gcloud auth application-default login`); nenhuma chave em arquivo.
 */
export function criarEmbeddings(): EmbeddingsInterface {
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
