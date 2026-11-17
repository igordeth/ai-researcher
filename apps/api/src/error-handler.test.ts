import { describe, expect, it } from 'vitest';
import { SearchProviderError } from '@hero/agent';
import { chatRequestSchema, problemDetailsSchema } from '@hero/contracts';

import { build } from './app.js';
import type { GraphLike } from './routes/chat.js';

// O grafo não chega a correr nestes testes: só existe para o /api/chat ser registado.
const grafoParado: GraphLike = {
  stream: async () => {
    throw new Error('o grafo não devia correr');
  },
};

/** A app real, com rotas de teste que lançam cada tipo de erro, como uma rota de verdade faria. */
function appComRotasQueFalham() {
  const app = build({ checkDatabase: async () => true, getChatGraph: async () => grafoParado });
  app.get('/teste/zod', async () => chatRequestSchema.parse({}));
  app.get('/teste/circuito', async () => {
    throw new SearchProviderError('Serper', 'circuito-aberto', 'circuito aberto');
  });
  app.get('/teste/busca-sem-resposta', async () => {
    throw new SearchProviderError('Serper', 'sem-resposta', 'timeout');
  });
  app.get('/teste/interno', async () => {
    throw new Error('falhou: SELECT * FROM documentos WHERE senha = segredo123');
  });
  return app;
}

describe('error handler central', () => {
  it('ZodError vira 400 em problem+json, com o campo e a regra que falhou', async () => {
    const response = await appComRotasQueFalham().inject({ method: 'GET', url: '/teste/zod' });

    expect(response.statusCode).toBe(400);
    expect(response.headers['content-type']).toContain('application/problem+json');
    expect(response.json()).toMatchObject({
      type: '/problemas/pedido-invalido',
      title: 'Pedido inválido',
      status: 400,
    });
    expect(response.json().detail).toContain('question');
  });

  it('circuito aberto da busca vira 503', async () => {
    const response = await appComRotasQueFalham().inject({ method: 'GET', url: '/teste/circuito' });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({
      type: '/problemas/busca-indisponivel',
      title: 'Busca na web indisponível',
      status: 503,
      detail: 'A busca na web está temporariamente indisponível. Tente novamente em instantes.',
    });
  });

  it('outra falha da busca, que não o circuito aberto, cai no 500 genérico', async () => {
    const response = await appComRotasQueFalham().inject({
      method: 'GET',
      url: '/teste/busca-sem-resposta',
    });

    expect(response.statusCode).toBe(500);
  });

  it('qualquer outro erro vira 500 genérico, sem mensagem nem stack do erro', async () => {
    const response = await appComRotasQueFalham().inject({ method: 'GET', url: '/teste/interno' });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      type: '/problemas/erro-interno',
      title: 'Erro interno',
      status: 500,
      detail: 'Ocorreu um erro inesperado. Tente novamente.',
    });
    expect(response.body).not.toContain('segredo123');
    expect(response.body).not.toContain('SELECT');
    expect(response.body).not.toContain('error-handler.test.ts');
  });

  it('JSON malformado no corpo continua 400, agora em problem+json', async () => {
    const response = await appComRotasQueFalham().inject({
      method: 'POST',
      url: '/api/chat',
      headers: { 'content-type': 'application/json' },
      payload: '{"question": ',
    });

    expect(response.statusCode).toBe(400);
    expect(response.headers['content-type']).toContain('application/problem+json');
    expect(response.json().type).toBe('/problemas/pedido-invalido');
  });

  it('content-type não suportado mantém o 415 do Fastify, em problem+json', async () => {
    const response = await appComRotasQueFalham().inject({
      method: 'POST',
      url: '/api/chat',
      headers: { 'content-type': 'text/xml' },
      payload: '<question/>',
    });

    expect(response.statusCode).toBe(415);
    expect(response.json().type).toBe('/problemas/pedido-invalido');
  });

  it('toda resposta de erro respeita o schema partilhado com o frontend', async () => {
    const app = appComRotasQueFalham();

    for (const url of ['/teste/zod', '/teste/circuito', '/teste/interno']) {
      const response = await app.inject({ method: 'GET', url });
      expect(problemDetailsSchema.safeParse(response.json()).success).toBe(true);
    }
  });
});
