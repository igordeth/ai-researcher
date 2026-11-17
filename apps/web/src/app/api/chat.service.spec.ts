import { TestBed } from '@angular/core/testing';
import type { ChatEvent } from '@hero/contracts';

import { ChatError, ChatService, type GraphEvent } from './chat.service';

/** O que a API escreve por evento: uma linha `data: {json}` e uma linha em branco. */
function frame(evento: ChatEvent): string {
  return `data: ${JSON.stringify(evento)}\n\n`;
}

/** O texto em pedaços de bytes de tamanho fixo: um pedaço pode acabar a meio de um evento. */
function emPedacos(texto: string, tamanho = 7): Uint8Array[] {
  const bytes = new TextEncoder().encode(texto);
  const pedacos: Uint8Array[] = [];
  for (let inicio = 0; inicio < bytes.length; inicio += tamanho) {
    pedacos.push(bytes.slice(inicio, inicio + tamanho));
  }
  return pedacos;
}

/** Uma resposta SSE cujo corpo chega nos pedaços dados, um de cada vez, como a rede os entrega. */
function respostaSse(pedacos: Uint8Array[]) {
  const cancelado = vi.fn();
  const restantes = [...pedacos];
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      const pedaco = restantes.shift();
      if (pedaco === undefined) controller.close();
      else controller.enqueue(pedaco);
    },
    cancel: cancelado,
  });
  const response = new Response(body, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream; charset=utf-8' },
  });
  return { response, cancelado };
}

/** A sequência de uma pergunta que precisou de uma ida à web, como o grafo real a emite. */
const LACO_COMPLETO: GraphEvent[] = [
  {
    type: 'retrieve',
    documents: [
      { origem: 'cvm', ticker: 'VALE3', companyName: 'Vale S.A.', period: '3T25', distance: 0.1 },
    ],
  },
  { type: 'grade', sufficient: false, missingAspects: ['motivo da queda'], iterations: 1 },
  { type: 'webSearch' },
  {
    type: 'retrieve',
    documents: [
      {
        origem: 'web',
        title: 'Vale tem queda',
        sourceUrl: 'https://noticias.com/vale',
        distance: 0.2,
      },
    ],
  },
  { type: 'grade', sufficient: true, missingAspects: [], iterations: 2 },
  {
    type: 'answer',
    answer: 'A receita caiu pelo preço do minério de ferro [web: Vale tem queda].',
  },
];

async function recolher(eventos: AsyncIterable<GraphEvent>): Promise<GraphEvent[]> {
  const recebidos: GraphEvent[] = [];
  for await (const evento of eventos) recebidos.push(evento);
  return recebidos;
}

describe('ChatService', () => {
  let service: ChatService;
  let fetchFake: ReturnType<typeof vi.fn<typeof fetch>>;

  beforeEach(() => {
    fetchFake = vi.fn<typeof fetch>();
    // Sem rede nos testes: o fetch global devolve a resposta montada por cada teste.
    vi.stubGlobal('fetch', fetchFake);
    service = TestBed.inject(ChatService);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('faz POST /api/chat com a pergunta em JSON', async () => {
    fetchFake.mockResolvedValue(respostaSse(emPedacos(LACO_COMPLETO.map(frame).join(''))).response);

    await recolher(service.ask('Qual a receita da Vale?'));

    const [url, opcoes] = fetchFake.mock.calls[0];
    expect(url).toBe('/api/chat');
    expect(opcoes?.method).toBe('POST');
    expect(opcoes?.body).toBe(JSON.stringify({ question: 'Qual a receita da Vale?' }));
  });

  it('entrega os eventos na ordem, mesmo com pedaços que partem um evento a meio', async () => {
    fetchFake.mockResolvedValue(respostaSse(emPedacos(LACO_COMPLETO.map(frame).join(''))).response);

    expect(await recolher(service.ask('q'))).toEqual(LACO_COMPLETO);
  });

  it('junta um caractere acentuado que chega partido entre dois pedaços', async () => {
    const bytes = new TextEncoder().encode(frame({ type: 'answer', answer: 'preço' }));
    // Em UTF-8, o ç ocupa dois bytes (0xC3 0xA7): o corte fica entre os dois.
    const meioDoCedilha = bytes.indexOf(0xc3) + 1;
    const pedacos = [bytes.slice(0, meioDoCedilha), bytes.slice(meioDoCedilha)];
    fetchFake.mockResolvedValue(respostaSse(pedacos).response);

    expect(await recolher(service.ask('q'))).toEqual([{ type: 'answer', answer: 'preço' }]);
  });

  it('lança ChatError com a mensagem do evento error, depois de entregar os anteriores', async () => {
    const corpo = frame(LACO_COMPLETO[0]) + frame({ type: 'error', message: 'Falhou o grafo.' });
    fetchFake.mockResolvedValue(respostaSse(emPedacos(corpo)).response);

    const recebidos: GraphEvent[] = [];
    const tentativa = (async () => {
      for await (const evento of service.ask('q')) recebidos.push(evento);
    })();

    await expect(tentativa).rejects.toThrow(new ChatError('Falhou o grafo.'));
    expect(recebidos).toEqual([LACO_COMPLETO[0]]);
  });

  it('lança ChatError com o detail do problem+json quando a API recusa o pedido', async () => {
    const problema = {
      type: '/problemas/pedido-invalido',
      title: 'Pedido inválido',
      status: 400,
      detail: 'question: Too small: expected string to have >=1 characters',
    };
    fetchFake.mockResolvedValue(
      new Response(JSON.stringify(problema), {
        status: 400,
        headers: { 'Content-Type': 'application/problem+json' },
      }),
    );

    await expect(recolher(service.ask(' '))).rejects.toThrow(new ChatError(problema.detail));
  });

  it('lança ChatError com mensagem genérica quando o erro HTTP não vem em problem+json', async () => {
    fetchFake.mockResolvedValue(new Response('Bad Gateway', { status: 502 }));

    await expect(recolher(service.ask('q'))).rejects.toThrow(ChatError);
  });

  it('lança ChatError quando o stream acaba sem o answer (conexão caída a meio)', async () => {
    const corpo = frame(LACO_COMPLETO[0]) + 'data: {"type":"gra';
    fetchFake.mockResolvedValue(respostaSse(emPedacos(corpo)).response);

    await expect(recolher(service.ask('q'))).rejects.toThrow(
      new ChatError('A resposta foi interrompida antes do fim. Tente novamente.'),
    );
  });

  it('lança ChatError quando um evento não respeita o contrato', async () => {
    fetchFake.mockResolvedValue(respostaSse(emPedacos('data: {"type":"plano"}\n\n')).response);

    await expect(recolher(service.ask('q'))).rejects.toThrow(
      new ChatError('A API respondeu num formato inesperado. Tente novamente.'),
    );
  });

  it('fecha a conexão quando quem consome sai a meio', async () => {
    const { response, cancelado } = respostaSse(emPedacos(LACO_COMPLETO.map(frame).join('')));
    fetchFake.mockResolvedValue(response);

    for await (const evento of service.ask('q')) {
      if (evento.type === 'retrieve') break;
    }

    expect(cancelado).toHaveBeenCalled();
  });
});
