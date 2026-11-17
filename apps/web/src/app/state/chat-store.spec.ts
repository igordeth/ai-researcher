import { TestBed } from '@angular/core/testing';

import { ChatError, ChatService, type GraphEvent } from '../api/chat.service';
import { ChatStore, MENSAGEM_ERRO, REVEAL_INTERVAL_MS } from './chat-store';
import { GraphStore } from './graph-store';

const RESPOSTA = 'A receita foi de R$ 56,7 bilhões.';

/** Um ask que emite os eventos dados e, se pedido, lança no fim, como um stream que falha. */
function askQueEmite(eventos: GraphEvent[], erro?: Error) {
  return vi.fn<ChatService['ask']>(async function* () {
    for (const evento of eventos) yield evento;
    if (erro) throw erro;
  });
}

/** Um ask que emite o retrieve e fica à espera, como o grafo a meio: o teste decide quando segue. */
function askAMeio() {
  let continuar!: () => void;
  const podeContinuar = new Promise<void>((resolve) => (continuar = resolve));
  const ask = vi.fn<ChatService['ask']>(async function* () {
    yield { type: 'retrieve', documents: [] };
    await podeContinuar;
    yield { type: 'answer', answer: RESPOSTA };
  });
  return { ask, continuar };
}

function criarStore(ask: ChatService['ask']): ChatStore {
  TestBed.configureTestingModule({ providers: [{ provide: ChatService, useValue: { ask } }] });
  return TestBed.inject(ChatStore);
}

function ultimaMensagem(store: ChatStore) {
  return store.messages().at(-1);
}

describe('ChatStore', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('acrescenta a pergunta e o placeholder do assistente antes da resposta chegar', async () => {
    const { ask } = askAMeio();
    const store = criarStore(ask);

    void store.send('  Qual a receita da Vale?  ');
    await vi.advanceTimersByTimeAsync(0);

    // O retrieve já chegou, mas só o answer mexe na mensagem do assistente.
    expect(store.messages()).toEqual([
      { id: 1, role: 'user', text: 'Qual a receita da Vale?' },
      { id: 2, role: 'assistant', status: 'waiting', text: '' },
    ]);
    expect(store.busy()).toBe(true);
    expect(ask).toHaveBeenCalledWith('Qual a receita da Vale?', expect.any(AbortSignal));
  });

  it('revela o answer uma palavra a cada 70ms', async () => {
    const store = criarStore(askQueEmite([{ type: 'answer', answer: RESPOSTA }]));

    await store.send('q');
    expect(ultimaMensagem(store)).toMatchObject({ status: 'revealing', text: '' });

    await vi.advanceTimersByTimeAsync(REVEAL_INTERVAL_MS - 1);
    expect(ultimaMensagem(store)).toMatchObject({ text: '' });

    await vi.advanceTimersByTimeAsync(1);
    expect(ultimaMensagem(store)).toMatchObject({ status: 'revealing', text: 'A ' });

    await vi.advanceTimersByTimeAsync(REVEAL_INTERVAL_MS);
    expect(ultimaMensagem(store)).toMatchObject({ status: 'revealing', text: 'A receita ' });

    expect(store.busy()).toBe(true);
  });

  it('termina com o texto inteiro, status done e nenhum timer pendente', async () => {
    const store = criarStore(askQueEmite([{ type: 'answer', answer: RESPOSTA }]));

    await store.send('q');
    // RESPOSTA tem 7 palavras.
    await vi.advanceTimersByTimeAsync(7 * REVEAL_INTERVAL_MS);

    expect(ultimaMensagem(store)).toMatchObject({ status: 'done', text: RESPOSTA });
    expect(store.busy()).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('com falha na chamada, mostra a mensagem de erro fixa de uma vez, sem streaming', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const store = criarStore(askQueEmite([], new ChatError('question: Too small')));

    await store.send('q');

    expect(ultimaMensagem(store)).toEqual({
      id: 2,
      role: 'assistant',
      status: 'error',
      text: MENSAGEM_ERRO,
    });
    expect(store.busy()).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('ignora a pergunta vazia e a que chega enquanto outra está a caminho', async () => {
    const { ask, continuar } = askAMeio();
    const store = criarStore(ask);

    await store.send('   ');
    expect(store.messages()).toEqual([]);

    void store.send('primeira');
    await vi.advanceTimersByTimeAsync(0);
    await store.send('segunda');

    expect(ask).toHaveBeenCalledTimes(1);
    expect(store.messages()).toHaveLength(2);
    continuar();
  });

  it('passa cada evento do stream ao GraphStore, a começar do retrieve', async () => {
    const store = criarStore(
      askQueEmite([
        { type: 'retrieve', documents: [] },
        { type: 'grade', sufficient: true, missingAspects: [], iterations: 1 },
        { type: 'answer', answer: RESPOSTA },
      ]),
    );

    await store.send('q');

    expect(
      TestBed.inject(GraphStore)
        .steps()
        .map((step) => [step.node, step.status]),
    ).toEqual([
      ['retrieve', 'done'],
      ['grade', 'done'],
      ['answer', 'done'],
    ]);
  });

  it('com falha na chamada, interrompe a etapa do grafo em execução', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const store = criarStore(
      askQueEmite([{ type: 'retrieve', documents: [] }], new ChatError('falhou')),
    );

    await store.send('q');

    expect(TestBed.inject(GraphStore).steps().at(-1)).toMatchObject({
      node: 'grade',
      status: 'interrupted',
    });
  });

  it('ao destruir, limpa o timer da revelação', async () => {
    const store = criarStore(askQueEmite([{ type: 'answer', answer: RESPOSTA }]));
    await store.send('q');
    await vi.advanceTimersByTimeAsync(REVEAL_INTERVAL_MS);

    TestBed.resetTestingModule();

    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(10 * REVEAL_INTERVAL_MS);
    expect(ultimaMensagem(store)).toMatchObject({ status: 'revealing', text: 'A ' });
  });

  it('ao destruir, fecha a conexão da pergunta em curso', async () => {
    const { ask } = askAMeio();
    const store = criarStore(ask);
    void store.send('q');
    await vi.advanceTimersByTimeAsync(0);

    TestBed.resetTestingModule();

    const signal = ask.mock.calls[0][1];
    expect(signal?.aborted).toBe(true);
  });
});
