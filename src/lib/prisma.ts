import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

// Singleton: o hot reload do dev recriaria o client (e o pool) a cada edição.
const g = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  g.prisma ??
  new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

if (process.env.NODE_ENV !== "production") g.prisma = prisma;
