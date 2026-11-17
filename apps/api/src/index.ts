import { obterGrafoReal } from '@hero/agent';
import { build } from './app.js';

// A mesma função nas duas rotas, e não uma por rota: obterGrafoReal é memoizada, então o /chat e o
// /mcp recebem a mesma instância do grafo, com um só pool do Postgres, um só cliente da Vertex AI
// e um só circuit breaker da busca. Nada é construído aqui: o grafo só nasce no primeiro pedido.
const app = build({ getChatGraph: obterGrafoReal, getMcpGraph: obterGrafoReal });

app.listen({ port: Number(process.env.PORT ?? 3000), host: '0.0.0.0' }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
