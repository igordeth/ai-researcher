import { eq } from 'drizzle-orm';

import type { Database } from './client.js';
import { documentosWeb } from './schema.js';

export type LinhaDocumentoWeb = typeof documentosWeb.$inferInsert;

/**
 * Grava os chunks de uma página, substituindo os que já existiam para o mesmo URL. Numa transação:
 * ou a página fica inteira com os chunks novos, ou fica como estava. Repetir a mesma pergunta não
 * duplica nada, e uma página que encolheu não deixa chunks antigos para trás.
 */
export async function substituirPaginaWeb(
  db: Database,
  sourceUrl: string,
  linhas: LinhaDocumentoWeb[],
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(documentosWeb).where(eq(documentosWeb.sourceUrl, sourceUrl));
    if (linhas.length > 0) await tx.insert(documentosWeb).values(linhas);
  });
}
