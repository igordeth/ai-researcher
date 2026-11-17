import { describe, expect, it, vi } from 'vitest';
import type { DocumentoCvm, DocumentoWeb } from '@hero/agent';
import type { ChatEvent } from '@hero/contracts';

import { build } from '../app.js';
import type { GraphChunk } from './chat-event.js';
import type { GraphLike } from './chat.js';

const documentoCvm: DocumentoCvm = {
  origem: 'cvm',
  id: '1',
  ticker: 'VALE3',
  companyName: 'Vale S.A.',
  setor: 'Extração Mineral',
  period: '3T25',
  periodEnd: '2025-09-30',
  paragraph: 'No 3T25, a Vale S.A. reportou receita líquida de R$ 56,7 bilhões.',
  sourceUrl: 'https://dados.cvm.gov.br/exemplo.zip',
  fetchedAt: new Date('2026-08-08T00:00:00.000Z'),
  distance: 0.1,
};

const documentoWeb: DocumentoWeb = {
  origem: 'web',
  id: '2',
  title: 'Vale tem queda no minério',
  paragraph: 'O preço do minério caiu.',
  sourceUrl: 'https://noticias.com/vale',
  fetchedAt: new Date('2026-11-12T00:00:00.000Z'),
  distance: 0.2,
};

// A sequência que o grafo real emite numa pergunta que precisou de uma ida à web.
const LACO_COMPLETO: GraphChunk[] = [
  { retrieve: { documents: [documentoCvm] } },
  { grade: { sufficient: false, missingAspects: ['motivo da queda'], iterations: 1 } },
  { webSearch: {} },
  { retrieve: { documents: [documentoCvm, documentoWeb] } },
  { grade: { sufficient: true, missingAspects: [], iterations: 1 } },
  {
    answer: {
      finalAnswer: 'A receita caiu pelo preço do minério [web: Vale tem queda no minério].',
    },
  },
];

/** Grafo fake: emite os chunks dados e, se pedido, lança erro a meio, como um LLM que falha. */
function grafoFake(chunks: GraphChunk[], erroDepoisDe?: number) {
  const stream = vi.fn(async () =>
    (async function* () {
      for (const [indice, chunk] of chunks.entries()) {
        if (indice === erroDepoisDe) throw new Error('Vertex AI respondeu 503');
        yield chunk;
      }
    })(),
  );
  const graph: GraphLike = { stream };
  return { graph, stream };
}

// Só o /chat é registado: o grafo fake precisa apenas do stream.
function appCom(graph: GraphLike) {
  return build({ checkDatabase: async () => true, getChatGraph: async () => graph });
}

/** Lê o corpo SSE de volta para eventos: cada evento é uma linha `data: {json}` e uma em branco. */
function lerEventos(corpo: string): ChatEvent[] {
  return corpo
    .split('\n\n')
    .filter((bloco) => bloco.startsWith('data: '))
    .map((bloco) => JSON.parse(bloco.slice('data: '.length)) as ChatEvent);
}

