import { cosineDistance, isNotNull } from 'drizzle-orm';

import type { Database } from './client.js';
import { documentos } from './schema.js';

/** O que o retrieve entrega aos próximos nós: o texto e tudo de que a resposta precisa para citar. */
export interface RetrievedDoc {
  id: string;
  ticker: string;
  companyName: string;
  setor: string;
  period: string;
  periodEnd: string;
  paragraph: string;
  sourceUrl: string;
  fetchedAt: Date;
  // Distância de cosseno: 0 é idêntico, quanto menor, mais parecido.
  distance: number;
}

export async function buscarDocumentosSimilares(
  db: Database,
  embedding: number[],
  k: number,
): Promise<RetrievedDoc[]> {
  // cosineDistance gera `embedding <=> '[...]'`: o mesmo operador do índice HNSW
  // (vector_cosine_ops). Com outro operador, a consulta não usaria o índice.
  const distance = cosineDistance(documentos.embedding, embedding).mapWith(Number);

  // O where descarta documento ainda sem embedding (antes do seed): sem vetor, não há distância.
  return db
    .select({
      id: documentos.id,
      ticker: documentos.ticker,
      companyName: documentos.companyName,
      setor: documentos.setor,
      period: documentos.period,
      periodEnd: documentos.periodEnd,
      paragraph: documentos.paragraph,
      sourceUrl: documentos.sourceUrl,
      fetchedAt: documentos.fetchedAt,
      distance,
    })
    .from(documentos)
    .where(isNotNull(documentos.embedding))
    .orderBy(distance)
    .limit(k);
}
