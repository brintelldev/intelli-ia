import type { TavilyOperation } from "./search-core";
import { tavilyUsage } from "./tavily-usage";
export type TavilySettlement = ReturnType<typeof tavilyUsage> & { status: "success" | "error" };

/** Reserva confirmada ANTES da rede. Falha posterior nunca devolve a reserva ao saldo. */
export function createTavilyBudget(store: {
  reserve: (operation: TavilyOperation) => Promise<string | null>;
  settle: (id: string, data: TavilySettlement) => Promise<void>;
}) {
  return async function runTavily(operation: TavilyOperation, request: () => Promise<unknown>): Promise<unknown | null> {
    let id: string | null;
    try { id = await store.reserve(operation); } catch { return null; }
    if (!id) return null;
    let payload: unknown = null;
    let status: "success" | "error" = "success";
    try { payload = await request(); } catch { status = "error"; }
    try { await store.settle(id, { status, ...tavilyUsage(payload) }); } catch { /* conserva a reserva durável */ }
    return payload;
  };
}
