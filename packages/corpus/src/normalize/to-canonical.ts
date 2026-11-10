import type { IndicadorTrimestral, PeriodoColetado, ValorConta } from '../types.js';

/** A CVM publica em milhares de reais por padrão — a conversão para reais acontece aqui, uma única vez. */
function paraReais(valor: ValorConta): number {
  const fator = valor.escalaMoeda === 'MIL' ? 1000 : 1;
  return valor.valor * fator;
}

export function paraCanonico(
  periodo: PeriodoColetado,
  fetchedAt: string = new Date().toISOString(),
): IndicadorTrimestral {
  const { indicadores } = periodo;

  // A fronteira entre os tipos internos da coleta (camelCase) e o documento gravado (snake_case).
  return {
    ticker: periodo.empresa.ticker,
    company_name: periodo.empresa.razaoSocial,
    setor: periodo.empresa.setor,
    period: periodo.period,
    period_end: periodo.periodEnd,
    receita_liquida: paraReais(indicadores.receitaLiquida),
    lucro_bruto: paraReais(indicadores.lucroBruto),
    lucro_liquido: paraReais(indicadores.lucroLiquido),
    ativo_total: paraReais(indicadores.ativoTotal),
    patrimonio_liquido: paraReais(indicadores.patrimonioLiquido),
    caixa_operacional: paraReais(indicadores.caixaOperacional),
    source_url: periodo.sourceUrl,
    fetched_at: fetchedAt,
    receita_mesmo_trimestre_ano_anterior: periodo.receitaMesmoTrimestreAnoAnterior
      ? paraReais(periodo.receitaMesmoTrimestreAnoAnterior)
      : undefined,
  };
}
