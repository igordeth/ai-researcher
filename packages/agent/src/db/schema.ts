import {
  bigint,
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  vector,
} from 'drizzle-orm/pg-core';

// O gemini-embedding-001 gera 3072 dimensões por padrão. A chamada de embedding pede 768
// (`output_dimensionality`) porque o índice HNSW do pgvector não indexa vetores com mais de
// 2000 dimensões. Trocar este número (ou o modelo) invalida o índice inteiro: o seed roda do zero.
export const EMBEDDING_DIMENSIONS = 768;

export const documentos = pgTable(
  'documentos',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ticker: text('ticker').notNull(),
    companyName: text('company_name').notNull(),
    setor: text('setor').notNull(),
    period: text('period').notNull(),
    periodEnd: date('period_end').notNull(),
    // Valores em reais (a conversão de milhares acontece uma vez, na normalização do corpus).
    // bigint porque o ativo total de um banco passa de R$ 3 trilhões, além do limite do integer.
    // mode 'number': até 2^53 o number do JS é exato, e o maior valor do corpus fica ordens de
    // grandeza abaixo disso.
    receitaLiquida: bigint('receita_liquida', { mode: 'number' }).notNull(),
    lucroBruto: bigint('lucro_bruto', { mode: 'number' }).notNull(),
    lucroLiquido: bigint('lucro_liquido', { mode: 'number' }).notNull(),
    ativoTotal: bigint('ativo_total', { mode: 'number' }).notNull(),
    patrimonioLiquido: bigint('patrimonio_liquido', { mode: 'number' }).notNull(),
    caixaOperacional: bigint('caixa_operacional', { mode: 'number' }).notNull(),
    // Nula no 4º trimestre: a CVM não oferece o comparativo YoY nesse período.
    receitaMesmoTrimestreAnoAnterior: bigint('receita_mesmo_trimestre_ano_anterior', {
      mode: 'number',
    }),
    sourceUrl: text('source_url').notNull(),
    fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull(),
    paragraph: text('paragraph').notNull(),
    // Nulo até o `pnpm seed` gerar o embedding do paragraph.
    embedding: vector('embedding', { dimensions: EMBEDDING_DIMENSIONS }),
  },
  (table) => [
    // Um documento por empresa e trimestre. É também a chave do upsert do seed.
    uniqueIndex('documentos_ticker_period_idx').on(table.ticker, table.period),
    // vector_cosine_ops: o índice só acelera consultas que usam o mesmo operador, o de distância
    // de cosseno (<=>). Uma busca com distância euclidiana (<->) não usaria este índice.
    index('documentos_embedding_idx').using('hnsw', table.embedding.op('vector_cosine_ops')),
  ],
);

// Enriquecimento vindo da busca na web (nó webSearch). Tabela à parte de `documentos` porque não
// tem os indicadores financeiros do corpus, e porque envelhece: tem prazo de validade (expires_at),
// o dado da CVM não.
export const documentosWeb = pgTable(
  'documentos_web',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    // A pesquisa que trouxe a página. Serve para auditoria: porque é que este texto está na base.
    query: text('query').notNull(),
    title: text('title').notNull(),
    content: text('content').notNull(),
    sourceUrl: text('source_url').notNull(),
    // Posição do chunk dentro da página (0, 1, 2...).
    chunkIndex: integer('chunk_index').notNull(),
    fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    // Ao contrário do corpus, nunca nulo: o chunk só é gravado depois de ter embedding.
    embedding: vector('embedding', { dimensions: EMBEDDING_DIMENSIONS }).notNull(),
  },
  (table) => [
    // Uma página é gravada por substituição (apaga os chunks do URL e insere os novos, numa
    // transação). O índice único garante que nunca há dois chunks na mesma posição do mesmo URL,
    // mesmo com duas gravações em simultâneo, e serve o DELETE por source_url.
    uniqueIndex('documentos_web_source_url_chunk_idx').on(table.sourceUrl, table.chunkIndex),
    index('documentos_web_embedding_idx').using('hnsw', table.embedding.op('vector_cosine_ops')),
  ],
);
