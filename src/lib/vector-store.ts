import {referencePattern} from "./reference-query";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { AccessScope } from "@/lib/access";

/** Calibração T-31:20 perguntas/337chunks sintéticos; min positivo0,3085,max negativo0,2924.
 * Limiar0,30 separou os grupos (10/10 em cada); não equivale a probabilidade nem garante o ranking.
 * Evidência reproduzível: test-data/chat/calibration-results.json; revalidar com corpus/embeddings novos. */
export const MIN_SCORE = 0.30;

export type SourceType = "demo1_analysis" | "chat_upload" | "web_research" | "base";
export type ChunkMeta = { index: number; startPage: number; sectionTitle?: string; filename?: string; originUrl?: string; license?: string; edition?: string; fetchedAt?: string; rawSha256?: string; textSha256?: string; robotsAllowed?: boolean };

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

export async function insertChunks(rows: ChunkRow[], client: Pick<Prisma.TransactionClient,"$executeRaw"> = prisma): Promise<void> {
  if (!rows.length) return;
  const values = rows.map(
    (r) => Prisma.sql`(gen_random_uuid(), ${r.sourceId}, ${r.sourceType}, ${r.userId}, ${r.collectionId ?? null},
      ${r.content}, ${toVector(r.embedding)}::vector, ${JSON.stringify(r.metadata)}::jsonb)`,
  );
  await client.$executeRaw`INSERT INTO document_chunks
    (id, source_id, source_type, user_id, collection_id, content, embedding, metadata)
    VALUES ${Prisma.join(values)}`;
}

/**
 * Busca por cosseno (`<=>` = distância; score = 1 - distância), do mais parecido para o menos,
 * só dentro do que `access` permite. Abaixo de `minScore` não volta.
 */
export async function similaritySearch(p: {
  embedding: number[];
  query?: string;
  topK: number;
  minScore?: number;
  access: AccessScope;
  sourceType?: SourceType;
  sourceId?: string;
  collectionKind?: string;
}): Promise<SearchHit[]> {
  const q = toVector(p.embedding);
  const reference = p.sourceId && p.query ? referencePattern(p.query) : null;
  const { userId, isAdmin, collectionIds } = p.access;
  const rows = await prisma.$queryRaw<
    { content: string; score: number; source_id: string; source_type: string; collection_id: string | null; metadata: ChunkMeta; reference_match:boolean }[]
  >`WITH permitted AS MATERIALIZED (
    SELECT content, source_id, source_type, collection_id, metadata, embedding FROM document_chunks
    WHERE (${isAdmin} OR (collection_id IS NULL AND user_id = ${userId}) OR collection_id = ANY(${collectionIds}::text[]))
      ${p.sourceType ? Prisma.sql`AND source_type = ${p.sourceType}` : Prisma.empty}
      ${p.sourceId ? Prisma.sql`AND source_id = ${p.sourceId}` : Prisma.empty}
      ${p.collectionKind ? Prisma.sql`AND collection_id IN (SELECT id FROM "Collection" WHERE kind = ${p.collectionKind})` : Prisma.empty}
    )
    SELECT content, source_id, source_type, collection_id, metadata,
           1 - (embedding <=> ${q}::vector) AS score,
           (${reference}::text IS NOT NULL AND content ~* ${reference ?? "(?!)"}) AS reference_match
    FROM permitted
    ORDER BY reference_match DESC, embedding <=> ${q}::vector
    LIMIT ${p.topK}`;
  // Ordenação exata APÓS autorização: HNSW global + filtro seletivo perdia chunks após popular o corpus.
  // Materializar mantém recall e o limite no conjunto permitido; reavaliar escala antes de produção.
  const min = p.minScore ?? MIN_SCORE;
  return rows
    .filter((r) => r.reference_match || r.score >= min)
    .map((r) => ({
      content: r.content,
      score: r.score,
      metadata: { ...r.metadata, sourceId: r.source_id, sourceType: r.source_type, ...(r.collection_id ? { collectionId: r.collection_id } : {}) },
    }));
}

export async function deleteBySource(sourceId: string): Promise<void> {
  await prisma.$executeRaw`DELETE FROM document_chunks WHERE source_id = ${sourceId}`;
}
