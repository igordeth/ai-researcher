import { afterEach, describe, expect, it, vi } from 'vitest';

import { makeSerperProvider } from './serper.js';
import { SearchProviderError } from './types.js';

/** fetch fake que responde sempre o mesmo corpo, com o Response real do Node. */
function fetchRespondendo(corpo: unknown, status = 200) {
  return vi.fn().mockResolvedValue(new Response(JSON.stringify(corpo), { status }));
}

describe('makeSerperProvider', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('faz POST com a chave no header X-API-KEY e a query no corpo', async () => {
    const fetchFake = fetchRespondendo({ organic: [] });
    vi.stubGlobal('fetch', fetchFake);

    await makeSerperProvider('chave-de-teste').search('receita da Vale');

    const [url, init] = fetchFake.mock.calls[0];
    expect(url).toBe('https://google.serper.dev/search');
    expect(init.method).toBe('POST');
    expect(init.headers['X-API-KEY']).toBe('chave-de-teste');
    expect(JSON.parse(init.body)).toEqual({ q: 'receita da Vale' });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('mapeia organic[] para SearchResult, trocando link por url', async () => {
    vi.stubGlobal(
      'fetch',
      fetchRespondendo({
        organic: [{ title: 'Vale divulga resultado', snippet: 'A Vale...', link: 'https://a.com' }],
      }),
    );

    const resultados = await makeSerperProvider('k').search('x');

    expect(resultados).toEqual([
      { title: 'Vale divulga resultado', snippet: 'A Vale...', url: 'https://a.com' },
    ]);
  });

  it('aceita resultado sem snippet e resposta sem organic', async () => {
    vi.stubGlobal('fetch', fetchRespondendo({ organic: [{ title: 't', link: 'https://a.com' }] }));
    expect(await makeSerperProvider('k').search('x')).toEqual([
      { title: 't', snippet: '', url: 'https://a.com' },
    ]);

    vi.stubGlobal('fetch', fetchRespondendo({}));
    expect(await makeSerperProvider('k').search('x')).toEqual([]);
  });

  it('transforma resposta não-2xx em SearchProviderError com o status, sem expor a chave', async () => {
    vi.stubGlobal('fetch', fetchRespondendo({ message: 'Unauthorized' }, 403));

    const erro = await makeSerperProvider('chave-secreta')
      .search('x')
      .catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(SearchProviderError);
    expect((erro as SearchProviderError).status).toBe(403);
    expect((erro as Error).message).not.toContain('chave-secreta');
  });

  it('transforma timeout ou falha de rede em SearchProviderError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));

    await expect(makeSerperProvider('k').search('x')).rejects.toBeInstanceOf(SearchProviderError);
  });

  it('recusa resposta fora do formato, em vez de devolver resultados com campos vazios', async () => {
    vi.stubGlobal('fetch', fetchRespondendo({ organic: [{ titulo: 'sem link' }] }));

    await expect(makeSerperProvider('k').search('x')).rejects.toThrow(
      'resposta fora do formato esperado',
    );
  });
});
