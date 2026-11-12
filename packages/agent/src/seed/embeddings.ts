import { VertexAIEmbeddings } from '@langchain/google-vertexai';

import { EMBEDDING_DIMENSIONS } from '../db/schema.js';

/**
 * Cliente de embeddings REAL, que chama a Vertex AI pela rede. Fica isolado nesta função para que
 * o modo DEMO possa trocá-lo por um fake, sem rede e sem credencial. Quem usa o cliente declara só
 * o método de que precisa (EmbeddingsEmLote no seed, EmbeddingsClient no retrieve), e o
 * VertexAIEmbeddings atende aos dois.
 *
 * A autenticação vem do ADC (`gcloud auth application-default login`); nenhuma chave em arquivo.
 */
export function criarEmbeddings(): VertexAIEmbeddings {
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