describe('POST /api/chat', () => {
  it('transmite como SSE, com os headers que impedem o buffer no Cloud Run', async () => {
    const { graph } = grafoFake(LACO_COMPLETO);

    const response = await appCom(graph).inject({
      method: 'POST',
      url: '/api/chat',
      payload: { question: 'Por que a receita da Vale caiu?' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toBe('text/event-stream; charset=utf-8');
    expect(response.headers['cache-control']).toBe('no-cache, no-transform');
    expect(response.headers['connection']).toBe('keep-alive');
  });

  it('emite um evento por nó concluído, traduzido para o cliente', async () => {
    const { graph, stream } = grafoFake(LACO_COMPLETO);

    const response = await appCom(graph).inject({
      method: 'POST',
      url: '/api/chat',
      payload: { question: '  Por que a receita da Vale caiu?  ' },
    });

    expect(stream).toHaveBeenCalledWith(
      { question: 'Por que a receita da Vale caiu?' },
      // Sem o tracing registado (os testes não têm chaves da Langfuse), nenhum CallbackHandler da
      // Langfuse: só o das métricas, que vai sempre.
      { streamMode: 'updates', callbacks: [expect.objectContaining({ name: 'metrics-callback' })] },
    );
    expect(lerEventos(response.body)).toEqual([
      {
        type: 'retrieve',
        documents: [
          {
            origem: 'cvm',
            ticker: 'VALE3',
            companyName: 'Vale S.A.',
            period: '3T25',
            distance: 0.1,
          },
        ],
      },
      { type: 'grade', sufficient: false, missingAspects: ['motivo da queda'], iterations: 1 },
      { type: 'webSearch' },
      {
        type: 'retrieve',
        documents: [
          {
            origem: 'cvm',
            ticker: 'VALE3',
            companyName: 'Vale S.A.',
            period: '3T25',
            distance: 0.1,
          },
          {
            origem: 'web',
            title: 'Vale tem queda no minério',
            sourceUrl: 'https://noticias.com/vale',
            distance: 0.2,
          },
        ],
      },
      // O update do grade traz o incremento (1); o evento leva o total da conversa.
      { type: 'grade', sufficient: true, missingAspects: [], iterations: 2 },
      {
        type: 'answer',
        answer: 'A receita caiu pelo preço do minério [web: Vale tem queda no minério].',
      },
    ]);
  });

  it('não manda o texto dos documentos para o cliente, só o resumo', async () => {
    const { graph } = grafoFake(LACO_COMPLETO);

    const response = await appCom(graph).inject({
      method: 'POST',
      url: '/api/chat',
      payload: { question: 'q' },
    });

    expect(response.body).not.toContain(documentoCvm.paragraph);
  });

  it('escreve um evento de erro e fecha a conexão quando o grafo falha a meio', async () => {
    const { graph } = grafoFake(LACO_COMPLETO, 2);
    const app = appCom(graph);

    const response = await app.inject({
      method: 'POST',
      url: '/api/chat',
      payload: { question: 'q' },
    });

    expect(response.statusCode).toBe(200);
    expect(lerEventos(response.body).map((evento) => evento.type)).toEqual([
      'retrieve',
      'grade',
      'error',
    ]);
    // O detalhe interno fica no log, não vai para o cliente.
    expect(response.body).not.toContain('Vertex AI respondeu 503');

    // O processo continua de pé: o pedido seguinte é atendido.
    const saude = await app.inject({ method: 'GET', url: '/api/health' });
    expect(saude.statusCode).toBe(200);
  });

  it('escreve o evento de erro quando o grafo falha antes do primeiro nó', async () => {
    const stream = vi.fn().mockRejectedValue(new Error('sem conexão com a base'));

    const response = await appCom({ stream }).inject({
      method: 'POST',
      url: '/api/chat',
      payload: { question: 'q' },
    });

    expect(lerEventos(response.body)).toEqual([
      { type: 'error', message: 'Não foi possível concluir a resposta. Tente novamente.' },
    ]);
  });

  it('escreve o evento de erro quando a construção do grafo falha (configuração em falta)', async () => {
    const app = build({
      checkDatabase: async () => true,
      getChatGraph: async () => {
        throw new Error('MODEL_ANSWER não definida');
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/chat',
      payload: { question: 'q' },
    });

    expect(lerEventos(response.body)).toEqual([
      { type: 'error', message: 'Não foi possível concluir a resposta. Tente novamente.' },
    ]);
    expect(response.body).not.toContain('MODEL_ANSWER');
  });

  it.each([
    ['sem pergunta', {}],
    ['pergunta vazia', { question: '   ' }],
    ['pergunta de outro tipo', { question: 42 }],
  ])('responde 400 em problem+json com %s, sem chamar o grafo', async (_caso, payload) => {
    const { graph, stream } = grafoFake(LACO_COMPLETO);

    const response = await appCom(graph).inject({ method: 'POST', url: '/api/chat', payload });

    expect(response.statusCode).toBe(400);
    expect(response.headers['content-type']).toContain('application/problem+json');
    expect(response.json()).toMatchObject({
      type: '/problemas/pedido-invalido',
      title: 'Pedido inválido',
      status: 400,
    });
    expect(response.json().detail).toContain('question');
    expect(stream).not.toHaveBeenCalled();
  });
});
