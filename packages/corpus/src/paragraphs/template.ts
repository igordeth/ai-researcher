import type { IndicadorTrimestral } from '../types.js';

export interface ComparacaoReceita {
  valor: number;
  period: string;
}

const FORMATADOR_UMA_CASA = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

function formatarMoeda(valor: number): string {
  const abs = Math.abs(valor);
  if (abs >= 1_000_000_000) {
    return `R$ ${FORMATADOR_UMA_CASA.format(valor / 1_000_000_000)} bilhões`;
  }
  return `R$ ${FORMATADOR_UMA_CASA.format(valor / 1_000_000)} milhões`;
}

function formatarPercentual(delta: number): string {
  return `${FORMATADOR_UMA_CASA.format(Math.abs(delta))}%`;
}

function direcao(delta: number): 'alta' | 'queda' {
  return delta >= 0 ? 'alta' : 'queda';
}

function variacaoPercentual(atual: number, anterior: number): number {
  return ((atual - anterior) / Math.abs(anterior)) * 100;
}

/** "3T25" → "3T24". Usado só para a comparação YoY, que não carrega o objeto do trimestre anterior. */
function periodoAnoAnterior(period: string): string {
  const match = /^(\d)T(\d{2})$/.exec(period);
  if (!match) {
    throw new Error(`Período em formato inesperado: ${period}`);
  }
  const [, trimestre, anoStr] = match;
  const anoAnterior = (Number(anoStr) + 100 - 1) % 100;
  return `${trimestre}T${String(anoAnterior).padStart(2, '0')}`;
}

/**
 * Gera o parágrafo determinístico de um trimestre. Quando uma comparação (YoY ou QoQ) não está
 * disponível na janela coletada, a frase correspondente é omitida — nunca aproximada.
 */
export function gerarParagrafo(
  indicador: IndicadorTrimestral,
  comparacoes: { trimestreAnterior?: ComparacaoReceita } = {},
): string {
  const clausulas: string[] = [];

  if (indicador.receita_mesmo_trimestre_ano_anterior !== undefined) {
    const delta = variacaoPercentual(
      indicador.receita_liquida,
      indicador.receita_mesmo_trimestre_ano_anterior,
    );
    clausulas.push(
      `${direcao(delta)} de ${formatarPercentual(delta)} frente ao ${periodoAnoAnterior(indicador.period)}`,
    );
  }

  if (comparacoes.trimestreAnterior) {
    const delta = variacaoPercentual(
      indicador.receita_liquida,
      comparacoes.trimestreAnterior.valor,
    );
    clausulas.push(
      `${direcao(delta)} de ${formatarPercentual(delta)} frente ao ${comparacoes.trimestreAnterior.period}`,
    );
  }

  const sufixoReceita = clausulas.length > 0 ? `, ${clausulas.join(' e ')}` : '';
  const margemLiquida = (indicador.lucro_liquido / indicador.receita_liquida) * 100;

  return (
    `No ${indicador.period}, a ${indicador.company_name} reportou receita líquida de ` +
    `${formatarMoeda(indicador.receita_liquida)}${sufixoReceita}. ` +
    `O lucro líquido foi de ${formatarMoeda(indicador.lucro_liquido)}, com margem líquida de ` +
    `${FORMATADOR_UMA_CASA.format(margemLiquida)}%. ` +
    `O caixa gerado nas operações somou ${formatarMoeda(indicador.caixa_operacional)}.`
  );
}
