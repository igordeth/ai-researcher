import {
  isDefaultExportSpan,
  LangfuseSpanProcessor,
  type LangfuseSpanProcessorParams,
  type ShouldExportSpan,
} from '@langfuse/otel';

import { mascararDadosPessoais } from './mascarar-dados.js';

// O filtro por defeito da Langfuse (spans da Langfuse e de LLM), menos o __start__ do LangGraph:
// um passo interno de 0 ms em todas as perguntas, que só polui a árvore do trace.
const exportarSpan: ShouldExportSpan = ({ otelSpan }) =>
  isDefaultExportSpan(otelSpan) && otelSpan.name !== '__start__';

/**
 * O processor que envia os spans para a Langfuse, com a máscara de dados pessoais e o filtro de
 * ruído. As chaves, o LANGFUSE_BASE_URL e o LANGFUSE_TRACING_ENVIRONMENT vêm do ambiente.
 *
 * `exporter` só existe para o teste: com um exportador local, os spans ficam em memória em vez de
 * irem para a rede.
 */
export function criarProcessadorLangfuse(
  exporter?: LangfuseSpanProcessorParams['exporter'],
): LangfuseSpanProcessor {
  return new LangfuseSpanProcessor({
    exporter,
    mask: ({ data }) => mascararDadosPessoais(data),
    shouldExportSpan: exportarSpan,
  });
}
