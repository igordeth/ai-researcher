-- Adicionado à mão: o drizzle-kit não gera CREATE EXTENSION. Sem isto, num banco novo (o Postgres
-- efêmero do docker-compose) o tipo vector(768) abaixo não existe e a migration falha.
CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE TABLE "documentos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticker" text NOT NULL,
	"company_name" text NOT NULL,
	"setor" text NOT NULL,
	"period" text NOT NULL,
	"period_end" date NOT NULL,
	"receita_liquida" bigint NOT NULL,
	"lucro_bruto" bigint NOT NULL,
	"lucro_liquido" bigint NOT NULL,
	"ativo_total" bigint NOT NULL,
	"patrimonio_liquido" bigint NOT NULL,
	"caixa_operacional" bigint NOT NULL,
	"receita_mesmo_trimestre_ano_anterior" bigint,
	"source_url" text NOT NULL,
	"fetched_at" timestamp with time zone NOT NULL,
	"paragraph" text NOT NULL,
	"embedding" vector(768)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "documentos_ticker_period_idx" ON "documentos" USING btree ("ticker","period");--> statement-breakpoint
CREATE INDEX "documentos_embedding_idx" ON "documentos" USING hnsw ("embedding" vector_cosine_ops);