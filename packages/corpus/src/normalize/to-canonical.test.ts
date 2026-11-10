import { describe, expect, it } from 'vitest';
import { paraCanonico } from './to-canonical.js';
import type { Empresa, PeriodoColetado } from '../types.js';

const empresa: Empresa = {
  ticker: 'VALE',
  razaoSocial: 'Vale S.A.',
  cdCvm: '004170',
  setor: 'Extração Mineral',
};

function periodoBase(): PeriodoColetado {
  return {
    empresa,
    period: '3T25',
    periodEnd: '2025-09-30',
    sourceUrl: 'https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/ITR/DADOS/itr_cia_aberta_2025.zip',
    indicadores: {
      receitaLiquida: { valor: 56701000, escalaMoeda: 'MIL' },
      lucroBruto: { valor: 20624000, escalaMoeda: 'MIL' },
      lucroLiquido: { valor: 14671000, escalaMoeda: 'MIL' },
      ativoTotal: { valor: 484953000, escalaMoeda: 'MIL' },
      patrimonioLiquido: { valor: 224733000, escalaMoeda: 'MIL' },
      caixaOperacional: { valor: 34020000, escalaMoeda: 'MIL' },
    },
  };
}

describe('paraCanonico', () => {
  it('converte MIL para reais multiplicando por 1000', () => {
    const canonico = paraCanonico(periodoBase(), '2026-08-07T00:00:00.000Z');
    expect(canonico.receita_liquida).toBe(56701000000);
    expect(canonico.ativo_total).toBe(484953000000);
  });

  it('não multiplica quando ESCALA_MOEDA é UNIDADE', () => {
    const periodo = periodoBase();
    periodo.indicadores.lucroLiquido = { valor: 14671000, escalaMoeda: 'UNIDADE' };

    const canonico = paraCanonico(periodo, '2026-08-07T00:00:00.000Z');
    expect(canonico.lucro_liquido).toBe(14671000);
    // os demais campos continuam MIL, independentes desse
    expect(canonico.receita_liquida).toBe(56701000000);
  });

  it('carrega metadados obrigatórios da empresa e do período', () => {
    const canonico = paraCanonico(periodoBase(), '2026-08-07T00:00:00.000Z');
    expect(canonico).toMatchObject({
      ticker: 'VALE',
      company_name: 'Vale S.A.',
      setor: 'Extração Mineral',
      period: '3T25',
      period_end: '2025-09-30',
      source_url: 'https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/ITR/DADOS/itr_cia_aberta_2025.zip',
      fetched_at: '2026-08-07T00:00:00.000Z',
    });
  });

  it('converte a comparação YoY quando presente', () => {
    const periodo = periodoBase();
    periodo.receitaMesmoTrimestreAnoAnterior = { valor: 50000000, escalaMoeda: 'MIL' };

    const canonico = paraCanonico(periodo, '2026-08-07T00:00:00.000Z');
    expect(canonico.receita_mesmo_trimestre_ano_anterior).toBe(50000000000);
  });

  it('deixa a comparação YoY ausente quando não veio da CVM (caso do 4º trimestre)', () => {
    const canonico = paraCanonico(periodoBase(), '2026-08-07T00:00:00.000Z');
    expect(canonico.receita_mesmo_trimestre_ano_anterior).toBeUndefined();
  });
});
