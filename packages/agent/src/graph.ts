import { Annotation, END, START, StateGraph } from '@langchain/langgraph';

import type { RetrievedDoc } from './db/retrieve-similar.js';
import { makeAnswerNode, type AnswerLlm } from './nodes/answer.js';
import { makeGradeNode, type GradeLlm } from './nodes/grade.js';
import { makeRetrieveNode, type Buscar, type EmbeddingsClient } from './nodes/retrieve.js';
import {
  makeWebSearchNode,
  type BuscarPagina,
  type EmbeddingsEmLote,
  type GravarPagina,
} from './nodes/web-search.js';
import type { SearchProvider } from './search/types.js';

/**
 * Quantas vezes o `grade` pode correr numa pergunta. Com 2: a primeira avaliação, uma ida à web e
 * a segunda avaliação. Sem este limite, um LLM que responda sempre "insuficiente" prenderia o
 * grafo no laço webSearch → retrieve → grade.
 */
export const MAX_ITERATIONS = 2;

/**
 * O estado partilhado entre os nós. Cada campo diz como junta o valor novo ao antigo (o reducer):
 * a maioria substitui, e `iterations` soma. É por isso que o `grade` devolve `iterations: 1`, um
 * incremento, e o total aparece aqui sem contador externo.
 */
export const ResearchState = Annotation.Root({
  question: Annotation<string>,
  documents: Annotation<RetrievedDoc[]>({
    reducer: (_anterior, novo) => novo,
    default: () => [],
  }),
  sufficient: Annotation<boolean>({
    reducer: (_anterior, novo) => novo,
    default: () => false,
  }),
  missingAspects: Annotation<string[]>({
    reducer: (_anterior, novo) => novo,
    default: () => [],
  }),
  iterations: Annotation<number>({
    reducer: (anterior, incremento) => anterior + incremento,
    default: () => 0,
  }),
  // A resposta final, já filtrada e com as fontes. Só o nó answer escreve; quem chama o grafo lê.
  // Não se chama `answer` porque o LangGraph não deixa um campo do estado ter o nome de um nó.
  finalAnswer: Annotation<string>({
    reducer: (_anterior, novo) => novo,
    default: () => '',
  }),
});

export type ResearchStateValue = typeof ResearchState.State;

/**
 * Tudo o que os nós precisam do mundo de fora, por função ou por objeto com um método, e nunca o
 * cliente da base. Com fakes no lugar de cada um, o grafo inteiro corre num teste, sem rede nem
 * banco.
 */
export interface GraphDeps {
  // Um só cliente para os dois usos: o retrieve gera o vetor da pergunta e o webSearch os dos
  // chunks. Têm de ser o mesmo modelo, senão os vetores não são comparáveis.
  embeddings: EmbeddingsClient & EmbeddingsEmLote;
  buscar: Buscar;
  gradeLlm: GradeLlm;
  // Cliente próprio, e não o do grade: cada nó tem o seu modelo (MODEL_GRADE, MODEL_ANSWER).
  answerLlm: AnswerLlm;
  searchProvider: SearchProvider;
  buscarPagina: BuscarPagina;
  gravarPagina: GravarPagina;
}

/**
 * A decisão de rota depois do `grade`. Só lê o que o `grade` já produziu: não reavalia nada.
 * Atingir o limite não é erro: vai para o `answer` com `sufficient` falso, e a resposta avisa que o
 * contexto é parcial.
 */
function decidirDepoisDoGrade(state: ResearchStateValue): 'answer' | 'webSearch' {
  if (state.sufficient) return 'answer';
  if (state.iterations >= MAX_ITERATIONS) return 'answer';
  return 'webSearch';
}

/**
 * Monta e compila o grafo:
 *
 *   START → retrieve → grade ─┬─ suficiente, ou limite atingido → answer → END
 *                             └─ insuficiente → webSearch → retrieve
 *
 * O webSearch não passa documentos ao retrieve pelo estado: grava-os na base, e o retrieve
 * encontra-os na volta seguinte pela mesma busca por similaridade.
 */
export function buildGraph(deps: GraphDeps) {
  // Primeiro cada nó recebe as suas dependências; depois o grafo só liga nomes.
  const retrieve = makeRetrieveNode({ embeddings: deps.embeddings, buscar: deps.buscar });
  const grade = makeGradeNode(deps.gradeLlm);
  const webSearch = makeWebSearchNode({
    searchProvider: deps.searchProvider,
    embeddings: deps.embeddings,
    buscarPagina: deps.buscarPagina,
    gravarPagina: deps.gravarPagina,
  });
  const answer = makeAnswerNode(deps.answerLlm);

  return new StateGraph(ResearchState)
    .addNode('retrieve', retrieve)
    .addNode('grade', grade)
    .addNode('webSearch', webSearch)
    .addNode('answer', answer)
    .addEdge(START, 'retrieve')
    .addEdge('retrieve', 'grade')
    .addConditionalEdges('grade', decidirDepoisDoGrade, ['answer', 'webSearch'])
    .addEdge('webSearch', 'retrieve')
    .addEdge('answer', END)
    .compile();
}
