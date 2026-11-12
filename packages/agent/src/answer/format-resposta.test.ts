import { describe, expect, it } from 'vitest';

import type { DocumentoCvm, DocumentoWeb } from '../db/retrieve-similar.js';
import {
  AVISO_GUARDRAIL,
  contemLinguagemRecomendatoria,
  formatarResposta,
  montarFontes,
} from './format-resposta.js';

const ZIP_ITR_2025 =
  'https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/ITR/DADOS/itr_cia_aberta_2025.zip';

function cvm(ticker: string, period: string, periodEnd: string): DocumentoCvm {
  return {
    origem: 'cvm',
    id: `${ticker}-${period}`,
    ticker,
    companyName: `${ticker} S.A.`,
    setor: 'Setor',
    period,
    periodEnd,
    paragraph: 'Parágrafo.',
    sourceUrl: ZIP_ITR_2025,
    fetchedAt: new Date('2026-08-08T00:00:00.000Z'),
    distance: 0.1,
  };
}

function web(title: string, sourceUrl: string): DocumentoWeb {
  return {
    origem: 'web',
    id: `${sourceUrl}-${title}`,
    title,
    paragraph: 'Chunk.',
    sourceUrl,
    fetchedAt: new Date('2026-11-12T00:00:00.000Z'),
    distance: 0.2,
  };
}

describe('contemLinguagemRecomendatoria', () => {
  it.each([
    'Recomendo a compra de VALE3.',
    'Eu sugiro vender as ações.',
    'Aconselho manter a posição.',
    'Nós recomendamos cautela.',
    'Sugeriria aguardar o próximo trimestre.',
    'Vale a pena comprar agora.',
    'vale a\npena investir na empresa',
    'Você deveria comprar PETR4.',
    'É uma boa hora para comprar.',
    'RECOMENDO VALE3',
  ])('detecta: %s', (texto) => {
    expect(contemLinguagemRecomendatoria(texto)).toBe(true);
  });

  it.each([
    'Este sistema não faz recomendações de investimento.',
    'O resultado sugere uma queda de margem.',
    'O analista recomendou cautela, segundo a notícia.',
    'A empresa deve investir R$ 5 bilhões em capex.',
    'Vale a pena notar que a receita caiu 3%.',
    'A receita da Vale foi de R$ 56,7 bilhões [VALE3 3T25].',
  ])('não detecta: %s', (texto) => {
    expect(contemLinguagemRecomendatoria(texto)).toBe(false);
  });

  it('não detecta o próprio aviso de guardrail', () => {
    expect(contemLinguagemRecomendatoria(AVISO_GUARDRAIL)).toBe(false);
  });
});

describe('montarFontes', () => {
  it('lista ticker, período e data-base da CVM, e título com URL da web', () => {
    expect(
      montarFontes([cvm('VALE3', '3T25', '2025-09-30'), web('Notícia', 'https://n.com/a')]),
    ).toBe(
      [
        'Fontes:',
        '- [VALE3 3T25] VALE3 S.A., data-base 30/09/2025 (CVM)',
        '- [web: Notícia] https://n.com/a',
      ].join('\n'),
    );
  });

  it('junta os chunks da mesma página web num só item', () => {
    const fontes = montarFontes([
      web('Notícia', 'https://n.com/a'),
      web('Notícia', 'https://n.com/a'),
      web('Outra', 'https://n.com/b'),
    ]);

    expect(fontes.split('\n')).toEqual([
      'Fontes:',
      '- [web: Notícia] https://n.com/a',
      '- [web: Outra] https://n.com/b',
    ]);
  });

  it('mantém empresas diferentes do mesmo ZIP da CVM como fontes separadas', () => {
    // O sourceUrl da CVM é o arquivo do ano, comum a todas as empresas: deduplicar por ele juntaria
    // VALE3 e PETR4 numa fonte só.
    const fontes = montarFontes([
      cvm('VALE3', '3T25', '2025-09-30'),
      cvm('PETR4', '3T25', '2025-09-30'),
      cvm('VALE3', '3T25', '2025-09-30'),
    ]);

    expect(fontes.split('\n')).toEqual([
      'Fontes:',
      '- [VALE3 3T25] VALE3 S.A., data-base 30/09/2025 (CVM)',
      '- [PETR4 3T25] PETR4 S.A., data-base 30/09/2025 (CVM)',
    ]);
  });

  it('diz que não há fontes quando nada foi recuperado', () => {
    expect(montarFontes([])).toBe('Fontes: nenhum documento recuperado.');
  });
});

describe('formatarResposta', () => {
  it('mantém o texto sem recomendação e anexa as fontes', () => {
    expect(
      formatarResposta('  Receita de R$ 1 bi [VALE3 3T25].  ', [
        cvm('VALE3', '3T25', '2025-09-30'),
      ]),
    ).toBe(
      'Receita de R$ 1 bi [VALE3 3T25].\n\nFontes:\n- [VALE3 3T25] VALE3 S.A., data-base 30/09/2025 (CVM)',
    );
  });

  it('troca o texto inteiro pelo aviso quando há recomendação, e anexa as fontes', () => {
    expect(formatarResposta('Os números são bons. Sugiro comprar.', [])).toBe(
      `${AVISO_GUARDRAIL}\n\nFontes: nenhum documento recuperado.`,
    );
  });
});
