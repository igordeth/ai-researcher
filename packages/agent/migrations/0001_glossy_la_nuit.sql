CREATE TABLE "documentos_web" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"query" text NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"source_url" text NOT NULL,
	"chunk_index" integer NOT NULL,
	"fetched_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"embedding" vector(768) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "documentos_web_source_url_chunk_idx" ON "documentos_web" USING btree ("source_url","chunk_index");--> statement-breakpoint
CREATE INDEX "documentos_web_embedding_idx" ON "documentos_web" USING hnsw ("embedding" vector_cosine_ops);