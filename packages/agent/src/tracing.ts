import { CallbackHandler } from '@langfuse/langchain';
import { propagateAttributes, startActiveObservation } from '@langfuse/tracing';

import { modoDemoAtivo } from './demo/modo-demo.js';
import type { buildGraph } from './graph.js';

type ResearchGraph = ReturnType<typeof buildGraph>;

/**
 * Tracing com a Langfuse. Duas peças, cada uma num nível do trace:
 *
 *   answer-question (agent)        ← rastrearPergunta: a pergunta e a resposta, o canal
 *   └─ run-research-graph          ← comTracing: o CallbackHandler no grafo
 *      ├─ retrieve
 *      ├─ grade  └─ generation (MODEL_GRADE, tokens, custo)
 *      ├─ webSearch
 *      └─ answer └─ generation (MODEL_ANSWER, tokens, custo)
 *
 * Os nomes são API: dashboards, filtros e avaliadores da Langfuse procuram por eles. Mudar um nome
 * quebra tudo o que o referencia, por isso ficam fixos aqui, sem modelo nem valor dinâmico.
 *
 * Sem o OpenTelemetry iniciado (o processo arranca sem as chaves da Langfuse, ou é um teste), as
 * duas peças correm sobre o tracer no-op do OpenTelemetry: nada é exportado, e nada falha.
 */
const NOME_TRACE = 'answer-question';
const NOME_GRAFO = 'run-research-graph';

/** Por onde a pergunta chegou: vira tag, para filtrar e comparar os dois canais na Langfuse. */
export type CanalPergunta = 'chat' | 'mcp';

/**
 * Liga o CallbackHandler da Langfuse ao grafo: cada nó vira um span, e cada chamada ao LLM uma
 * generation com o modelo e os tokens, de onde sai o custo por nó. Um handler só, partilhado por
 * todas as perguntas do processo: ele separa as execuções pelo runId de cada uma.
 */
export function comTracing(grafo: ResearchGraph): ResearchGraph {
  // withConfig devolve um grafo novo, do mesmo tipo, com esta configuração em cada execução.
  return grafo.withConfig({ callbacks: [new CallbackHandler()], runName: NOME_GRAFO });
}

/**
 * Abre o trace de uma pergunta e corre `executar` dentro dele: o grafo que corre lá dentro fica
 * aninhado sob esta raiz. A raiz guarda o que interessa ver de relance na lista de traces: a
 * pergunta como input e a resposta final como output, e não o estado inteiro do grafo.
 *
 * `executar` devolve a resposta final, ou null quando não há (o cliente do /chat desligou a meio).
 * Uma exceção fica registada na raiz como erro e é relançada: quem chama continua a tratá-la.
 */
export async function rastrearPergunta<Resposta extends string | null>(
  pergunta: string,
  canal: CanalPergunta,
  executar: () => Promise<Resposta>,
): Promise<Resposta> {
  // Tags são imutáveis e definidas na criação do trace: servem para o que se sabe à partida.
  const tags: string[] = modoDemoAtivo() ? [canal, 'demo'] : [canal];

  return startActiveObservation(
    NOME_TRACE,
    async (raiz) => {
      raiz.update({ input: pergunta });

      return propagateAttributes({ traceName: NOME_TRACE, tags }, async () => {
        try {
          const resposta = await executar();
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
