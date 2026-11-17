import { NodeSDK } from '@opentelemetry/sdk-node';

import { criarProcessadorLangfuse } from './langfuse-processor.js';

/**
 * Liga o OpenTelemetry com o exportador da Langfuse. Tem de ser o primeiro import do index.ts:
 * os traces criados antes do sdk.start() não teriam para onde ir.
 *
 * Sem LANGFUSE_PUBLIC_KEY e LANGFUSE_SECRET_KEY (testes, o e2e, um CI sem segredos), nada arranca
 * e os spans do grafo ficam no tracer no-op: a API funciona igual, só não exporta.
 */
function iniciarTracing(): NodeSDK | null {
  if (!process.env.LANGFUSE_PUBLIC_KEY || !process.env.LANGFUSE_SECRET_KEY) {
    console.info('Langfuse desligada: LANGFUSE_PUBLIC_KEY ou LANGFUSE_SECRET_KEY não definida.');
    return null;
  }

  // Sem instrumentações automáticas (HTTP, pg): só os spans da Langfuse e do grafo, sem o ruído
  // de cada pedido HTTP e de cada query na árvore do trace.
  const sdk = new NodeSDK({ spanProcessors: [criarProcessadorLangfuse()] });
  sdk.start();
  return sdk;
}

const sdk = iniciarTracing();

/**
 * Exporta o que ainda está na fila e desliga o OpenTelemetry. O processor envia em lotes; sem
 * isto, os traces das últimas perguntas antes de o Cloud Run parar a instância perdiam-se.
 */
export async function encerrarTracing(): Promise<void> {
  await sdk?.shutdown();
}
