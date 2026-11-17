import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import Fastify from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { mcpHttpPlugin, type McpHttpPluginOptions } from './http-plugin.js';
import { MENSAGEM_ERRO_PERGUNTAR, type GetGraph, type GrafoPerguntavel } from './server.js';

const RESPOSTA = 'A receita líquida da Vale no 2T26 foi de R$ 53,0 bilhões [VALE 2T26].';

function grafoFake() {
  const invoke = vi.fn<GrafoPerguntavel['invoke']>(async () => ({ finalAnswer: RESPOSTA }));
  const getGraph = vi.fn<GetGraph>(async () => ({ invoke }));
  return { invoke, getGraph };
}

function appCom(opcoes: McpHttpPluginOptions) {
  const app = Fastify();
  app.register(mcpHttpPlugin, { prefix: '/mcp', ...opcoes });
  return app;
}

// O Streamable HTTP exige que o cliente aceite os dois formatos, mesmo com resposta JSON.
const HEADERS = {
  accept: 'application/json, text/event-stream',
  'content-type': 'application/json',
};

function rpc(method: string, params: Record<string, unknown> = {}, id = 1) {
  return { jsonrpc: '2.0', id, method, params };
}

const INITIALIZE = rpc('initialize', {
  protocolVersion: '2025-06-18',
  capabilities: {},
  clientInfo: { name: 'teste', version: '0.0.0' },
});

describe('mcpHttpPlugin', () => {
  it('responde ao initialize sem criar sessão: nenhum mcp-session-id', async () => {
    const response = await appCom(grafoFake()).inject({
      method: 'POST',
      url: '/mcp',
      headers: HEADERS,
      payload: INITIALIZE,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().result.serverInfo.name).toBe('ai-researcher');
    expect(response.headers['mcp-session-id']).toBeUndefined();
  });

  it('lista a tool perguntar e chama o grafo num pedido avulso, sem initialize antes', async () => {
    const { getGraph, invoke } = grafoFake();
    const app = appCom({ getGraph });

    const lista = await app.inject({
      method: 'POST',
      url: '/mcp',
      headers: HEADERS,
      payload: rpc('tools/list'),
    });
    const chamada = await app.inject({
      method: 'POST',
      url: '/mcp',
      headers: HEADERS,
      payload: rpc('tools/call', {
        name: 'perguntar',
        arguments: { pergunta: 'Receita da Vale?' },
      }),
    });

    expect(lista.json().result.tools.map((t: { name: string }) => t.name)).toEqual(['perguntar']);
    expect(chamada.json().result.content).toEqual([{ type: 'text', text: RESPOSTA }]);
    // Sem o tracing registado (os testes não têm chaves da Langfuse), nenhum CallbackHandler da
    // Langfuse: só o das métricas, que vai sempre.
    expect(invoke).toHaveBeenCalledWith(
      { question: 'Receita da Vale?' },
      { callbacks: [expect.objectContaining({ name: 'metrics-callback' })] },
    );
  });

  it('com o grafo a falhar, devolve isError com a mensagem genérica, sem a exceção crua', async () => {
    const { getGraph, invoke } = grafoFake();
    invoke.mockRejectedValue(new Error('ECONNREFUSED 127.0.0.1:5434'));

    const response = await appCom({ getGraph }).inject({
      method: 'POST',
      url: '/mcp',
      headers: HEADERS,
      payload: rpc('tools/call', { name: 'perguntar', arguments: { pergunta: 'q' } }),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().result).toEqual({
      isError: true,
      content: [{ type: 'text', text: MENSAGEM_ERRO_PERGUNTAR }],
    });
    expect(response.body).not.toContain('ECONNREFUSED');
  });

  it.each(['GET', 'DELETE'] as const)('%s responde 405, porque não há sessão', async (method) => {
    const response = await appCom(grafoFake()).inject({ method, url: '/mcp' });

    expect(response.statusCode).toBe(405);
    expect(response.headers.allow).toBe('POST');
    expect(response.json().error.message).toBe('Method not allowed.');
  });

  it('recusa com 406 o cliente que não aceita text/event-stream', async () => {
    const response = await appCom(grafoFake()).inject({
      method: 'POST',
      url: '/mcp',
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      payload: rpc('tools/list'),
    });

    expect(response.statusCode).toBe(406);
  });

  it('com hostsPermitidos, recusa pedido com Host fora da lista (DNS rebinding)', async () => {
    const app = appCom({ ...grafoFake(), hostsPermitidos: ['127.0.0.1:3100'] });

    const recusado = await app.inject({
      method: 'POST',
      url: '/mcp',
      headers: { ...HEADERS, host: 'site-malicioso.com' },
      payload: rpc('tools/list'),
    });
    const aceite = await app.inject({
      method: 'POST',
      url: '/mcp',
      headers: { ...HEADERS, host: '127.0.0.1:3100' },
      payload: rpc('tools/list'),
    });

    expect(recusado.statusCode).toBe(403);
    expect(aceite.statusCode).toBe(200);
  });

  describe('com o cliente Streamable HTTP do SDK', () => {
    let fechar: (() => Promise<void>) | undefined;

    afterEach(async () => {
      await fechar?.();
    });

    it('conversa com o servidor por HTTP de verdade: initialize, listagem e chamada', async () => {
      const { getGraph } = grafoFake();
      const app = appCom({ getGraph });
      // Porta 0: o sistema escolhe uma livre, só na interface local.
      const endereco = await app.listen({ port: 0, host: '127.0.0.1' });
      const cliente = new Client({ name: 'teste', version: '0.0.0' });
      fechar = async () => {
        await cliente.close();
        await app.close();
      };

      await cliente.connect(new StreamableHTTPClientTransport(new URL(`${endereco}/mcp`)));
      const { tools } = await cliente.listTools();
      const resultado = await cliente.callTool({
        name: 'perguntar',
        arguments: { pergunta: 'Receita da Vale?' },
      });

      expect(tools.map((t) => t.name)).toEqual(['perguntar']);
      expect(resultado.content).toEqual([{ type: 'text', text: RESPOSTA }]);
    });
  });
});
