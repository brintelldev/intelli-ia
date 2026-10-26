import { createHash } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Chave estável (sha256) a partir das partes. As partes entram como JSON, então ["a","bc"] e ["ab","c"]
 * geram chaves diferentes. Quem chama decide o que entra: no chat, o userId, para que o cache de uma
 * pessoa nunca responda a outra (a base é filtrada por acesso).
 */
export function cacheKey(parts: string[]): string {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex");
}

/** Só devolve entrada não expirada. */
export async function getCached<T>(key: string): Promise<{ value: T; createdAt: Date } | null> {
  const row = await prisma.responseCache.findFirst({ where: { cacheKey: key, expiresAt: { gt: new Date() } } });
  return row ? { value: row.response as T, createdAt: row.createdAt } : null;
}

/** Grava (ou substitui, renovando `createdAt`) e aproveita para apagar as entradas já expiradas. */
export async function setCached<T>(key: string, value: T, module: string, ttlHours = 24): Promise<void> {
  const now = new Date();
  const data = { response: value as Prisma.InputJsonValue, module, expiresAt: new Date(now.getTime() + ttlHours * 3_600_000), createdAt: now };
  await prisma.$transaction([
    prisma.responseCache.deleteMany({ where: { expiresAt: { lte: now } } }),
    prisma.responseCache.upsert({ where: { cacheKey: key }, create: { cacheKey: key, ...data }, update: data }),
  ]);
}
