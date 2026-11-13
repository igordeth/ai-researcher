import Fastify from 'fastify';
import { tratarErro } from './error-handler.js';
import chatRoute, { type GraphLike } from './routes/chat.js';
import healthRoute from './routes/health.js';
import { checkDatabase as defaultCheckDatabase } from './db.js';

export interface BuildOptions {
  checkDatabase?: () => Promise<boolean>;
  // Sem grafo, o /api/chat não é registado. Ligar o grafo real (Vertex AI, Serper, Postgres) é
  // um passo à parte, com a configuração de deploy que ele exige.
  graph?: GraphLike;
}

export function build({ checkDatabase = defaultCheckDatabase, graph }: BuildOptions = {}) {
  const app = Fastify({ logger: true });

  // Um só tratamento de erro para a aplicação inteira, registado antes das rotas para valer em
  // todas: as rotas lançam, e é aqui que o erro vira status e application/problem+json.
  app.setErrorHandler(tratarErro);

  app.register(
    async (api) => {
      api.register(healthRoute, { checkDatabase });
      if (graph) api.register(chatRoute, { graph });
    },
    { prefix: '/api' },
  );

  return app;
}
