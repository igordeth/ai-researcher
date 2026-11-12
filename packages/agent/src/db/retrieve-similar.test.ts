import { describe, expect, it } from 'vitest';

import { combinarResultados, type DocumentoCvm, type DocumentoWeb } from './retrieve-similar.js';

function cvm(id: string, distance: number): DocumentoCvm {
  return {
    origem: 'cvm',
    id,
    ticker: 'VALE',
    companyName: 'Vale S.A.',
    setor: 'Extração Mineral',
    period: '1T26',
    periodEnd: '2026-03-31',
    paragraph: `parágrafo ${id}`,
    sourceUrl: 'https://dados.cvm.gov.br/',
    fetchedAt: new Date('2026-11-10T00:00:00.000Z'),
    distance,
  };
}

function web(id: string, distance: number): DocumentoWeb {
  return {
    origem: 'web',
    id,
    title: `página ${id}`,
    paragraph: `chunk ${id}`,
    sourceUrl: `https://exemplo.com/${id}`,
    fetchedAt: new Date('2026-11-12T00:00:00.000Z'),
    distance,
  };
}

describe('combinarResultados', () => {
  it('intercala as duas origens, ordenando só pela distância', () => {
    const resultado = combinarResultados([cvm('c1', 0.1), cvm('c2', 0.3)], [web('w1', 0.2)], 5);

    expect(resultado.map((d) => d.id)).toEqual(['c1', 'w1', 'c2']);
  });

  it('corta no top-k combinado', () => {
    const resultado = combinarResultados(
      [cvm('c1', 0.4), cvm('c2', 0.5)],
      [web('w1', 0.1), web('w2', 0.2)],
      3,
    );

    expect(resultado.map((d) => d.id)).toEqual(['w1', 'w2', 'c1']);
  });

  it('funciona com uma das origens vazia, o caso normal antes de qualquer busca na web', () => {
    expect(combinarResultados([cvm('c1', 0.1)], [], 5).map((d) => d.id)).toEqual(['c1']);
    expect(combinarResultados([], [web('w1', 0.1)], 5).map((d) => d.id)).toEqual(['w1']);
  });
});
