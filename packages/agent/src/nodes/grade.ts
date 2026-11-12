import { z } from 'zod';

import type { RetrievedDoc } from '../db/retrieve-similar.js';
import { gradePrompt } from '../prompts/grade.js';

// A saída do LLM alimenta a decisão de rota (answer ou webSearch), por isso é estruturada e
// validada, e nunca texto livre interpretado com `includes`.
const gradeResultSchema = z.object({
  sufficient: z.boolean(),
  missingAspects: z.array(z.string()),
});

type GradeResult = z.infer<typeof gradeResultSchema>;

/** A parte do estado do grafo que este nó lê. */
export interface GradeState {
  question: string;
  documents: RetrievedDoc[];
}

// Só a operação de que o nó precisa, escrita por extenso. O ChatVertexAI real tem este método e se
// encaixa sem adaptação; o fake do teste implementa só ele.
export interface GradeLlm {
  withStructuredOutput(schema: typeof gradeResultSchema): {
    invoke(prompt: string): Promise<unknown>;
  };
}

/**
 * Nó `grade`: classifica se os documentos recuperados respondem a pergunta.
 * Não decide a rota. Devolve `sufficient` e `missingAspects` para a aresta condicional decidir.
 */
export function makeGradeNode(llm: GradeLlm) {
  // Criado uma vez, na montagem do grafo, e reaproveitado em todas as perguntas.
  const classificador = llm.withStructuredOutput(gradeResultSchema);

  return async function grade(state: GradeState): Promise<GradeResult & { iterations: number }> {
    const resposta = await classificador.invoke(
      gradePrompt({ question: state.question, documents: state.documents }),
    );

    // Validação à vista, sem depender do que o LangChain faz por dentro. Se o modelo devolver algo
    // fora do schema, o erro aparece aqui, e não como uma rota errada mais adiante.
    const { sufficient, missingAspects } = gradeResultSchema.parse(resposta);

    // iterations: 1 é um incremento, e não o total. O reducer do estado soma (prev + next), e a
    // aresta usa o total para parar o laço webSearch → retrieve → grade.
    return { sufficient, missingAspects, iterations: 1 };
  };
}
