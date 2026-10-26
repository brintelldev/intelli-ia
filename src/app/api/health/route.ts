import { connection } from "next/server";
import { prisma } from "@/lib/prisma";

// Saúde da stack para o smoke test, o healthcheck do container e o "SYSTEM ONLINE" do footer.
// Pública (o proxy não cobre /api), então devolve só booleanos e tempos: nada de erro, host ou versão.
//   200 + "ok"        tudo certo
//   200 + "degraded"  banco ok, mas docling ou SearXNG fora (a app funciona, com recursos a menos)
//   503 + "down"      banco fora ou sem a extensão pgvector (migrations não rodaram)
type Check = { ok: boolean; ms: number };

async function timed(fn: () => Promise<boolean>): Promise<Check> {
  const t0 = performance.now();
  const ok = await fn().catch(() => false);
  return { ok, ms: Math.round(performance.now() - t0) };
}

async function ping(baseUrl: string | undefined, path: string): Promise<boolean> {
  if (!baseUrl) return false;
  const res = await fetch(new URL(path, baseUrl), { signal: AbortSignal.timeout(2500), cache: "no-store" });
  return res.ok;
}

export async function GET() {
  await connection(); // sempre em tempo de requisição, nunca pré-renderizada no build

  const [db, docling, searxng] = await Promise.all([
    timed(async () => {
      const rows = await prisma.$queryRaw<{ vector: boolean }[]>`
        SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') AS vector`;
      return rows[0]?.vector === true;
    }),
    timed(() => ping(process.env.DOCLING_URL, "/health")),
    timed(() => ping(process.env.SEARXNG_URL, "/healthz")),
  ]);

  const status = !db.ok ? "down" : docling.ok && searxng.ok ? "ok" : "degraded";
  return Response.json(
    { status, db, docling, searxng },
    { status: db.ok ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
