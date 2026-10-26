"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { pageTitle } from "@/lib/modules";

// Título da página + breadcrumb simples. `children` recebe ações à direita (ex.: menu do usuário
// no mobile, onde a sidebar não aparece).
export function TopBar({ children }: { children?: ReactNode }) {
  const t = pageTitle(usePathname());
  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border bg-background/80 px-4 backdrop-blur md:px-6">
      <nav aria-label="Você está em">
        <ol className="flex items-center gap-2 text-sm">
          <li className="text-text-muted">Intelli AI</li>
          {t && (
            <>
              <li aria-hidden="true" className="text-text-muted">
                /
              </li>
              <li className={t.page ? "text-text-secondary" : "font-semibold"} aria-current={t.page ? undefined : "page"}>
                {t.section}
              </li>
            </>
          )}
          {t?.page && (
            <>
              <li aria-hidden="true" className="text-text-muted">
                /
              </li>
              <li className="font-semibold" aria-current="page">
                {t.page}
              </li>
            </>
          )}
        </ol>
      </nav>
      <div className="flex items-center gap-2">{children}</div>
    </header>
  );
}
