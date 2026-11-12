import { afterEach, describe, expect, it, vi } from 'vitest';

import { buscarPaginaDemo } from '../demo/buscar-pagina-demo.js';
import { buscarPagina } from './fetch-page.js';
import { criarBuscarPagina } from './index.js';

describe('criarBuscarPagina', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('usa o buscarPagina real fora do modo demo', () => {
    vi.stubEnv('DEMO', undefined);

    expect(criarBuscarPagina()).toBe(buscarPagina);
  });

  it('usa as fixtures com DEMO=true', () => {
    vi.stubEnv('DEMO', 'true');

    expect(criarBuscarPagina()).toBe(buscarPaginaDemo);
  });
});
