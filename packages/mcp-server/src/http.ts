import Fastify from 'fastify';
import { obterGrafoReal } from '@hero/agent';

import { mcpHttpPlugin } from './http-plugin.js';

// Ponto de entrada do servidor MCP standalone via Streamable HTTP, com porta própria. Arranca ao
// ser executado: nunca importe este arquivo como biblioteca (use o index.ts).
const PORTA = Number(process.env.MCP_HTTP_PORT ?? 3100);
// Só na máquina local: é uma ferramenta de desenvolvimento, que chama a Vertex AI a cada pergunta.
// Em produção, o MCP passa pelo gateway /api/mcp do apps/api.
const HOST = '127.0.0.1';

const app = Fastify({ logger: true });
app.register(mcpHttpPlugin, {
  prefix: '/mcp',
  getGraph: obterGrafoReal,
  hostsPermitidos: [`127.0.0.1:${PORTA}`, `localhost:${PORTA}`],
});

await app.listen({ port: PORTA, host: HOST });
