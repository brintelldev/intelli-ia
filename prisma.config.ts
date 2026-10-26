import { config } from "dotenv";
import { defineConfig, env } from "prisma/config";

// Prisma 7 não lê .env sozinho. Em dev a URL vem do .env.local; em produção
// (container `migrate`) já chega pelo ambiente e estes arquivos nem existem.
config({ path: ".env.local" });
config();

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: { url: env("DATABASE_URL") },
});
