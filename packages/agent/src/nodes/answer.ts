import { formatarResposta } from '../answer/format-resposta.js';
import type { RetrievedDoc } from '../db/retrieve-similar.js';
import { answerPrompt } from '../prompts/answer.js';

/** A parte do estado do grafo que este nó lê. */
export interface AnswerState {
  question: string;
  documents: RetrievedDoc[];
  sufficient: boolean;
}

// Só a operação de que o nó precisa, escrita por extenso. O ChatVertexAI real devolve uma mensagem
// com o getter `text` e se encaixa sem adaptação; o fake do teste implementa só ele.
export interface AnswerLlm {
  invoke(prompt: string): Promise<{ text: string }>;
}

/**
 * Nó `answer`: gera a resposta final com o contexto recuperado. A resposta do modelo passa sempre
 * pelo filtro determinístico antes de chegar ao estado: o guardrail não depende do modelo obedecer
 * ao prompt.
 */
export function makeAnswerNode(llm: AnswerLlm) {
  return async function answer(state: AnswerState): Promise<{ finalAnswer: string }> {
    const resposta = await llm.invoke(
      answerPrompt({
        question: state.question,
        documents: state.documents,
        sufficient: state.sufficient,
      }),
    );

    // Uma resposta vazia sairia como só o bloco de fontes, que parece uma resposta e não é.
    if (resposta.text.trim() === '') {
      throw new Error('O LLM devolveu uma resposta vazia no nó answer');
    }

    return { finalAnswer: formatarResposta(resposta.text, state.documents) };
  };
}
