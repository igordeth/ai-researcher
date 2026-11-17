import { Injectable, signal } from '@angular/core';

import type { GraphEvent } from '../api/chat.service';

/**
 * Espelho do MAX_ITERATIONS de packages/agent/src/graph.ts: quantas vezes o grade pode correr numa
 * pergunta. Copiado, e não importado: o @hero/agent traz LangGraph, Vertex AI e Postgres, que não
 * pertencem ao bundle do navegador. Se o valor mudar lá, tem de mudar aqui.
 */
export const MAX_ITERATIONS = 2;

/** Um nó do grafo, com o mesmo nome que tem no evento SSE. */
export type GraphNode = GraphEvent['type'];

/**
 * - running: o nó que o grafo está a correr agora (previsto a partir do evento anterior);
 * - done: o nó já emitiu o seu evento;
 * - interrupted: a conversa falhou com este nó a correr.
 */
export type StepStatus = 'running' | 'done' | 'interrupted';

export interface GraphStep {
  readonly node: GraphNode;
  readonly status: StepStatus;
  // Em milissegundos (Date.now()). O início é quando o evento anterior chegou, que é quando o nó
  // começa a correr; null quando não se sabe (uma etapa que entrou sem ter sido prevista).
  readonly startedAt: number | null;
  // Quando chegou o evento do próprio nó, ou quando a conversa falhou. Null enquanto corre.
  readonly finishedAt: number | null;
}

/**
 * O nó que corre depois do evento recebido, pelas mesmas arestas do buildGraph:
 *
 *   retrieve → grade ─┬─ suficiente, ou limite atingido → answer
 *                     └─ insuficiente → webSearch → retrieve
 *
 * O stream só avisa quando um nó termina, e não quando o seguinte começa: prever o próximo é o que
 * deixa o painel mostrar o nó em execução enquanto ele corre. Depois do answer, o grafo acaba.
 */
export function nextNode(event: GraphEvent): GraphNode | null {
  switch (event.type) {
    case 'retrieve':
      return 'grade';
    case 'webSearch':
      return 'retrieve';
    case 'grade':
      // Como o decidirDepoisDoGrade do grafo. O iterations do evento já é o total da pergunta (a
      // API soma os incrementos do grade), por isso compara-se direto com o limite.
      if (event.sufficient) return 'answer';
      if (event.iterations >= MAX_ITERATIONS) return 'answer';
      return 'webSearch';
    case 'answer':
      return null;
  }
}

/**
 * As etapas do grafo numa pergunta, pela ordem em que correram. Quando o grafo dá a volta pela web,
 * as etapas repetidas entram de novo no fim da lista: nada é sobrescrito, e o laço fica visível.
 */
@Injectable({ providedIn: 'root' })
export class GraphStore {
  private readonly _steps = signal<GraphStep[]>([]);
  readonly steps = this._steps.asReadonly();

  /** Começa uma pergunta nova: o grafo arranca sempre pelo retrieve. */
  start(): void {
    this._steps.set([running('retrieve', Date.now())]);
  }

  /** Marca a última etapa como concluída e acrescenta a próxima, prevista pelo evento. */
  apply(event: GraphEvent): void {
    const agora = Date.now();
    this._steps.update((steps) => {
      const last = steps.at(-1);
      // O caso normal: o evento é do nó que estava previsto como em execução. Se não for (o
      // start não foi chamado, por exemplo), o nó do evento entra já concluído, sem início
      // conhecido, para a lista continuar a contar o que de facto correu.
      const concluidas: GraphStep[] =
        last?.status === 'running' && last.node === event.type
          ? [...steps.slice(0, -1), { ...last, status: 'done', finishedAt: agora }]
          : [...steps, { node: event.type, status: 'done', startedAt: null, finishedAt: agora }];

      const next = nextNode(event);
      return next === null ? concluidas : [...concluidas, running(next, agora)];
    });
  }

  /** A conversa falhou: a etapa em execução para aí, e nenhuma outra é prevista. */
  interrupt(): void {
    const agora = Date.now();
    this._steps.update((steps) =>
      steps.map((step) =>
        step.status === 'running' ? { ...step, status: 'interrupted', finishedAt: agora } : step,
      ),
    );
  }
}

function running(node: GraphNode, startedAt: number): GraphStep {
  return { node, status: 'running', startedAt, finishedAt: null };
}
