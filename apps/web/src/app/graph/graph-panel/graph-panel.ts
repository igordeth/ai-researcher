import { Component, computed, inject } from '@angular/core';

import {
  GraphStore,
  type GraphNode,
  type GraphStep,
  type StepStatus,
} from '../../state/graph-store';
import { formatDuration } from './format-duration';

/** Nome curto e descrição de cada nó, como no protótipo (docs/design/prototype). */
const ETAPAS: Record<GraphNode, { readonly label: string; readonly description: string }> = {
  retrieve: {
    label: 'Retrieve',
    description: 'Busca vetorial na base de demonstrações financeiras (CVM)',
  },
  grade: { label: 'Grade', description: 'Avalia a relevância do contexto recuperado' },
  webSearch: {
    label: 'Search',
    description: 'Busca web complementar, usada quando o contexto local é insuficiente',
  },
  answer: { label: 'Answer', description: 'Gera a resposta e associa cada trecho à sua fonte' },
};

const TAGS: Record<StepStatus, string> = {
  running: 'Em execução',
  done: 'Concluído',
  interrupted: 'Interrompido',
};

// O webSearch só corre quando o contexto local não chegou: a tag diz que é o fallback.
const TAGS_WEB: Record<StepStatus, string> = {
  running: 'Fallback ativo',
  done: 'Fallback usado',
  interrupted: 'Interrompido',
};

/** Uma etapa como a timeline a mostra. */
interface EtapaNaTela {
  readonly node: GraphNode;
  readonly status: StepStatus;
  readonly label: string;
  readonly description: string;
  readonly tag: string;
  // Só nas etapas concluídas com início conhecido.
  readonly duration: string | null;
  // Uma volta pela web recomeça no retrieve: é aí que abre a 2ª rodada.
  readonly round: number;
  readonly opensRound: boolean;
}

/**
 * O painel do pipeline: as etapas do grafo da pergunta em curso, numa timeline vertical. Mostra
 * o laço como ele correu (ver a skill angular-component): uma segunda rodada entra abaixo da
 * primeira, sem a sobrescrever.
 */
@Component({
  selector: 'app-graph-panel',
  imports: [],
  templateUrl: './graph-panel.html',
  styleUrl: './graph-panel.scss',
  // O painel é conteúdo complementar à conversa, com o título como nome acessível.
  host: { role: 'complementary', 'aria-labelledby': 'pipeline-titulo' },
})
export class GraphPanel {
  private readonly graphStore = inject(GraphStore);

  protected readonly etapas = computed(() => paraTela(this.graphStore.steps()));

  protected readonly usouWeb = computed(() =>
    this.graphStore.steps().some((step) => step.node === 'webSearch'),
  );
}

function paraTela(steps: GraphStep[]): EtapaNaTela[] {
  let round = 0;
  return steps.map((step) => {
    const opensRound = step.node === 'retrieve';
    if (opensRound) round += 1;

    const etapa = ETAPAS[step.node];
    return {
      node: step.node,
      status: step.status,
      label: etapa.label,
      description: etapa.description,
      tag: step.node === 'webSearch' ? TAGS_WEB[step.status] : TAGS[step.status],
      duration: duracaoDe(step),
      round,
      // A 1ª rodada não leva separador: só as voltas seguintes.
      opensRound: opensRound && round > 1,
    };
  });
}

function duracaoDe(step: GraphStep): string | null {
  if (step.status !== 'done' || step.startedAt === null || step.finishedAt === null) return null;
  return formatDuration(step.finishedAt - step.startedAt);
}
