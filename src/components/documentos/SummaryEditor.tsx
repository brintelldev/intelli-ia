"use client";

import { RotateCcwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type SummaryValue = { summary?: string; sections?: { heading: string; content: string }[] };

/**
 * O resumo gerado, EDITÁVEL antes de exportar (UC-05): um campo para o texto corrido ou um por seção. O que a pessoa
 * edita é o que a exportação leva. "Restaurar" volta ao texto gerado (`original`).
 */
export function SummaryEditor({
  value,
  original,
  onChange,
  streaming,
  className,
}: {
  value: SummaryValue;
  original?: SummaryValue;
  onChange: (v: SummaryValue) => void;
  streaming?: boolean;
  className?: string;
}) {
  const edited = !!original && JSON.stringify(original) !== JSON.stringify(value);
  const field = "w-full resize-y rounded-lg border border-border bg-surface px-3 py-2 text-sm leading-relaxed text-text-primary outline-none transition-colors field-sizing-content min-h-24 focus:border-accent-docs/60 focus:ring-[3px] focus:ring-accent-docs/20 disabled:opacity-70";
  return (
    <div className={cn("space-y-4", className)} aria-busy={streaming} data-testid="summary-editor">
      {value.summary !== undefined && (
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-text-primary">Resumo</span>
          <textarea aria-label="Resumo" value={value.summary} disabled={streaming} onChange={(e) => onChange({ ...value, summary: e.target.value })} className={field} />
        </label>
      )}
      {value.sections?.map((s, i) => (
        <label key={`${i}-${s.heading}`} className="block space-y-1.5">
          <span className="text-sm font-medium text-text-primary">{s.heading}</span>
          <textarea aria-label={s.heading} value={s.content} disabled={streaming} onChange={(e) => onChange({ ...value, sections: value.sections!.map((x, k) => (k === i ? { ...x, content: e.target.value } : x)) })} className={field} />
        </label>
      ))}
      <div className="flex items-center gap-3 text-xs text-text-muted">
        {edited && (
          <>
            <span className="rounded-full border border-accent-admin/40 px-2 py-0.5 text-accent-admin">Editado</span>
            <Button type="button" size="sm" variant="ghost" onClick={() => original && onChange(original)}>
              <RotateCcwIcon data-icon="inline-start" /> Restaurar o texto gerado
            </Button>
          </>
        )}
        {!edited && <span>Você pode editar o texto antes de exportar.</span>}
      </div>
    </div>
  );
}
