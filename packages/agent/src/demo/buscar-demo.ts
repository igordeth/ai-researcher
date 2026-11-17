import type { Buscar } from '../nodes/retrieve.js';
import { DOCUMENTO_VALE_3T25 } from './documento-vale-3t25.js';

/**
 * A busca por similaridade do modo DEMO: devolve sempre o documento da Vale 3T25, seja qual for o
 * vetor da pergunta. Sem Postgres, por isso o embedding da pergunta pode ser só zeros.
 */
export function criarBuscarDemo(): Buscar {
  return async () => [DOCUMENTO_VALE_3T25];
}
