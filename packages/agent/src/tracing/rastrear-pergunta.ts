import type { BaseCallbackHandler } from '@langchain/core/callbacks/base';
import { CallbackHandler } from '@langfuse/langchain';
import { propagateAttributes, startActiveObservation } from '@langfuse/tracing';

import { modoDemoAtivo } from '../demo/modo-demo.js';
import { tracingAtivo } from './registrar.js';

/**
 * Um trace da Langfuse por pergunta:
 *
 *   answer-question (agent)        ← rastrearPergunta: a pergunta, a resposta e o canal
 *   └─ LangGraph                   ← o CallbackHandler passado ao graph.stream()/graph.invoke()
 *      ├─ retrieve
 *      ├─ grade  └─ generation (MODEL_GRADE, tokens, custo)
 *      ├─ webSearch
 *      └─ answer └─ generation (MODEL_ANSWER, tokens, custo)
 *
 * O nome do trace é API: dashboards, filtros e avaliadores da Langfuse procuram por ele. Fica fixo,
 * sem modelo nem valor dinâmico.
 */
const NOME_TRACE = 'answer-question';

/** Por onde a pergunta chegou: vira tag, para filtrar e comparar os dois canais na Langfuse. */
export type CanalPergunta = 'chat' | 'mcp';

/**
 * Os callbacks a passar ao graph.stream() ou ao graph.invoke() desta pergunta. O rastrearPergunta
 * entrega um CallbackHandler da Langfuse novo com o tracing ligado, ou nenhum sem ele; o call site
 * soma-lhe o das métricas (criarMetricsCallback). Daí o tipo ser o handler base do LangChain.
 */
export type CallbacksDaPergunta = BaseCallbackHandler[];

/**
 * Abre o trace de uma pergunta e corre `executar` dentro dele, com um CallbackHandler novo para o
 * grafo: cada nó vira um span e cada chamada ao LLM uma generation, aninhados sob esta raiz. A
 * raiz guarda o que interessa ver de relance na lista de traces: a pergunta como input e a resposta
 * final como output, e não o estado inteiro do grafo.
 *
 * `executar` recebe os callbacks, passa-os ao grafo e devolve a resposta final, ou null quando não
 * há (o cliente do /chat desligou a meio). Uma exceção fica registada na raiz e é relançada.
 *
 * Sem o tracing registado no processo (registrarTracingLangfuse), corre `executar` sem callbacks e
 * sem abrir trace nenhum.
 */
export async function rastrearPergunta<Resposta extends string | null>(
  pergunta: string,
  canal: CanalPergunta,
  executar: (callbacks: CallbacksDaPergunta) => Promise<Resposta>,
): Promise<Resposta> {
  if (!tracingAtivo()) return executar([]);

  // Tags são imutáveis e definidas na criação do trace: servem para o que se sabe à partida.
  const tags: string[] = modoDemoAtivo() ? [canal, 'demo'] : [canal];

  return startActiveObservation(
    NOME_TRACE,
    async (raiz) => {
      raiz.update({ input: pergunta });

      return propagateAttributes({ traceName: NOME_TRACE, tags }, async () => {
        try {
          // Um handler por chamada, e não um partilhado pelo processo: o estado de cada execução
          // (os runs abertos, o último trace) fica só nesta pergunta.
          const resposta = await executar([new CallbackHandler()]);
          if (resposta !== null) raiz.update({ output: resposta });
          return resposta;
        } catch (erro) {
          raiz.update({
            level: 'ERROR',
            statusMessage: erro instanceof Error ? erro.message : String(erro),
          });
          throw erro;
        }
      });
    },
    { asType: 'agent' },
  );
}
