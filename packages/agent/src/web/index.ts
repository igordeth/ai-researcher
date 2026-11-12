import { buscarPaginaDemo } from '../demo/buscar-pagina-demo.js';
import { modoDemoAtivo } from '../demo/modo-demo.js';
import { buscarPagina, type PaginaBuscada } from './fetch-page.js';

/**
 * Escolhe como o webSearch busca as páginas: pela rede (buscarPagina) ou, com DEMO=true, das
 * fixtures. A escolha acontece aqui e só aqui: o buscarPagina real não sabe que o modo demo existe.
 */
export function criarBuscarPagina(): (url: string) => Promise<PaginaBuscada> {
  return modoDemoAtivo() ? buscarPaginaDemo : buscarPagina;
}
