import { CallbackHandler } from '@langfuse/langchain';
import type { LangfuseSpanProcessorParams } from '@langfuse/otel';
import { RunnableLambda } from '@langchain/core/runnables';
import { context, propagation, trace } from '@opentelemetry/api';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { rastrearPergunta, type CallbacksDaPergunta } from './rastrear-pergunta.js';
import { registrarTracingLangfuse, tracingAtivo, type EncerrarTracing } from './registrar.js';

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

let encerrar: EncerrarTracing | null = null;

afterEach(async () => {
  await encerrar?.();
  encerrar = null;
  // O register() pôs o provider e o gestor de contexto no estado global do OpenTelemetry: limpar,
  // para o teste seguinte poder registar de novo.
  trace.disable();
  context.disable();
  propagation.disable();
  vi.unstubAllEnvs();
});

describe('sem as chaves da Langfuse', () => {
  it('não regista nada, e o processo segue', () => {
    vi.stubEnv('LANGFUSE_PUBLIC_KEY', undefined);
    vi.stubEnv('LANGFUSE_SECRET_KEY', undefined);

    expect(registrarTracingLangfuse()).toBeNull();
    expect(tracingAtivo()).toBe(false);
  });

  it('a pergunta corre sem CallbackHandler, com a resposta e os erros de sempre', async () => {
    const executar = vi.fn<(callbacks: CallbacksDaPergunta) => Promise<string>>(
      async () => 'R$ 56,7 bilhões.',
    );
    await expect(rastrearPergunta('q', 'chat', executar)).resolves.toBe('R$ 56,7 bilhões.');
    expect(executar).toHaveBeenCalledWith([]);

    const erro = new Error('Vertex AI respondeu 503');
    await expect(
      rastrearPergunta('q', 'mcp', async () => {
        throw erro;
      }),
    ).rejects.toBe(erro);
  });
});

describe('com as chaves da Langfuse', () => {
  function registrarComExportadorLocal() {
    // Chaves fictícias: o exportador é local, nada sai do teste.
    vi.stubEnv('LANGFUSE_PUBLIC_KEY', 'pk-lf-teste');
    vi.stubEnv('LANGFUSE_SECRET_KEY', 'sk-lf-teste');
    const exportador = exportadorLocal();
    encerrar = registrarTracingLangfuse(exportador);
    return exportador;
  }

  it('cria um CallbackHandler novo a cada pergunta', async () => {
    registrarComExportadorLocal();
    const recebidos: CallbacksDaPergunta[] = [];
    const executar = async (callbacks: CallbacksDaPergunta) => {
      recebidos.push(callbacks);
      return 'ok';
    };

    await rastrearPergunta('q1', 'chat', executar);
    await rastrearPergunta('q2', 'chat', executar);

    expect(recebidos[0]).toHaveLength(1);
    expect(recebidos[0][0]).toBeInstanceOf(CallbackHandler);
    expect(recebidos[1][0]).not.toBe(recebidos[0][0]);
  });

  // Também guarda contra uma falha que já aconteceu: com duas cópias do @opentelemetry/api, os
  // spans iam para um tracer no-op e nada chegava ao processor, sem erro nenhum.
  it('exporta a raiz da pergunta, com o que o LangChain corre aninhado nela', async () => {
    const exportador = registrarComExportadorLocal();
    const grafoFalso = RunnableLambda.from(async () => 'R$ 56,7 bi.').withConfig({
      runName: 'grafo-falso',
    });

    await rastrearPergunta('Sou a@b.com. Receita da Vale?', 'chat', (callbacks) =>
      grafoFalso.invoke({}, { callbacks }),
    );
    // O shutdown esvazia a fila do processor para o exportador.
    await encerrar?.();
    encerrar = null;

    const raiz = exportador.spans.find((span) => span.name === 'answer-question');
    const grafo = exportador.spans.find((span) => span.name === 'grafo-falso');
    expect(raiz?.attributes['langfuse.trace.name']).toBe('answer-question');
    expect(raiz?.attributes['langfuse.trace.tags']).toEqual(['chat']);
    expect(raiz?.attributes['langfuse.observation.input']).toBe('Sou [EMAIL]. Receita da Vale?');
    expect(raiz?.attributes['langfuse.observation.output']).toBe('R$ 56,7 bi.');
    expect(grafo?.parentSpanContext?.spanId).toBe(raiz?.spanContext().spanId);
    expect(tracingAtivo()).toBe(false);
  });

  it('recusa registar duas vezes no mesmo processo', () => {
    registrarComExportadorLocal();

    expect(() => registrarTracingLangfuse(exportadorLocal())).toThrow('já foi registado');
  });
});
