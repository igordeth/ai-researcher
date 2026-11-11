import { describe, expect, it } from 'vitest';

import { emLotes } from './lotes.js';

describe('emLotes', () => {
  it('divide em lotes do tamanho informado, com o resto no último', () => {
    expect(emLotes([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('80 documentos em lotes de 10 viram 8 lotes cheios', () => {
    const lotes = emLotes(
      Array.from({ length: 80 }, (_, i) => i),
      10,
    );

    expect(lotes).toHaveLength(8);
    expect(lotes.every((lote) => lote.length === 10)).toBe(true);
  });

  it('devolve lista vazia para entrada vazia', () => {
    expect(emLotes([], 10)).toEqual([]);
  });
});
