CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
ALTER TABLE "segments" ADD COLUMN "embedding" vector(1024);--> statement-breakpoint
CREATE INDEX "segments_embedding_idx" ON "segments" USING hnsw ("embedding" vector_cosine_ops);