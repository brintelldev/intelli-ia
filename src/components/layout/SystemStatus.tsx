"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type State = "checking" | "ok" | "degraded" | "down";

const VIEW: Record<State, { label: string; dot: string; ping: boolean }> = {
  checking: { label: "CHECKING…", dot: "bg-text-muted", ping: false },
  ok: { label: "SISTEMA ONLINE", dot: "bg-emerald-400", ping: true },
  degraded: { label: "SISTEMA PARCIAL", dot: "bg-amber-400", ping: true },
  down: { label: "SISTEMA OFFLINE", dot: "bg-red-400", ping: false },
};

// Estado real da stack (GET /api/health), reconsultado a cada minuto. Começa em "CHECKING…" para
// nunca afirmar "online" sem ter perguntado.
export function SystemStatus() {
  const [state, setState] = useState<State>("checking");

  useEffect(() => {
    let alive = true;
    async function check() {
      try {
        const res = await fetch("/api/health", { cache: "no-store" });
        const body = (await res.json()) as { status?: State };
        if (alive) setState(body.status ?? "down");
      } catch {
        if (alive) setState("down");
      }
    }
    check();
    const id = setInterval(check, 60_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const v = VIEW[state];
  return (
    <p className="flex items-center gap-2" role="status" data-testid="system-status" data-state={state}>
      <span className="relative flex size-2" aria-hidden="true">
        {v.ping && <span className={cn("absolute inline-flex size-full animate-ping rounded-full opacity-60", v.dot)} />}
        <span className={cn("relative inline-flex size-2 rounded-full", v.dot)} />
      </span>
      {v.label}
    </p>
  );
}
