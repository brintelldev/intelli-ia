"use client";

import { SearchIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { routeForQuery } from "@/lib/home-routing";
import type { Role } from "@/lib/rbac";

// O texto digitado não é enviado a lugar nenhum: só decide para qual módulo navegar
// (routeForQuery). Enter ou ⌘/Ctrl+Enter executam.
export function CommandBar({ role }: { role: Role }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [pending, start] = useTransition();

  function go() {
    start(() => router.push(routeForQuery(text, role)));
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    go();
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      go();
    }
  }

  return (
    <form onSubmit={onSubmit} role="search" className="flex w-full max-w-2xl items-center gap-3">
      <div className="relative flex-1">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-text-muted" aria-hidden="true" />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          aria-label="Comando"
          placeholder="Ask anything, search documents, or research the web..."
          autoComplete="off"
          className="h-12 w-full rounded-xl border border-border bg-surface pr-4 pl-10 text-sm sm:pr-16 text-text-primary shadow-sm outline-none transition-shadow placeholder:text-text-muted focus:border-accent-primary focus:ring-3 focus:ring-accent-primary/30"
        />
        <kbd
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 right-3 hidden -translate-y-1/2 rounded-md sm:block bg-surface-raised px-1.5 py-0.5 font-mono text-[11px] text-text-secondary"
        >
          ⌘↵
        </kbd>
      </div>
      <Button type="submit" size="lg" disabled={pending} className="h-12 rounded-xl px-5 font-semibold text-white">
        {pending ? "…" : "Execute →"}
      </Button>
    </form>
  );
}
