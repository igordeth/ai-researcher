import { describe, expect, it, vi } from 'vitest';

import type { LinhaDocumentoWeb } from '../db/replace-web-page.js';
import type { SearchResult } from '../search/types.js';
import { makeWebSearchNode, montarQueries, type WebSearchDeps } from './web-search.js';

const AGORA = new Date('2026-11-12T10:00:00.000Z');

function resultado(n: number): SearchResult {
  return { title: `Título ${n}`, snippet: '', url: `https://exemplo.com/${n}` };
}

/** Dependências fake: tudo em memória, sem rede nem base. Cada teste sobrepõe o que precisa. */
function depsFake(sobrepor: Partial<WebSearchDeps> = {}) {
  const gravadas = new Map<string, LinhaDocumentoWeb[]>();
  const deps: WebSearchDeps = {
    searchProvider: { search: vi.fn().mockResolvedValue([resultado(1)]) },
    embeddings: {
      embedDocuments: vi.fn(async (textos: string[]) => textos.map(() => [0.1, 0.2])),
    },
    buscarPagina: vi.fn(async (url: string) => ({
      html: `<p>Conteúdo de ${url}</p>`,
      urlFinal: url,
    })),
    gravarPagina: vi.fn(async (url: string, linhas: LinhaDocumentoWeb[]) => {
      gravadas.set(url, linhas);
    }),
    agora: () => AGORA,
    ...sobrepor,
  };
  return { deps, gravadas };
}

describe('montarQueries', () => {
  it('monta uma query por aspecto em falta, juntando a pergunta', () => {
    expect(
      montarQueries({ question: 'Por que caiu?', missingAspects: ['motivo', 'contexto do setor'] }),
    ).toEqual(['Por que caiu? motivo', 'Por que caiu? contexto do setor']);
  });

  it('usa só a pergunta quando não há aspectos em falta', () => {
    expect(montarQueries({ question: 'Por que caiu?', missingAspects: [] })).toEqual([
      'Por que caiu?',
    ]);
  });
});

describe('makeWebSearchNode', () => {
  it('pesquisa cada query e processa só os 3 primeiros resultados', async () => {
    const search = vi.fn().mockResolvedValue([1, 2, 3, 4, 5].map(resultado));
    const { deps, gravadas } = depsFake({ searchProvider: { search } });

    await makeWebSearchNode(deps)({ question: 'q', missingAspects: ['a', 'b'] });

    expect(search).toHaveBeenCalledWith('q a');
    expect(search).toHaveBeenCalledWith('q b');
    expect([...gravadas.keys()]).toEqual([1, 2, 3].map((n) => `https://exemplo.com/${n}`));
  });

  it('grava cada chunk com query, título, posição, data e validade de 7 dias', async () => {
    const { deps, gravadas } = depsFake();

    const retorno = await makeWebSearchNode(deps)({ question: 'q', missingAspects: [] });

    expect(retorno).toEqual({});
    const [linha] = gravadas.get('https://exemplo.com/1') ?? [];
    expect(linha).toEqual({
      query: 'q',
      title: 'Título 1',
      content: 'Conteúdo de https://exemplo.com/1',
      sourceUrl: 'https://exemplo.com/1',
      chunkIndex: 0,
      fetchedAt: AGORA,
      expiresAt: new Date('2026-11-19T10:00:00.000Z'),
      embedding: [0.1, 0.2],
    });
  });

  it('respeita um TTL configurado', async () => {
    const { deps, gravadas } = depsFake({ ttlDias: 1 });

    await makeWebSearchNode(deps)({ question: 'q', missingAspects: [] });

    expect(gravadas.get('https://exemplo.com/1')?.[0].expiresAt).toEqual(
      new Date('2026-11-13T10:00:00.000Z'),
    );
  });

  it('gera os embeddings de todos os chunks de uma página num só lote', async () => {
    const paginaLonga = `<p>${'palavra '.repeat(400)}</p>`;
    const { deps, gravadas } = depsFake({
      buscarPagina: async (url) => ({ html: paginaLonga, urlFinal: url }),
    });

    await makeWebSearchNode(deps)({ question: 'q', missingAspects: [] });

    const linhas = gravadas.get('https://exemplo.com/1') ?? [];
    expect(linhas.length).toBeGreaterThan(1);
    expect(linhas.map((l) => l.chunkIndex)).toEqual(linhas.map((_, i) => i));
    expect(deps.embeddings.embedDocuments).toHaveBeenCalledTimes(1);
  });

  it('ignora a página que falha e grava as outras, sem lançar erro', async () => {
    const search = vi.fn().mockResolvedValue([1, 2, 3].map(resultado));
    const buscarPagina = vi.fn(async (url: string) => {
      if (url.endsWith('/2')) throw new Error('timeout');
      return { html: '<p>ok</p>', urlFinal: url };
    });
    const { deps, gravadas } = depsFake({ searchProvider: { search }, buscarPagina });

    await expect(makeWebSearchNode(deps)({ question: 'q', missingAspects: [] })).resolves.toEqual(
      {},
    );
    expect([...gravadas.keys()]).toEqual(['https://exemplo.com/1', 'https://exemplo.com/3']);
  });

  it('não grava nada de uma página sem texto legível', async () => {
    const { deps } = depsFake({
      buscarPagina: async (url) => ({ html: '<script>só código</script>', urlFinal: url }),
    });

    await makeWebSearchNode(deps)({ question: 'q', missingAspects: [] });

    expect(deps.gravarPagina).not.toHaveBeenCalled();
    expect(deps.embeddings.embedDocuments).not.toHaveBeenCalled();
  });

  it('processa uma vez a página que aparece em mais de uma query', async () => {
    const search = vi.fn().mockResolvedValue([resultado(1)]);
    const { deps } = depsFake({ searchProvider: { search } });

    await makeWebSearchNode(deps)({ question: 'q', missingAspects: ['a', 'b'] });

    expect(search).toHaveBeenCalledTimes(2);
    expect(deps.buscarPagina).toHaveBeenCalledTimes(1);
  });

  it('grava pelo URL final: links de redirecionamento para a mesma página contam como uma', async () => {
    // Caso real do Serper: um link google.com/goto?url=... e o link direto para a mesma notícia.
    const search = vi.fn().mockResolvedValue([
      { title: 'Notícia', snippet: '', url: 'https://www.google.com/goto?url=abc' },
      { title: 'Notícia', snippet: '', url: 'https://noticias.com/vale' },
    ]);
    const buscarPagina = vi.fn(async () => ({
      html: '<p>Texto da notícia</p>',
      urlFinal: 'https://noticias.com/vale',
    }));
    const { deps, gravadas } = depsFake({ searchProvider: { search }, buscarPagina });

    await makeWebSearchNode(deps)({ question: 'q', missingAspects: [] });

    expect([...gravadas.keys()]).toEqual(['https://noticias.com/vale']);
    expect(deps.gravarPagina).toHaveBeenCalledTimes(1);
    expect(gravadas.get('https://noticias.com/vale')?.[0].sourceUrl).toBe(
      'https://noticias.com/vale',
    );
  });

  it('propaga a falha do provider de busca, porque sem resultados não há o que gravar', async () => {
    const search = vi.fn().mockRejectedValue(new Error('Serper fora do ar'));
    const { deps } = depsFake({ searchProvider: { search } });

    await expect(makeWebSearchNode(deps)({ question: 'q', missingAspects: [] })).rejects.toThrow(
      'Serper fora do ar',
    );
  });
});
