import { afterEach, describe, expect, it, vi } from 'vitest';

import { build } from './app.js';
import type { GraphLike } from './routes/chat.js';
import type { RegistroDeMetricas } from './routes/metrics.js';

const grafoFake: GraphLike = {
  stream: async () =>
    (async function* () {
      yield { answer: { finalAnswer: 'ok' } };
    })(),
};

const registroFake: RegistroDeMetricas = {
  contentType: 'text/plain; version=0.0.4; charset=utf-8',
  metrics: async () => '',
};

function appComTudo() {
  return build({
    checkDatabase: async () => true,
    getChatGraph: async () => grafoFake,
    registroMetricas: registroFake,
  });
}

const PERGUNTA = { method: 'POST' as const, url: '/api/chat', payload: { question: 'q' } };

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('rate limiting', () => {
  it('passado RATE_LIMIT_MAX, responde 429 em problem+json com Retry-After', async () => {
    vi.stubEnv('RATE_LIMIT_MAX', '2');
    const app = appComTudo();

    expect((await app.inject(PERGUNTA)).statusCode).toBe(200);
    expect((await app.inject(PERGUNTA)).statusCode).toBe(200);
    const terceira = await app.inject(PERGUNTA);

    expect(terceira.statusCode).toBe(429);
    expect(terceira.headers['content-type']).toContain('application/problem+json');
    // A janela padrão é de um minuto.
    expect(terceira.headers['retry-after']).toBe('60');
    expect(terceira.json()).toMatchObject({
      type: '/problemas/limite-de-pedidos',
      title: 'Limite de pedidos excedido',
      status: 429,
    });
  });

  it('a janela vem de RATE_LIMIT_WINDOW, em milissegundos', async () => {
    vi.stubEnv('RATE_LIMIT_MAX', '1');
    vi.stubEnv('RATE_LIMIT_WINDOW', '5000');
    const app = appComTudo();

    await app.inject(PERGUNTA);
    const segunda = await app.inject(PERGUNTA);

    expect(segunda.statusCode).toBe(429);
    expect(segunda.headers['retry-after']).toBe('5');
  });

  // As opções são calculadas no build(), e não no import de limites.ts: o mesmo processo de teste
  // monta duas apps com limites diferentes.
  it('lê as variáveis a cada build(), e não uma vez no import', async () => {
    vi.stubEnv('RATE_LIMIT_MAX', '1');
    const apertada = appComTudo();
    vi.stubEnv('RATE_LIMIT_MAX', '3');
    const folgada = appComTudo();

    await apertada.inject(PERGUNTA);
    await folgada.inject(PERGUNTA);

    expect((await apertada.inject(PERGUNTA)).statusCode).toBe(429);
    expect((await folgada.inject(PERGUNTA)).statusCode).toBe(200);
  });

  it('/health e /metrics ficam de fora', async () => {
    vi.stubEnv('RATE_LIMIT_MAX', '1');
    const app = appComTudo();

    for (let vez = 0; vez < 3; vez++) {
      expect((await app.inject({ method: 'GET', url: '/api/health' })).statusCode).toBe(200);
      expect((await app.inject({ method: 'GET', url: '/api/metrics' })).statusCode).toBe(200);
    }
    // E não gastam a cota das outras rotas.
    expect((await app.inject(PERGUNTA)).statusCode).toBe(200);
  });

  it.each([
    ['RATE_LIMIT_MAX', '30x'],
    ['RATE_LIMIT_MAX', '0'],
    ['RATE_LIMIT_WINDOW', '1 minute'],
    ['DAILY_TOKEN_BUDGET', '-1'],
  ])('%s="%s" é erro no build(), e não um limite que ninguém escolheu', (variavel, valor) => {
    vi.stubEnv(variavel, valor);

    expect(() => appComTudo()).toThrow(`${variavel} inválido`);
  });
});
