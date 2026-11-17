import Fastify from 'fastify';
import { obterGrafoReal, registrarTracingLangfuse } from '@hero/agent';

import { mcpHttpPlugin } from './http-plugin.js';

// Ponto de entrada do servidor MCP standalone via Streamable HTTP, com porta própria. Arranca ao
// ser executado: nunca importe este arquivo como biblioteca (use o index.ts).
const PORTA = Number(process.env.MCP_HTTP_PORT ?? 3100);
// Só na máquina local: é uma ferramenta de desenvolvimento, que chama a Vertex AI a cada pergunta.
// Em produção, o MCP passa pelo gateway /api/mcp do apps/api.
const HOST = '127.0.0.1';

// Antes de aceitar pedidos: a primeira chamada da tool já tem para onde mandar o trace. Sem as
// chaves da Langfuse, nada é registado e o servidor sobe igual.
const encerrarTracing = registrarTracingLangfuse();
if (!encerrarTracing) {
  console.info('Langfuse desligada: LANGFUSE_PUBLIC_KEY ou LANGFUSE_SECRET_KEY não definida.');
}

const app = Fastify({ logger: true });
app.register(mcpHttpPlugin, {
  prefix: '/mcp',
  getGraph: obterGrafoReal,
  hostsPermitidos: [`127.0.0.1:${PORTA}`, `localhost:${PORTA}`],
});

await app.listen({ port: PORTA, host: HOST });

// Primeiro o servidor deixa de aceitar pedidos e termina os que estão a meio, depois os traces que
// ficaram na fila são enviados para a Langfuse.
async function encerrar(sinal: NodeJS.Signals): Promise<void> {
  app.log.info(`${sinal} recebido: a encerrar.`);
  try {
    await app.close();
    await encerrarTracing?.();
    process.exit(0);
  } catch (erro) {
    app.log.error(erro, 'Falha ao encerrar');
    process.exit(1);
  }
}

process.once('SIGTERM', (sinal) => void encerrar(sinal));
process.once('SIGINT', (sinal) => void encerrar(sinal));
