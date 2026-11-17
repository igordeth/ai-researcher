/** Preço de um modelo, em USD por milhão de tokens. */
export interface PrecoModelo {
  /** Token de entrada que não veio do cache. */
  input: number;
  /** Token de entrada lido do cache implícito do Gemini: cobrado a 10% do input. */
  cacheRead: number;
  /** Token de saída. O raciocínio (thinking) do Gemini é cobrado a este mesmo preço. */
  output: number;
}

/**
 * Preços do tier Standard da Vertex AI, por modelo, com o nome exato que o ChatVertexAI põe em
 * ls_model_name (o valor de MODEL_GRADE e MODEL_ANSWER). São os mesmos da tabela de preços que a
 * Langfuse usa para o custo dos traces (worker/src/constants/default-model-prices.json, atualizada
 * a 2026-11-11): o custo no Prometheus e o custo na Langfuse batem.
 *
 * Trocar de modelo pede uma linha nova aqui. Sem ela, os tokens continuam a ser contados e o custo
 * conta como zero, com um aviso no log.
 */
export const PRECOS_USD_POR_MILHAO: Readonly<Record<string, PrecoModelo>> = {
  'gemini-3.5-flash-lite': { input: 0.3, cacheRead: 0.03, output: 2.5 },
  'gemini-3.6-flash': { input: 0.75, cacheRead: 0.075, output: 3.75 },
};
