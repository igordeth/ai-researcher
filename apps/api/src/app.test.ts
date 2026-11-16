import { describe, expect, it, vi } from 'vitest';
import { build, type GrafoDaApi } from './app.js';

describe('GET /api/health', () => {
  it('responde ok quando o banco está saudável', async () => {
    const app = build({ checkDatabase: async () => true });

    const response = await app.inject({ method: 'GET', url: '/api/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok', database: 'ok' });
  });

  it('responde degraded (mas HTTP 200) quando o banco falha — falha de banco não derruba o serviço', async () => {
    const app = build({ checkDatabase: async () => false });

    const response = await app.inject({ method: 'GET', url: '/api/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'degraded', database: 'error' });
  });
});

describe('/api/chat e /api/mcp na mesma app', () => {
  // Um grafo fake com as duas faces: stream para o /chat, invoke para o /mcp.
  function grafoFake() {
    const grafo: GrafoDaApi = {
      stream: vi.fn(async () =>
        (async function* () {
          yield { answer: { finalAnswer: 'resposta do chat' } };
        })(),
      ),
      invoke: vi.fn(async () => ({ finalAnswer: 'resposta do mcp' })),
    };
    const getGraph = vi.fn(async () => grafo);
    return { grafo, getGraph };
  }

  const HEADERS_MCP = {
    accept: 'application/json, text/event-stream',
    'content-type': 'application/json',
  };
  const CHAMADA_MCP = {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: { name: 'perguntar', arguments: { pergunta: 'Receita da Vale?' } },
  };

  it('o gateway /api/mcp responde a tool perguntar na mesma porta do /api/chat', async () => {
    const { getGraph } = grafoFake();
    const app = build({ checkDatabase: async () => true, getGraph });

    const response = await app.inject({
      method: 'POST',
      url: '/api/mcp',
      headers: HEADERS_MCP,
      payload: CHAMADA_MCP,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().result.content).toEqual([{ type: 'text', text: 'resposta do mcp' }]);
  });

  it('as duas rotas usam o mesmo getGraph, e por isso a mesma instância do grafo', async () => {
    const { grafo, getGraph } = grafoFake();
    const app = build({ checkDatabase: async () => true, getGraph });

    await app.inject({ method: 'POST', url: '/api/chat', payload: { question: 'q' } });
    await app.inject({
      method: 'POST',
      url: '/api/mcp',
      headers: HEADERS_MCP,
      payload: CHAMADA_MCP,
    });

    // Uma chamada por rota, à mesma função, que devolve o mesmo objeto: nada de um grafo (e um
    // circuit breaker) por rota. Com o obterGrafoReal, essa função é memoizada por processo.
    expect(getGraph).toHaveBeenCalledTimes(2);
    expect(grafo.stream).toHaveBeenCalledTimes(1);
    expect(grafo.invoke).toHaveBeenCalledTimes(1);
  });

  it('o GET em /api/mcp responde 405, sem sessão', async () => {
    const app = build({ checkDatabase: async () => true, getGraph: grafoFake().getGraph });

    const response = await app.inject({ method: 'GET', url: '/api/mcp' });

    expect(response.statusCode).toBe(405);
  });

  it('sem getGraph, nem /api/chat nem /api/mcp existem', async () => {
    const app = build({ checkDatabase: async () => true });

    const chat = await app.inject({ method: 'POST', url: '/api/chat', payload: { question: 'q' } });
    const mcp = await app.inject({ method: 'POST', url: '/api/mcp', payload: {} });

    expect(chat.statusCode).toBe(404);
    expect(mcp.statusCode).toBe(404);
  });
});
