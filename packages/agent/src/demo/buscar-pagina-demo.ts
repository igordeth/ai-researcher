import type { PaginaBuscada } from '../web/fetch-page.js';
import { PAGINA_GENERICA, PAGINAS } from './fixtures.js';

/**
 * buscarPagina do modo DEMO: devolve o HTML da fixture, sem rede. URL desconhecido recebe a
 * página genérica em vez de erro, para a demo nunca parar a meio. Sem redirecionamentos, o URL
 * final é o próprio URL pedido.
 */
export async function buscarPaginaDemo(url: string): Promise<PaginaBuscada> {
  return { html: PAGINAS[url] ?? PAGINA_GENERICA, urlFinal: url };
}
