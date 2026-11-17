import { TestBed } from '@angular/core/testing';

import type { GraphEvent } from '../api/chat.service';
import { GraphStore, MAX_ITERATIONS, nextNode, type GraphStep } from './graph-store';

const RETRIEVE: GraphEvent = { type: 'retrieve', documents: [] };
const WEB_SEARCH: GraphEvent = { type: 'webSearch' };
const ANSWER: GraphEvent = { type: 'answer', answer: 'Resposta.' };

function grade(sufficient: boolean, iterations: number): GraphEvent {
  return { type: 'grade', sufficient, missingAspects: [], iterations };
}

describe('nextNode', () => {
  it('depois do retrieve vem sempre o grade', () => {
    expect(nextNode(RETRIEVE)).toBe('grade');
  });

  it('depois do webSearch vem sempre o retrieve', () => {
    expect(nextNode(WEB_SEARCH)).toBe('retrieve');
  });

  it('depois do grade suficiente vem o answer', () => {
    expect(nextNode(grade(true, 1))).toBe('answer');
  });

  it('depois do grade insuficiente, abaixo do limite, volta ao webSearch', () => {
    expect(nextNode(grade(false, MAX_ITERATIONS - 1))).toBe('webSearch');
  });

  it('depois do grade insuficiente no limite de iterações, vai direto ao answer', () => {
    expect(nextNode(grade(false, MAX_ITERATIONS))).toBe('answer');
  });

  it('depois do answer, o grafo acaba', () => {
    expect(nextNode(ANSWER)).toBeNull();
  });
});

/** Só o nó e o estado de cada etapa: os testes de ordem não dependem do relógio. */
function resumo(steps: GraphStep[]) {
  return steps.map(({ node, status }) => ({ node, status }));
}

describe('GraphStore', () => {
  let store: GraphStore;

  beforeEach(() => {
    store = TestBed.inject(GraphStore);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('cada etapa começa quando chega o evento anterior e acaba quando chega o seu', () => {
    vi.useFakeTimers({ now: 1_000 });
    store.start();
    vi.advanceTimersByTime(800);
    store.apply(RETRIEVE);
    vi.advanceTimersByTime(1_500);
    store.apply(grade(true, 1));

    expect(store.steps()).toEqual([
      { node: 'retrieve', status: 'done', startedAt: 1_000, finishedAt: 1_800 },
      { node: 'grade', status: 'done', startedAt: 1_800, finishedAt: 3_300 },
      { node: 'answer', status: 'running', startedAt: 3_300, finishedAt: null },
    ]);
  });

  it('a etapa interrompida também regista quando parou', () => {
    vi.useFakeTimers({ now: 1_000 });
    store.start();
    vi.advanceTimersByTime(400);

    store.interrupt();

    expect(store.steps()).toEqual([
      { node: 'retrieve', status: 'interrupted', startedAt: 1_000, finishedAt: 1_400 },
    ]);
  });

  it('sem start, a etapa que entra já concluída não tem início conhecido', () => {
    vi.useFakeTimers({ now: 1_000 });

    store.apply(RETRIEVE);

    expect(store.steps()[0]).toEqual({
      node: 'retrieve',
      status: 'done',
      startedAt: null,
      finishedAt: 1_000,
    });
  });

  it('começa vazio, e o start põe o retrieve em execução', () => {
    expect(resumo(store.steps())).toEqual([]);

    store.start();

    expect(resumo(store.steps())).toEqual([{ node: 'retrieve', status: 'running' }]);
  });

  it('a cada evento, conclui a etapa em execução e prevê a próxima', () => {
    store.start();

    store.apply(RETRIEVE);

    expect(resumo(store.steps())).toEqual([
      { node: 'retrieve', status: 'done' },
      { node: 'grade', status: 'running' },
    ]);
  });

  it('num grade suficiente à primeira, segue direto para o answer e termina nele', () => {
    store.start();
    for (const event of [RETRIEVE, grade(true, 1), ANSWER]) store.apply(event);

    expect(resumo(store.steps())).toEqual([
      { node: 'retrieve', status: 'done' },
      { node: 'grade', status: 'done' },
      { node: 'answer', status: 'done' },
    ]);
  });

  it('o laço pela web acrescenta as etapas repetidas, sem sobrescrever as da primeira rodada', () => {
    store.start();
    for (const event of [RETRIEVE, grade(false, 1), WEB_SEARCH, RETRIEVE, grade(true, 2)]) {
      store.apply(event);
    }

    expect(resumo(store.steps())).toEqual([
      { node: 'retrieve', status: 'done' },
      { node: 'grade', status: 'done' },
      { node: 'webSearch', status: 'done' },
      { node: 'retrieve', status: 'done' },
      { node: 'grade', status: 'done' },
      { node: 'answer', status: 'running' },
    ]);
  });

  it('no limite de iterações, ainda insuficiente, prevê o answer e não outra ida à web', () => {
    store.start();
    for (const event of [RETRIEVE, grade(false, 1), WEB_SEARCH, RETRIEVE, grade(false, 2)]) {
      store.apply(event);
    }

    expect(resumo(store.steps()).at(-1)).toEqual({ node: 'answer', status: 'running' });
  });

  it('o start de uma pergunta nova apaga as etapas da anterior', () => {
    store.start();
    store.apply(RETRIEVE);

    store.start();

    expect(resumo(store.steps())).toEqual([{ node: 'retrieve', status: 'running' }]);
  });

  it('sem start, o nó do evento entra já concluído, seguido do previsto', () => {
    store.apply(RETRIEVE);

    expect(resumo(store.steps())).toEqual([
      { node: 'retrieve', status: 'done' },
      { node: 'grade', status: 'running' },
    ]);
  });

  it('ao interromper, a etapa em execução fica interrompida e as concluídas não mudam', () => {
    store.start();
    store.apply(RETRIEVE);

    store.interrupt();

    expect(resumo(store.steps())).toEqual([
      { node: 'retrieve', status: 'done' },
      { node: 'grade', status: 'interrupted' },
    ]);
  });
});
