import { registroMetricas } from '@hero/agent';
import { describe, expect, it } from 'vitest';

import { build } from '../app.js';
import type { RegistroDeMetricas } from './metrics.js';

describe('GET /api/metrics', () => {
  it('responde o texto do registry, com o Content-Type dele', async () => {
    const registro: RegistroDeMetricas = {
      contentType: 'text/plain; version=0.0.4; charset=utf-8',
      metrics: async () => 'llm_cost_usd_total{node="answer",model="gemini-3.6-flash"} 0.0023\n',
    };
    const app = build({ checkDatabase: async () => true, registroMetricas: registro });

    const response = await app.inject({ method: 'GET', url: '/api/metrics' });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toBe('text/plain; version=0.0.4; charset=utf-8');
    expect(response.body).toBe(
      'llm_cost_usd_total{node="answer",model="gemini-3.6-flash"} 0.0023\n',
    );
  });

  // O registry real do @hero/agent encaixa na interface mínima, sem a API importar o prom-client.
  it('com o registroMetricas do agente, expõe os dois contadores no formato do Prometheus', async () => {
    const app = build({ checkDatabase: async () => true, registroMetricas });

    const response = await app.inject({ method: 'GET', url: '/api/metrics' });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toMatch(/^text\/plain; version=0\.0\.4/);
    expect(response.body).toContain('# TYPE llm_tokens_total counter');
    expect(response.body).toContain('# TYPE llm_cost_usd_total counter');
  });

  it('se o registry falhar, responde 500 em problem+json, como qualquer outro erro', async () => {
    const registro: RegistroDeMetricas = {
      contentType: 'text/plain; version=0.0.4; charset=utf-8',
      metrics: async () => {
        throw new Error('coletor rebentou');
      },
    };
    const app = build({ checkDatabase: async () => true, registroMetricas: registro });

    const response = await app.inject({ method: 'GET', url: '/api/metrics' });

    expect(response.statusCode).toBe(500);
    expect(response.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(response.body).not.toContain('coletor rebentou');
  });

  it('sem registroMetricas, a rota não existe', async () => {
    const app = build({ checkDatabase: async () => true });

    const response = await app.inject({ method: 'GET', url: '/api/metrics' });

    expect(response.statusCode).toBe(404);
  });
});
