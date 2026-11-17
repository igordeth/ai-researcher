import {
  isDefaultExportSpan,
  LangfuseSpanProcessor,
  type LangfuseSpanProcessorParams,
  type ShouldExportSpan,
} from '@langfuse/otel';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';

import { mascararDadosPessoais } from './mascarar-dados.js';

// O filtro por defeito da Langfuse (spans da Langfuse e de LLM), menos o __start__ do LangGraph:
// um passo interno de 0 ms em todas as perguntas, que só polui a árvore do trace.
const exportarSpan: ShouldExportSpan = ({ otelSpan }) =>
  isDefaultExportSpan(otelSpan) && otelSpan.name !== '__start__';

// Se este processo registou o tracing. O rastrearPergunta lê-o: sem registo, não abre trace nem
// cria CallbackHandler.
let ativo = false;

export function tracingAtivo(): boolean {
  return ativo;
}

/** Envia o que está na fila do processor para a Langfuse e desliga o tracing do processo. */
export type EncerrarTracing = () => Promise<void>;

/**
 * Regista o tracing da Langfuse no processo: um NodeTracerProvider do OpenTelemetry com o
 * LangfuseSpanProcessor, registado como o provider global (e, com ele, o gestor de contexto que
 * permite aninhar os spans do grafo sob a raiz da pergunta). Chame uma vez, no arranque de cada
 * processo que pode correr o grafo: o apps/api e os dois transportes do mcp-server.
 *
 * Sem LANGFUSE_PUBLIC_KEY e LANGFUSE_SECRET_KEY, não regista nada e devolve null: o processo sobe
 * igual, e o grafo corre sem trace. Não escreve nada no stdout (o transporte stdio do MCP usa-o
 * como canal do protocolo): avisar que o tracing está desligado fica com quem chama.
 *
 * O LANGFUSE_BASE_URL e o LANGFUSE_TRACING_ENVIRONMENT são lidos do ambiente pelo processor.
 * `exporter` só existe para o teste: com um exportador local, os spans não vão para a rede.
 */
export function registrarTracingLangfuse(
  exporter?: LangfuseSpanProcessorParams['exporter'],
): EncerrarTracing | null {
  if (!process.env.LANGFUSE_PUBLIC_KEY || !process.env.LANGFUSE_SECRET_KEY) return null;
  if (ativo) throw new Error('O tracing da Langfuse já foi registado neste processo.');

  const provider = new NodeTracerProvider({
    spanProcessors: [
      new LangfuseSpanProcessor({
        exporter,
        mask: ({ data }) => mascararDadosPessoais(data),
        shouldExportSpan: exportarSpan,
      }),
    ],
  });
  provider.register();
  ativo = true;

  return async () => {
    ativo = false;
    // O processor envia em lotes: sem o shutdown, os traces das últimas perguntas antes de o
    // processo parar perdiam-se.
    await provider.shutdown();
  };
}
