export interface Empresa {
  ticker: string;
  razaoSocial: string;
  /** 6 dígitos, zero à esquerda — mesmo formato do campo CD_CVM nos CSVs da CVM. */
  cdCvm: string;
  setor: string;
}

export type EscalaMoeda = 'MIL' | 'UNIDADE';

export interface ValorConta {
  valor: number;
  escalaMoeda: EscalaMoeda;
}

export interface IndicadoresBrutos {
  receitaLiquida: ValorConta;
  lucroBruto: ValorConta;
  lucroLiquido: ValorConta;
  ativoTotal: ValorConta;
  patrimonioLiquido: ValorConta;
  caixaOperacional: ValorConta;
}

export interface PeriodoColetado {
  empresa: Empresa;
  /** Ex.: "3T25" */
  period: string;
  /** Ex.: "2025-09-30" */
  periodEnd: string;
  sourceUrl: string;
  indicadores: IndicadoresBrutos;
  /**
   * Receita do mesmo trimestre do ano anterior, lida direto de ORDEM_EXERC=PENÚLTIMO
   * na mesma linha da CVM — usada para a comparação YoY. Nunca preenchida para o 4º
   * trimestre (ver "Simplificação deliberada" no plano).
   */
  receitaMesmoTrimestreAnoAnterior?: ValorConta;
}

/**
 * O documento que vai para data/documentos/{TICKER}.json — o contrato do corpus com o resto do
 * projeto (seed, banco, evals). Por isso os campos estão em snake_case, com os mesmos nomes do
 * CLAUDE.md e das colunas do banco. Os tipos acima são internos à coleta e seguem camelCase;
 * a tradução de um para o outro acontece num lugar só: `paraCanonico`.
 */
export interface IndicadorTrimestral {
  ticker: string;
  company_name: string;
  setor: string;
  period: string;
  period_end: string;
  receita_liquida: number;
  lucro_bruto: number;
  lucro_liquido: number;
  ativo_total: number;
  patrimonio_liquido: number;
  caixa_operacional: number;
  source_url: string;
  fetched_at: string;
  /** YoY — já convertido para reais. Ausente quando a CVM não oferece o comparativo (4º trimestre). */
  receita_mesmo_trimestre_ano_anterior?: number;
}

export interface DocumentoFinal extends IndicadorTrimestral {
  paragraph: string;
}

/** Linha crua de um CSV da CVM, indexada pelo cabeçalho original. */
export type LinhaCvm = Record<string, string>;
