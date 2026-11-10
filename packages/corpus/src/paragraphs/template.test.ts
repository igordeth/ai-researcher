import { describe, expect, it } from 'vitest';
import { gerarParagrafo } from './template.js';
import type { IndicadorTrimestral } from '../types.js';

function indicadorBase(): IndicadorTrimestral {
  return {
    ticker: 'VALE',
    company_name: 'Vale S.A.',
    setor: 'Extração Mineral',
    period: '3T25',
    period_end: '2025-09-30',
    receita_liquida: 56_701_000_000,
    lucro_bruto: 20_624_000_000,
    lucro_liquido: 14_671_000_000,
    ativo_total: 484_953_000_000,
    patrimonio_liquido: 224_733_000_000,
    caixa_operacional: 8_500_000_000,
    source_url: 'https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/ITR/DADOS/itr_cia_aberta_2025.zip',
    fetched_at: '2026-08-07T00:00:00.000Z',
    receita_mesmo_trimestre_ano_anterior: 50_000_000_000,
  };
}

describe('gerarParagrafo', () => {
  it('produz o parágrafo completo com YoY e QoQ — mesma entrada, mesma saída byte a byte', () => {
    const indicador = indicadorBase();
    const paragrafo = gerarParagrafo(indicador, {
      trimestreAnterior: { valor: 60_000_000_000, period: '2T25' },
    });

    expect(paragrafo).toBe(
      'No 3T25, a Vale S.A. reportou receita líquida de R$ 56,7 bilhões, alta de 13,4% frente ao 3T24 e queda de 5,5% frente ao 2T25. O lucro líquido foi de R$ 14,7 bilhões, com margem líquida de 25,9%. O caixa gerado nas operações somou R$ 8,5 bilhões.',
    );

    // determinismo: rodar de novo com a mesma entrada dá exatamente a mesma string
    expect(
      gerarParagrafo(indicador, { trimestreAnterior: { valor: 60_000_000_000, period: '2T25' } }),
    ).toBe(paragrafo);
  });

  it('omite a cláusula YoY quando a CVM não oferece o comparativo (caso do 4º trimestre)', () => {
    const indicador = indicadorBase();
    indicador.receita_mesmo_trimestre_ano_anterior = undefined;

    const paragrafo = gerarParagrafo(indicador, {
      trimestreAnterior: { valor: 60_000_000_000, period: '2T25' },
    });

    expect(paragrafo).toContain(
      'receita líquida de R$ 56,7 bilhões, queda de 5,5% frente ao 2T25.',
    );
    expect(paragrafo).not.toContain('3T24');
  });

  it('omite a cláusula QoQ quando o trimestre é o mais antigo da janela coletada', () => {
    const paragrafo = gerarParagrafo(indicadorBase());

    expect(paragrafo).toContain(
      'receita líquida de R$ 56,7 bilhões, alta de 13,4% frente ao 3T24.',
    );
    expect(paragrafo).not.toContain('2T25');
  });

  it('não escreve vírgula nem cláusula nenhuma quando as duas comparações estão ausentes', () => {
    const indicador = indicadorBase();
    indicador.receita_mesmo_trimestre_ano_anterior = undefined;

    const paragrafo = gerarParagrafo(indicador);

    expect(
      paragrafo.startsWith(
        'No 3T25, a Vale S.A. reportou receita líquida de R$ 56,7 bilhões. O lucro',
      ),
    ).toBe(true);
  });

  it('usa milhões quando o valor fica abaixo de 1 bilhão', () => {
    const indicador = indicadorBase();
    indicador.caixa_operacional = 340_200_000;

    const paragrafo = gerarParagrafo(indicador);

    expect(paragrafo).toContain('O caixa gerado nas operações somou R$ 340,2 milhões.');
  });
});
