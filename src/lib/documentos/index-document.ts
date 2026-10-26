import { embedBatch } from "@/lib/embeddings";
import { prisma } from "@/lib/prisma";
import { purgeChatCache } from "@/lib/privacy";
import { estimateTokens } from "@/lib/pdf/document";
import { chunkDocument } from "@/lib/pdf/chunker";
import { deleteBySource, insertChunks } from "@/lib/vector-store";
import type { CheckedAnalysis, PageIn } from "./analysis";

/**
 * Grava o documento analisado no banco vetorial (sourceType `demo1_analysis`) e cria o `DocumentSource`, para o
 * chat (Demo 3) responder sobre ele. Reanalisar o MESMO arquivo (mesmo nome, mesma pessoa) SUBSTITUI o anterior,
 * em vez de empilhar cópias, e limpa o cache do chat, que podia ter respostas do texto antigo.
 */
export async function indexAnalyzedDocument(opts: { userId: string; filename: string; pages: readonly PageIn[]; analysis: CheckedAnalysis }): Promise<{ sourceId: string; chunkCount: number }> {
  // monta o documento direto das páginas recebidas (com o número REAL de cada uma): quebrar um texto pelo marcador
  // de página deslocaria tudo se o próprio conteúdo contivesse o marcador
  const pages = opts.pages.map((p) => ({ number: p.number, content: p.content.trim(), tokenCount: estimateTokens(p.content) }));
  const chunks = chunkDocument({ text: pages.map((p) => p.content).join("\n\n"), pages, isScanned: false, isProtected: false });
  if (!chunks.length) throw new Error("documento sem texto para indexar");
  const vectors = await embedBatch(chunks.map((c) => c.content));

  const previous = await prisma.documentSource.findMany({ where: { userId: opts.userId, filename: opts.filename, sourceType: "demo1_analysis" }, select: { id: true } });
  for (const p of previous) await deleteBySource(p.id);
  if (previous.length) await prisma.documentSource.deleteMany({ where: { id: { in: previous.map((p) => p.id) } } });

  const source = await prisma.documentSource.create({
    data: {
      userId: opts.userId,
      filename: opts.filename,
      sourceType: "demo1_analysis",
      topics: opts.analysis.taxonomy.slice(0, 5),
      summary: opts.analysis.summary.slice(0, 500) || null,
      chunkCount: chunks.length,
    },
  });
  await insertChunks(
    chunks.map((c, i) => ({
      sourceId: source.id,
      sourceType: "demo1_analysis" as const,
      userId: opts.userId,
      content: c.content,
      embedding: vectors[i],
      metadata: { ...c.metadata, filename: opts.filename },
    })),
  );
  if (previous.length) await purgeChatCache();
  return { sourceId: source.id, chunkCount: chunks.length };
}
