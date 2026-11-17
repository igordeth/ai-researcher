import Fastify from 'fastify';
import { mcpHttpPlugin, type GetGraph as GetMcpGraph } from '@hero/mcp-server';
import { tratarErro } from './error-handler.js';
import chatRoute, { type GetGraph as GetChatGraph } from './routes/chat.js';
import healthRoute from './routes/health.js';
import metricsRoute, { type RegistroDeMetricas } from './routes/metrics.js';
import { checkDatabase as defaultCheckDatabase } from './db.js';

export interface BuildOptions {
  checkDatabase?: () => Promise<boolean>;
  // Uma opção por rota, cada uma com o tipo que a sua rota pede: o /chat usa stream, o /mcp usa
  // invoke. Sem a opção, a rota não é registada. Para as duas partilharem o grafo (e com ele o
  // pool do Postgres e o circuit breaker da busca), quem chama passa a mesma função memoizada.
  getChatGraph?: GetChatGraph;
  getMcpGraph?: GetMcpGraph;
  // O registry que o GET /api/metrics expõe. Sem ele, a rota não é registada.
  registroMetricas?: RegistroDeMetricas;
}

export function build({
  checkDatabase = defaultCheckDatabase,
  getChatGraph,
  getMcpGraph,
  registroMetricas,
}: BuildOptions = {}) {
  const app = Fastify({ logger: true });

  // Um só tratamento de erro para a aplicação inteira, registado antes das rotas para valer em
  // todas: as rotas lançam, e é aqui que o erro vira status e application/problem+json.
  app.setErrorHandler(tratarErro);

  app.register(
    async (api) => {
      api.register(healthRoute, { checkDatabase });
      if (getChatGraph) {
        api.register(chatRoute, { getGraph: getChatGraph });
      }
      if (getMcpGraph) {
        // Gateway MCP para o Angular, na mesma porta e atrás do mesmo proxy /api que o /chat: sem
        // CORS. Sem hostsPermitidos: atrás do proxy, o Host muda com o ambiente.
        api.register(mcpHttpPlugin, { prefix: '/mcp', getGraph: getMcpGraph });
      }
      if (registroMetricas) {
        api.register(metricsRoute, { registro: registroMetricas });
      }
    },
    { prefix: '/api' },
  );

  return app;
}
