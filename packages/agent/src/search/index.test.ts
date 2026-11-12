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

  it('recusa provider desconhecido, dizendo os válidos', () => {
    vi.stubEnv('SEARCH_PROVIDER', 'bing');

    expect(() => criarSearchProvider()).toThrow('SEARCH_PROVIDER desconhecido: "bing"');
  });
});
