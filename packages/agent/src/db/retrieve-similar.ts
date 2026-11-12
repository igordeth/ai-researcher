import { cosineDistance, gt, isNotNull, sql } from 'drizzle-orm';

import type { Database } from './client.js';
import { documentos, documentosWeb } from './schema.js';

interface DocumentoBase {
  id: string;
  // O texto que o LLM lê: o parágrafo do corpus, ou um chunk de uma página da web.
  paragraph: string;
  sourceUrl: string;
  fetchedAt: Date;
  // Distância de cosseno: 0 é idêntico, quanto menor, mais parecido.
  distance: number;
}

/** Documento do corpus CVM: números de uma empresa num trimestre, com data-base. */
export interface DocumentoCvm extends DocumentoBase {
  origem: 'cvm';
  ticker: string;
  companyName: string;
  setor: string;
  period: string;
  periodEnd: string;
}

/** Chunk de uma página encontrada pela busca na web. */
export interface DocumentoWeb extends DocumentoBase {
  origem: 'web';
  title: string;
}

/**
 * O que o retrieve entrega aos próximos nós. União discriminada por `origem`: quem consome tem de
 * tratar os dois casos (`if (doc.origem === 'cvm')`), e o TypeScript só deixa ler `ticker` ou
 * `title` depois de saber qual é.
 */
export type RetrievedDoc = DocumentoCvm | DocumentoWeb;

async function buscarNoCorpus(
  db: Database,
  embedding: number[],
  k: number,
): Promise<DocumentoCvm[]> {
  // cosineDistance gera `embedding <=> '[...]'`: o mesmo operador do índice HNSW
  // (vector_cosine_ops). Com outro operador, a consulta não usaria o índice.
  const distance = cosineDistance(documentos.embedding, embedding).mapWith(Number);

  // O where descarta documento ainda sem embedding (antes do seed): sem vetor, não há distância.
  const linhas = await db
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

  return linhas.map((linha) => ({ origem: 'cvm' as const, ...linha }));
}

async function buscarNaWeb(db: Database, embedding: number[], k: number): Promise<DocumentoWeb[]> {
  const distance = cosineDistance(documentosWeb.embedding, embedding).mapWith(Number);

  // A validade aplica-se na leitura: documento expirado deixa de ser encontrado, sem precisar de um
  // job de limpeza. now() da base, e não o relógio da aplicação, para haver um só relógio.
  const linhas = await db
    .select({
      id: documentosWeb.id,
      title: documentosWeb.title,
      paragraph: documentosWeb.content,
      sourceUrl: documentosWeb.sourceUrl,
      fetchedAt: documentosWeb.fetchedAt,
      distance,
    })
    .from(documentosWeb)
    .where(gt(documentosWeb.expiresAt, sql`now()`))
    .orderBy(distance)
    .limit(k);

  return linhas.map((linha) => ({ origem: 'web' as const, ...linha }));
}

/**
 * Junta os resultados das duas tabelas num só top-k, ordenado só pela distância. Pedimos k a cada
 * tabela: o top-k combinado está sempre contido na união dos dois top-k.
 */
export function combinarResultados(
  corpus: DocumentoCvm[],
  web: DocumentoWeb[],
  k: number,
): RetrievedDoc[] {
  return [...corpus, ...web].sort((a, b) => a.distance - b.distance).slice(0, k);
}

export async function buscarDocumentosSimilares(
  db: Database,
  embedding: number[],
  k: number,
): Promise<RetrievedDoc[]> {
  const [corpus, web] = await Promise.all([
    buscarNoCorpus(db, embedding, k),
    buscarNaWeb(db, embedding, k),
  ]);

  return combinarResultados(corpus, web, k);
}
