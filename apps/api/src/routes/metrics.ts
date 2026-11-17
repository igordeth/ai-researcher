import type { FastifyPluginAsync } from 'fastify';

/**
 * Só o que a rota usa do registry de métricas: o texto no formato do Prometheus e o Content-Type
 * dele. O Registry do prom-client (o registroMetricas do @hero/agent) encaixa aqui sem adaptação, e
 * a API não depende do prom-client: quem escolhe a biblioteca de métricas é o pacote que as declara.
 */
export interface RegistroDeMetricas {
  /** O Content-Type do formato de texto, com a versão (text/plain; version=0.0.4 no prom-client). */
  readonly contentType: string;
  /** Todas as métricas do registry, já no formato de texto do Prometheus. */
  metrics(): Promise<string>;
}

export interface MetricsRouteOptions {
  registro: RegistroDeMetricas;
}

const metricsRoute: FastifyPluginAsync<MetricsRouteOptions> = async (app, { registro }) => {
  // Fora do rate limiting: o Prometheus faz scrape a intervalo fixo, e um 429 abriria um buraco na
  // série.
  app.get('/metrics', { config: { rateLimit: false } }, async (_request, reply) => {
    // O Content-Type vem do registry, e não fixo aqui: a versão do formato é dele, e o Prometheus
    // lê-a para saber como interpretar o corpo.
    reply.type(registro.contentType);
    return registro.metrics();
  });
};

export default metricsRoute;
