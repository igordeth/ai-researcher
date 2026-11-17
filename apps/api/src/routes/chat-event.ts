import type { RetrievedDoc } from '@hero/agent';
import type { ChatEvent, DocumentoResumido } from '@hero/contracts';

/**
 * O que cada nó devolve ao estado. Em streamMode 'updates', o grafo emite um chunk por nó
 * concluído: `{ nomeDoNó: o que o nó devolveu }`. O webSearch não devolve campo nenhum (grava na
 * base), por isso só a chave interessa.
 */
export interface GraphChunk {
  retrieve?: { documents: RetrievedDoc[] };
  grade?: { sufficient: boolean; missingAspects: string[]; iterations: number };
  webSearch?: unknown;
  answer?: { finalAnswer: string };
}

// O formato dos eventos (ChatEvent, DocumentoResumido) é contrato com o frontend: vive em
// @hero/contracts. Aqui fica só a tradução dos chunks do grafo para esse formato.

function resumirDocumento(doc: RetrievedDoc): DocumentoResumido {
  if (doc.origem === 'cvm') {
    return {
      origem: 'cvm',
      ticker: doc.ticker,
      companyName: doc.companyName,
      period: doc.period,
      distance: doc.distance,
    };
  }
  return { origem: 'web', title: doc.title, sourceUrl: doc.sourceUrl, distance: doc.distance };
}

/**
 * Cria o tradutor de chunks do grafo para eventos de uma conversa. Um por pedido, porque guarda
 * uma coisa entre chunks: o update do grade traz `iterations: 1`, o incremento que o reducer do
 * estado soma, e o evento leva o total, que é o que o cliente mostra ("rodada 2 de 2").
 */
export function criarTradutorDeEventos() {
  let iterations = 0;

  return function traduzir(chunk: GraphChunk): ChatEvent[] {
    const eventos: ChatEvent[] = [];

    if (chunk.retrieve) {
      eventos.push({ type: 'retrieve', documents: chunk.retrieve.documents.map(resumirDocumento) });
    }
    if (chunk.grade) {
      iterations += chunk.grade.iterations;
      eventos.push({
        type: 'grade',
        sufficient: chunk.grade.sufficient,
        missingAspects: chunk.grade.missingAspects,
        iterations,
      });
    }
    // `in`, e não `if (chunk.webSearch)`: o update do webSearch vem vazio, e a chave basta.
    if ('webSearch' in chunk) {
      eventos.push({ type: 'webSearch' });
    }
    if (chunk.answer) {
      eventos.push({ type: 'answer', answer: chunk.answer.finalAnswer });
    }

    return eventos;
  };
}

/** Um evento no formato SSE: uma linha `data:` com o JSON, terminada por uma linha em branco. */
export function formatarEventoSse(evento: ChatEvent): string {
  return `data: ${JSON.stringify(evento)}\n\n`;
}
