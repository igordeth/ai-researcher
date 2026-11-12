import type { RetrievedDoc } from '../db/retrieve-similar.js';

/**
 * O rótulo de um documento, como `[VALE3 3T25]` ou `[web: Título]`. O mesmo texto aparece no
 * contexto dos prompts e no bloco de fontes da resposta: é o que liga a citação que o modelo
 * escreve à fonte listada no fim.
 */
export function rotuloDocumento(doc: RetrievedDoc): string {
  return doc.origem === 'cvm' ? `[${doc.ticker} ${doc.period}]` : `[web: ${doc.title}]`;
}

/** O contexto de um prompt: um documento por linha, com o rótulo à frente. */
export function montarContexto(documents: RetrievedDoc[]): string {
  if (documents.length === 0) return '(nenhum documento encontrado)';
  return documents.map((doc) => `- ${rotuloDocumento(doc)} ${doc.paragraph}`).join('\n');
}
