import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { criarSearchProvider } from './index.js';

/** Qual endpoint o provider criado chamou: prova qual implementação a fábrica escolheu. */
async function endpointChamado(): Promise<string> {
  const fetchFake = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
  vi.stubGlobal('fetch', fetchFake);
  await criarSearchProvider().search('x');
  return String(fetchFake.mock.calls[0][0]);
}

describe('criarSearchProvider', () => {
  beforeEach(() => {
    // Ponto de partida conhecido, seja qual for o ambiente de quem corre os testes.
    vi.stubEnv('DEMO', undefined);
    vi.stubEnv('SEARCH_PROVIDER', undefined);
    vi.stubEnv('SERPER_API_KEY', undefined);
    vi.stubEnv('GOOGLE_CUSTOM_SEARCH_API_KEY', undefined);
    vi.stubEnv('GOOGLE_CUSTOM_SEARCH_CX', undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('usa o Serper por padrão', async () => {
    vi.stubEnv('SERPER_API_KEY', 'k');

    expect(await endpointChamado()).toBe('https://google.serper.dev/search');
  });

  it('usa o Google Custom Search com SEARCH_PROVIDER=google', async () => {
    vi.stubEnv('SEARCH_PROVIDER', 'google');
    vi.stubEnv('GOOGLE_CUSTOM_SEARCH_API_KEY', 'k');
    vi.stubEnv('GOOGLE_CUSTOM_SEARCH_CX', 'cx');

    expect(await endpointChamado()).toContain('https://www.googleapis.com/customsearch/v1');
  });

  it('exige SERPER_API_KEY para o Serper', () => {
    expect(() => criarSearchProvider()).toThrow('SEARCH_PROVIDER=serper exige SERPER_API_KEY');
  });

  it('trata chave vazia como chave em falta', () => {
    vi.stubEnv('SERPER_API_KEY', '');

    expect(() => criarSearchProvider()).toThrow('exige SERPER_API_KEY');
  });

  it('diz exatamente quais variáveis do Google estão em falta', () => {
    vi.stubEnv('SEARCH_PROVIDER', 'google');
    expect(() => criarSearchProvider()).toThrow(
      'exige GOOGLE_CUSTOM_SEARCH_API_KEY e GOOGLE_CUSTOM_SEARCH_CX',
    );

    vi.stubEnv('GOOGLE_CUSTOM_SEARCH_API_KEY', 'k');
    expect(() => criarSearchProvider()).toThrow(/exige GOOGLE_CUSTOM_SEARCH_CX\./);
  });

  it('envolve o Serper em retry: um 503 seguido de 200 devolve os resultados', async () => {
    vi.stubEnv('SERPER_API_KEY', 'k');
    // Só o setTimeout é falso: a espera de 500 ms do backoff passa sem esperar de verdade.
    vi.useFakeTimers({ toFake: ['setTimeout'] });
    const fetchFake = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(
        Response.json({ organic: [{ title: 't', link: 'https://a.com', snippet: 's' }] }),
      );
    vi.stubGlobal('fetch', fetchFake);

    const busca = criarSearchProvider().search('x');
    await vi.advanceTimersByTimeAsync(500);

    expect(await busca).toEqual([{ title: 't', snippet: 's', url: 'https://a.com' }]);
    expect(fetchFake).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it('com DEMO=true usa as fixtures, sem chave e sem rede', async () => {
    vi.stubEnv('DEMO', 'true');
    const fetchFake = vi.fn();
    vi.stubGlobal('fetch', fetchFake);

    const resultados = await criarSearchProvider().search('Por que a receita da Vale caiu?');

    expect(resultados[0].url).toContain('.demo.example/');
    expect(fetchFake).not.toHaveBeenCalled();
  });

  it('recusa provider desconhecido, dizendo os válidos', () => {
    vi.stubEnv('SEARCH_PROVIDER', 'bing');

    expect(() => criarSearchProvider()).toThrow('SEARCH_PROVIDER desconhecido: "bing"');
  });
});
