import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { FastifyPluginAsync } from 'fastify';

import { criarServidorMcp, type GetGraph } from './server.js';

export interface McpHttpPluginOptions {
  getGraph: GetGraph;
  // Com a lista, o transporte recusa pedidos cujo Host não esteja nela: proteção contra DNS
  // rebinding, para um site aberto no navegador não conseguir chamar um servidor local. Sem a
  // lista (atrás de proxy, onde o Host varia), a proteção fica desligada.
  hostsPermitidos?: string[];
}

// O corpo que a especificação MCP espera para um método não suportado: erro JSON-RPC, não
// problem+json. É resposta de protocolo, não um erro da aplicação.
const METODO_NAO_PERMITIDO = {
  jsonrpc: '2.0',
  error: { code: -32000, message: 'Method not allowed.' },
  id: null,
};

/**
 * A tool `perguntar` via Streamable HTTP, como plugin Fastify. Registra-se com um prefixo: `/mcp`
 * no servidor standalone, `/api/mcp` dentro do apps/api.
 *
 * Stateless: cada POST cria um servidor MCP e um transporte novos, responde e descarta os dois.
 * Nada fica guardado em memória entre chamadas, e por isso o GET (stream de notificações da sessão)
 * e o DELETE (fim da sessão) respondem 405. O grafo não é recriado: vem do getGraph, que é
 * memoizado por processo.
 */
export const mcpHttpPlugin: FastifyPluginAsync<McpHttpPluginOptions> = async (app, opcoes) => {
  app.post('/', async (request, reply) => {
    const servidor = criarServidorMcp({
      getGraph: opcoes.getGraph,
      registrarErro: (erro) => request.log.error({ err: erro }, 'Falha na tool perguntar'),
    });
    const transporte = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      // Uma resposta JSON por pedido, em vez de um stream SSE: a tool não emite progresso, e JSON
      // simples passa por qualquer proxy sem bufferização.
      enableJsonResponse: true,
      enableDnsRebindingProtection: opcoes.hostsPermitidos !== undefined,
      allowedHosts: opcoes.hostsPermitidos,
    });

    // O transporte escreve a resposta direto no socket: o Fastify não deve enviar a sua.
    reply.hijack();
    reply.raw.on('close', () => {
      void transporte.close();
      void servidor.close();
    });

    try {
      await servidor.connect(transporte);
      // O corpo já vem parseado pelo Fastify; o transporte valida o JSON-RPC.
      await transporte.handleRequest(request.raw, reply.raw, request.body);
    } catch (erro) {
      request.log.error({ err: erro }, 'Falha no transporte MCP');
      if (!reply.raw.headersSent) {
        reply.raw.writeHead(500, { 'Content-Type': 'application/json' });
        reply.raw.end(
          JSON.stringify({
            jsonrpc: '2.0',
            error: { code: -32603, message: 'Internal error' },
            id: null,
          }),
        );
      }
    }
  });

  for (const method of ['GET', 'DELETE'] as const) {
    app.route({
      method,
      url: '/',
      handler: async (_request, reply) =>
        reply.code(405).header('allow', 'POST').send(METODO_NAO_PERMITIDO),
    });
  }
};
