import { modoDemoAtivo } from '../demo/modo-demo.js';
import { makeDemoSearchProvider } from '../demo/search-provider-demo.js';
import { makeGoogleCustomSearchProvider } from './google-custom-search.js';
import { makeSerperProvider } from './serper.js';
import type { SearchProvider } from './types.js';

export { SearchProviderError } from './types.js';
export type { SearchProvider, SearchResult } from './types.js';

/**
 * Cria o provider de busca indicado por SEARCH_PROVIDER (padrão: serper), com as chaves vindas de
 * variáveis de ambiente. Falha na hora, com mensagem clara, se a configuração estiver incompleta:
 * melhor o serviço não arrancar do que descobrir a chave em falta na primeira pergunta.
 *
 * Com DEMO=true, devolve o provider de fixtures e nenhuma chave é exigida. Os providers reais não
 * sabem que o modo demo existe: a troca acontece só aqui.
 */
export function criarSearchProvider(): SearchProvider {
  if (modoDemoAtivo()) return makeDemoSearchProvider();

  const provider = process.env.SEARCH_PROVIDER ?? 'serper';

  if (provider === 'serper') {
    const apiKey = process.env.SERPER_API_KEY;
    if (!apiKey) {
      throw new Error('SEARCH_PROVIDER=serper exige SERPER_API_KEY. Ver .env.example.');
    }
    return makeSerperProvider(apiKey);
  }

  if (provider === 'google') {
    const apiKey = process.env.GOOGLE_CUSTOM_SEARCH_API_KEY;
    const cx = process.env.GOOGLE_CUSTOM_SEARCH_CX;
    if (!apiKey || !cx) {
      const emFalta: string[] = [];
      if (!apiKey) emFalta.push('GOOGLE_CUSTOM_SEARCH_API_KEY');
      if (!cx) emFalta.push('GOOGLE_CUSTOM_SEARCH_CX');
      throw new Error(`SEARCH_PROVIDER=google exige ${emFalta.join(' e ')}. Ver .env.example.`);
    }
    return makeGoogleCustomSearchProvider(apiKey, cx);
  }

  throw new Error(`SEARCH_PROVIDER desconhecido: "${provider}". Use "serper" ou "google".`);
}
