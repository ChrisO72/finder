ALTER TABLE "videos" ADD COLUMN "summary_embedding" vector(1024);--> statement-breakpoint
CREATE INDEX "videos_summary_search_idx" ON "videos" USING gin (to_tsvector('english', "summary"));--> statement-breakpoint
CREATE INDEX "videos_summary_embedding_idx" ON "videos" USING hnsw ("summary_embedding" vector_cosine_ops);