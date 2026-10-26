import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { AccessScope } from "@/lib/access";

/** Piso de similaridade (cosseno) para um chunk ser considerado relevante. Calibrar na T-31. */
export const MIN_SCORE = 0.55;

export type SourceType = "demo1_analysis" | "chat_upload" | "web_research" | "base";
export type ChunkMeta = { index: number; startPage: number; sectionTitle?: string; filename?: string };

export type ChunkRow = {
  sourceId: string;
  sourceType: SourceType;
  userId: string;
  collectionId?: string | null;
  content: string;
  embedding: number[];
  metadata: ChunkMeta;
};

export type SearchHit = {
  content: string;
  score: number;
  metadata: ChunkMeta & { sourceId: string; sourceType: string; collectionId?: string };
};

const toVector = (v: number[]) => `[${v.join(",")}]`;

export async function insertChunks(rows: ChunkRow[]): Promise<void> {
  if (!rows.length) return;
  const values = rows.map(
    (r) => Prisma.sql`(gen_random_uuid(), ${r.sourceId}, ${r.sourceType}, ${r.userId}, ${r.collectionId ?? null},
      ${r.content}, ${toVector(r.embedding)}::vector, ${JSON.stringify(r.metadata)}::jsonb)`,
  );
  await prisma.$executeRaw`INSERT INTO document_chunks
    (id, source_id, source_type, user_id, collection_id, content, embedding, metadata)
    VALUES ${Prisma.join(values)}`;
}

/**
 * Busca por cosseno (`<=>` = distância; score = 1 - distância), do mais parecido para o menos,
 * só dentro do que `access` permite. Abaixo de `minScore` não volta.
 */
export async function similaritySearch(p: {
  embedding: number[];
  topK: number;
  minScore?: number;
  access: AccessScope;
  sourceType?: SourceType;
  sourceId?: string;
}): Promise<SearchHit[]> {
  const q = toVector(p.embedding);
  const { userId, isAdmin, collectionIds } = p.access;
  const rows = await prisma.$queryRaw<
    { content: string; score: number; source_id: string; source_type: string; collection_id: string | null; metadata: ChunkMeta }[]
  >`SELECT content, source_id, source_type, collection_id, metadata,
           1 - (embedding <=> ${q}::vector) AS score
    FROM document_chunks
    WHERE (${isAdmin} OR (collection_id IS NULL AND user_id = ${userId}) OR collection_id = ANY(${collectionIds}::text[]))
      ${p.sourceType ? Prisma.sql`AND source_type = ${p.sourceType}` : Prisma.empty}
      ${p.sourceId ? Prisma.sql`AND source_id = ${p.sourceId}` : Prisma.empty}
    ORDER BY embedding <=> ${q}::vector
    LIMIT ${p.topK}`;
  // ponytail: com filtro seletivo o índice HNSW pode devolver menos que topK (ef_search=40); no volume da demo a varredura é exata.
  const min = p.minScore ?? MIN_SCORE;
  return rows
    .filter((r) => r.score >= min)
    .map((r) => ({
      content: r.content,
      score: r.score,
      metadata: { ...r.metadata, sourceId: r.source_id, sourceType: r.source_type, ...(r.collection_id ? { collectionId: r.collection_id } : {}) },
    }));
}

export async function deleteBySource(sourceId: string): Promise<void> {
  await prisma.$executeRaw`DELETE FROM document_chunks WHERE source_id = ${sourceId}`;
}
