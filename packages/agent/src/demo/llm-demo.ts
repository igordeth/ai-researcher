import type { AnswerLlm } from '../nodes/answer.js';
import type { GradeLlm } from '../nodes/grade.js';

/**
 * O texto que o answer do modo DEMO devolve, seja qual for a pergunta. Usa os números do documento
 * que a busca demo devolve (DOCUMENTO_VALE_3T25), com o mesmo rótulo de citação que o modelo real
 * escreveria, e diz que é demonstração: ninguém deve tomá-lo pela resposta à sua pergunta.
 */
export const RESPOSTA_DEMO =
  'No 3T25, a receita líquida da Vale foi de R$ 56,7 bilhões, alta de 7,0% frente ao 3T24, e o ' +
  'lucro líquido foi de R$ 14,7 bilhões, com margem líquida de 25,9% [VALE 3T25]. Esta é uma ' +
  'resposta de demonstração: no modo DEMO, o assistente responde sempre com este trecho, seja ' +
  'qual for a pergunta.';

/**
 * O grade do modo DEMO: considera sempre o contexto suficiente, e por isso o grafo vai direto do
 * grade para o answer, sem passar pelo webSearch.
 */
export function criarGradeLlmDemo(): GradeLlm {
  return {
    withStructuredOutput: () => ({
      invoke: async () => ({ sufficient: true, missingAspects: [] }),
    }),
  };
}

/** O answer do modo DEMO: sempre a RESPOSTA_DEMO, sem Vertex AI. */
export function criarAnswerLlmDemo(): AnswerLlm {
  return { invoke: async () => ({ text: RESPOSTA_DEMO }) };
}
