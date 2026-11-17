import { Counter, Registry } from 'prom-client';

/**
 * O Registry das métricas do agente. Próprio, e não o registry global do prom-client: só tem o que
 * este pacote declara, e quem expõe o /metrics escolhe o que publica. Os testes também o zeram sem
 * mexer em mais nada.
 */
export const registroMetricas = new Registry();

/**
 * Tokens de cada chamada a um LLM, por nó do grafo, modelo e tipo. Os tipos não se sobrepõem, e a
 * soma deles é o total da chamada:
 *
 *   input       entrada que não veio do cache
 *   cache_read  entrada lida do cache implícito do Gemini (mais barata)
 *   output      saída visível, o texto ou o JSON da resposta
 *   reasoning   raciocínio interno do modelo (thinking), cobrado como saída
 */
export const llmTokensTotal = new Counter({
  name: 'llm_tokens_total',
  help: 'Tokens consumidos nas chamadas a LLM, contados a partir do usage_metadata devolvido pelo modelo.',
  labelNames: ['node', 'model', 'kind'] as const,
  registers: [registroMetricas],
});

/** Custo em USD das chamadas a LLM, por nó do grafo e modelo, pela tabela de precos.ts. */
export const llmCostUsdTotal = new Counter({
  name: 'llm_cost_usd_total',
  help: 'Custo em USD das chamadas a LLM: os tokens do usage_metadata vezes a tabela de preços.',
  labelNames: ['node', 'model'] as const,
  registers: [registroMetricas],
});
