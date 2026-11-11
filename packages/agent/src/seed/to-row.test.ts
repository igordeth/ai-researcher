import { describe, expect, it } from 'vitest';

import type { Documento } from './documento.js';
import { paraLinha } from './to-row.js';

const documento: Documento = {
  ticker: 'ABEV',
  company_name: 'Ambev S.A.',
  setor: 'Bebidas e Fumo',
  period: '4T25',
  period_end: '2025-12-31',
  receita_liquida: 24_000_000_000,
  lucro_bruto: 12_000_000_000,
  lucro_liquido: 4_000_000_000,
  ativo_total: 145_000_000_000,
  patrimonio_liquido: 95_000_000_000,
  caixa_operacional: 9_000_000_000,
  source_url: 'https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/DFP/DADOS/dfp_cia_aberta_2025.zip',
  fetched_at: '2026-08-08T02:19:40.760Z',
  paragraph: 'No 4T25, a Ambev S.A. reportou receita líquida de R$ 24,0 bilhões.',
};

describe('paraLinha', () => {
  it('traduz snake_case para os campos do Drizzle e converte fetched_at em Date', () => {
    const linha = paraLinha(documento, [0.1, 0.2]);

    expect(linha.companyName).toBe('Ambev S.A.');
    expect(linha.periodEnd).toBe('2025-12-31');
    expect(linha.receitaLiquida).toBe(24_000_000_000);
    expect(linha.fetchedAt).toEqual(new Date('2026-08-08T02:19:40.760Z'));
    expect(linha.embedding).toEqual([0.1, 0.2]);
  });

  it('usa null (e não undefined) quando o comparativo YoY está ausente, caso do 4º trimestre', () => {
    const linha = paraLinha(documento, []);

    expect(linha.receitaMesmoTrimestreAnoAnterior).toBeNull();
  });

  it('preserva o comparativo YoY quando presente', () => {
    const linha = paraLinha(
      { ...documento, receita_mesmo_trimestre_ano_anterior: 22_000_000_000 },
      [],
    );

    expect(linha.receitaMesmoTrimestreAnoAnterior).toBe(22_000_000_000);
  });
});
