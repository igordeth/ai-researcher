import type { documentos } from '../db/schema.js';
import type { Documento } from './documento.js';

type LinhaDocumento = typeof documentos.$inferInsert;

/** Documento do corpus (snake_case, como no JSON) → linha da tabela (camelCase, como no Drizzle). */
export function paraLinha(documento: Documento, embedding: number[]): LinhaDocumento {
  return {
    ticker: documento.ticker,
    companyName: documento.company_name,
    setor: documento.setor,
    period: documento.period,
    periodEnd: documento.period_end,
    receitaLiquida: documento.receita_liquida,
    lucroBruto: documento.lucro_bruto,
    lucroLiquido: documento.lucro_liquido,
    ativoTotal: documento.ativo_total,
    patrimonioLiquido: documento.patrimonio_liquido,
    caixaOperacional: documento.caixa_operacional,
    // null explícito, e não undefined: no upsert, undefined deixaria o valor antigo na coluna.
    receitaMesmoTrimestreAnoAnterior: documento.receita_mesmo_trimestre_ano_anterior ?? null,
    sourceUrl: documento.source_url,
    fetchedAt: new Date(documento.fetched_at),
    paragraph: documento.paragraph,
    embedding,
  };
}
