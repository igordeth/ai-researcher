import type { FastifyPluginAsync } from 'fastify';
import { healthResponseSchema } from '@hero/contracts';

export interface HealthRouteOptions {
  checkDatabase: () => Promise<boolean>;
}

const healthRoute: FastifyPluginAsync<HealthRouteOptions> = async (app, { checkDatabase }) => {
  // Fora do rate limiting: o health check do Cloud Run e o capstone:check batem aqui em ciclo, e
  // um 429 seria lido como serviço em baixo.
  app.get('/health', { config: { rateLimit: false } }, async () => {
    const databaseOk = await checkDatabase();

    return healthResponseSchema.parse({
      status: databaseOk ? 'ok' : 'degraded',
      database: databaseOk ? 'ok' : 'error',
    });
  });
};

export default healthRoute;
