import Fastify from 'fastify';
import { mcpHttpPlugin, type GrafoPerguntavel } from '@hero/mcp-server';
import { tratarErro } from './error-handler.js';
import chatRoute, { type GraphLike } from './routes/chat.js';
import healthRoute from './routes/health.js';
import { checkDatabase as defaultCheckDatabase } from './db.js';

/** O grafo como as duas rotas o usam: o /chat com stream, o /mcp com invoke. */
export type GrafoDaApi = GraphLike & GrafoPerguntavel;

export interface BuildOptions {
  checkDatabase?: () => Promise<boolean>;
  // Sem getGraph, o /api/chat e o /api/mcp não são registados. Ligar o grafo real (Vertex AI,
  // Serper, Postgres) é um passo à parte, com a configuração de deploy que ele exige.
  getGraph?: () => Promise<GrafoDaApi>;
}

export function build({ checkDatabase = defaultCheckDatabase, getGraph }: BuildOptions = {}) {
  const app = Fastify({ logger: true });

  // Um só tratamento de erro para a aplicação inteira, registado antes das rotas para valer em
  // todas: as rotas lançam, e é aqui que o erro vira status e application/problem+json.
  app.setErrorHandler(tratarErro);

  app.register(
    async (api) => {
      api.register(healthRoute, { checkDatabase });
      if (getGraph) {
        // O mesmo getGraph nas duas rotas: uma só instância do grafo, e com ela um só
        // SearchProvider e um só circuit breaker para a API de busca.
        api.register(chatRoute, { getGraph });
        // Gateway MCP para o Angular, na mesma porta e atrás do mesmo proxy /api que o /chat: sem
        // CORS. Sem hostsPermitidos: atrás do proxy, o Host muda com o ambiente.
        api.register(mcpHttpPlugin, { prefix: '/mcp', getGraph });
      }
    },
    { prefix: '/api' },
  );

  return app;
}
