import { rastrearPergunta } from '@hero/agent';
import type { LangfuseSpanProcessorParams } from '@langfuse/otel';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { criarProcessadorLangfuse } from './langfuse-processor.js';

type Exportador = NonNullable<LangfuseSpanProcessorParams['exporter']>;
type SpanExportado = Parameters<Exportador['export']>[0][number];

/** Um exportador em memória: os spans ficam aqui em vez de irem para a Langfuse. */
function exportadorLocal(): Exportador & { spans: SpanExportado[] } {
  const spans: SpanExportado[] = [];
  return {
    spans,
    export(lote, terminar) {
      spans.push(...lote);
      terminar({ code: 0 });
    },
    async shutdown() {},
  };
}

describe('criarProcessadorLangfuse', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // Guarda contra uma falha que já aconteceu: com duas cópias do @opentelemetry/api (uma no
  // @hero/agent, outra no sdk-node da API), o trace do agent ia para um tracer no-op e nada
  // chegava à Langfuse, sem erro nenhum. A raiz tem de chegar ao processor da API.
  it('recebe o trace aberto pelo @hero/agent, com nome, tag e a pergunta mascarada', async () => {
    // Chaves fictícias: o exportador é local, nada sai do teste.
    vi.stubEnv('LANGFUSE_PUBLIC_KEY', 'pk-lf-teste');
    vi.stubEnv('LANGFUSE_SECRET_KEY', 'sk-lf-teste');
    const exportador = exportadorLocal();
    const sdk = new NodeSDK({ spanProcessors: [criarProcessadorLangfuse(exportador)] });
    sdk.start();

    try {
      await rastrearPergunta('Sou a@b.com. Receita da Vale?', 'chat', async () => 'R$ 56,7 bi.');
    } finally {
      // O shutdown esvazia a fila do processor para o exportador.
      await sdk.shutdown();
    }

    const raiz = exportador.spans.find((span) => span.name === 'answer-question');
    expect(raiz?.attributes['langfuse.trace.name']).toBe('answer-question');
    expect(raiz?.attributes['langfuse.trace.tags']).toEqual(['chat']);
    expect(raiz?.attributes['langfuse.observation.input']).toBe('Sou [EMAIL]. Receita da Vale?');
    expect(raiz?.attributes['langfuse.observation.output']).toBe('R$ 56,7 bi.');
  });
});
