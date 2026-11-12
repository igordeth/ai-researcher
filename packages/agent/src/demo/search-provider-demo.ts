import type { SearchProvider, SearchResult } from '../search/types.js';
import { FIXTURE_GENERICA, FIXTURES_BUSCA, type FixtureBusca } from './fixtures.js';

// Minúsculas e sem acento, para "PETROBRAS", "Petrobrás" e "petrobras" casarem igual.
function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

// O termo tem de aparecer como palavra inteira, sem letra ou dígito colado: "vale" casa em
// "receita da Vale caiu", mas não em "valeu" nem em "equivale". A expressão "vale a pena" casa,
// porque ali "vale" é a mesma palavra; para as perguntas da demo, isso não acontece.
function contemTermo(query: string, termo: string): boolean {
  return new RegExp(`(?<![\\p{L}\\p{N}])${termo}(?![\\p{L}\\p{N}])`, 'u').test(query);
}

/** A fixture da primeira empresa que a query menciona, ou a genérica. Nunca lança erro. */
export function encontrarFixture(query: string): FixtureBusca {
  const normalizada = normalizar(query);
  return (
    FIXTURES_BUSCA.find((fixture) =>
      fixture.termos.some((termo) => contemTermo(normalizada, termo)),
    ) ?? FIXTURE_GENERICA
  );
}

/** SearchProvider do modo DEMO: responde das fixtures, sem rede e sem chave. */
export function makeDemoSearchProvider(): SearchProvider {
  return {
    async search(query: string): Promise<SearchResult[]> {
      return encontrarFixture(query).resultados;
    },
  };
}
