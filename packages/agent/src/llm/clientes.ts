import { ChatVertexAI } from '@langchain/google-vertexai';

// Os modelos Gemini mais recentes só respondem na região "global" da Vertex AI; os embeddings
// continuam regionais (GOOGLE_CLOUD_LOCATION). Por isso a região dos LLMs tem variável própria.
const LOCATION_LLM_PADRAO = 'global';

function modeloDe(variavel: 'MODEL_GRADE' | 'MODEL_ANSWER'): string {
  const modelo = process.env[variavel];
  // Nome de modelo nunca é fixo no código (ver CLAUDE.md, "Modelos"): cada nó tem a sua variável,
  // para trocar o modelo de um sem regravar nada e comparar o custo de cada nó.
  if (!modelo) throw new Error(`${variavel} não definida. Ver .env.example.`);
  return modelo;
}

function criarChat(variavel: 'MODEL_GRADE' | 'MODEL_ANSWER'): ChatVertexAI {
  return new ChatVertexAI({
    model: modeloDe(variavel),
    location: process.env.GOOGLE_CLOUD_LOCATION_LLM ?? LOCATION_LLM_PADRAO,
    // Temperatura 0: a mesma pergunta com o mesmo contexto dá a mesma resposta. É o que torna as
    // avaliações do dataset comparáveis e a demo gravada reproduzível.
    temperature: 0,
  });
}

/**
 * Cliente REAL do nó grade, que chama a Vertex AI. Classificação simples e em todo o laço: modelo
 * mais barato. Autenticação pelo ADC, como os embeddings.
 */
export function criarGradeLlm(): ChatVertexAI {
  return criarChat('MODEL_GRADE');
}

/** Cliente REAL do nó answer. Roda uma vez por pergunta e precisa acertar citação e guardrail. */
export function criarAnswerLlm(): ChatVertexAI {
  return criarChat('MODEL_ANSWER');
}
