import { afterEach, describe, expect, it, vi } from 'vitest';

import { makeGoogleCustomSearchProvider } from './google-custom-search.js';
import { SearchProviderError } from './types.js';

/** fetch fake que responde sempre o mesmo corpo, com o Response real do Node. */
function fetchRespondendo(corpo: unknown, status = 200) {
  return vi.fn().mockResolvedValue(new Response(JSON.stringify(corpo), { status }));
}

describe('makeGoogleCustomSearchProvider', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('faz GET com key, cx e q como query params', async () => {
    const fetchFake = fetchRespondendo({});
    vi.stubGlobal('fetch', fetchFake);

    await makeGoogleCustomSearchProvider('chave-de-teste', 'meu-cx').search('receita da Vale');

    const [url, init] = fetchFake.mock.calls[0] as [URL, RequestInit];
    expect(url.origin + url.pathname).toBe('https://www.googleapis.com/customsearch/v1');
    expect(url.searchParams.get('key')).toBe('chave-de-teste');
    expect(url.searchParams.get('cx')).toBe('meu-cx');
    expect(url.searchParams.get('q')).toBe('receita da Vale');
    expect(init.method ?? 'GET').toBe('GET');
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('mapeia items[] para SearchResult, trocando link por url', async () => {
    vi.stubGlobal(
      'fetch',
      fetchRespondendo({
        items: [{ title: 'Vale divulga resultado', snippet: 'A Vale...', link: 'https://a.com' }],
      }),
    );

    const resultados = await makeGoogleCustomSearchProvider('k', 'cx').search('x');

    expect(resultados).toEqual([
      { title: 'Vale divulga resultado', snippet: 'A Vale...', url: 'https://a.com' },
    ]);
  });

  it('devolve lista vazia quando a API omite items (nenhum resultado)', async () => {
    vi.stubGlobal('fetch', fetchRespondendo({ searchInformation: { totalResults: '0' } }));

    expect(await makeGoogleCustomSearchProvider('k', 'cx').search('x')).toEqual([]);
  });

  it('transforma resposta não-2xx em SearchProviderError sem expor a chave, que vai na URL', async () => {
    vi.stubGlobal('fetch', fetchRespondendo({ error: { code: 403 } }, 403));

    const erro = await makeGoogleCustomSearchProvider('chave-secreta', 'cx')
      .search('x')
      .catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(SearchProviderError);
    expect((erro as SearchProviderError).status).toBe(403);
    expect((erro as Error).message).not.toContain('chave-secreta');
  });

  it('transforma timeout ou falha de rede em SearchProviderError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('timeout', 'TimeoutError')));

    await expect(makeGoogleCustomSearchProvider('k', 'cx').search('x')).rejects.toBeInstanceOf(
      SearchProviderError,
    );
  });
});
