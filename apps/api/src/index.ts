import { obterGrafoReal, registrarTracingLangfuse } from '@hero/agent';
import { build } from './app.js';

// Antes de o servidor aceitar pedidos: o primeiro /chat já tem para onde mandar o trace. Sem as
// chaves da Langfuse, nada é registado e a API sobe igual.
const encerrarTracing = registrarTracingLangfuse();
if (!encerrarTracing) {
  console.info('Langfuse desligada: LANGFUSE_PUBLIC_KEY ou LANGFUSE_SECRET_KEY não definida.');
}

// A mesma função nas duas rotas, e não uma por rota: obterGrafoReal é memoizada, então o /chat e o
// /mcp recebem a mesma instância do grafo, com um só pool do Postgres, um só cliente da Vertex AI
// e um só circuit breaker da busca. Nada é construído aqui: o grafo só nasce no primeiro pedido.
const app = build({ getChatGraph: obterGrafoReal, getMcpGraph: obterGrafoReal });

app.listen({ port: Number(process.env.PORT ?? 3000), host: '0.0.0.0' }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});

// O Cloud Run manda SIGTERM antes de parar a instância; o Ctrl+C do `pnpm dev` manda SIGINT. A
// ordem importa: primeiro o servidor deixa de aceitar pedidos e termina os que estão a meio,
// depois os traces que ficaram na fila são enviados para a Langfuse.
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
