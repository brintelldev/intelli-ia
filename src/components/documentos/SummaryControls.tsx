"use client";

import { useState } from "react";
import { Loader2Icon, RefreshCwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TemplateEditor } from "@/components/shared/TemplateEditor";
import { AUDIENCES, SIZES } from "@/lib/documentos/analysis";
import type { Template } from "@/lib/templates";
import { cn } from "@/lib/utils";

export type SummaryOptions = { size: (typeof SIZES)[number]; audience: (typeof AUDIENCES)[number] };

const SIZE_LABEL: Record<SummaryOptions["size"], string> = { curto: "Curto", medio: "Médio", longo: "Longo" };
const AUDIENCE_LABEL: Record<SummaryOptions["audience"], string> = { tecnico: "Técnico", executivo: "Executivo", juridico: "Jurídico" };

/** Seleção única em botões (radiogrupo acessível: setas movem a escolha). */
function Segmented<K extends string>({ label, value, options, onChange, disabled }: { label: string; value: K; options: Record<K, string>; onChange: (v: K) => void; disabled?: boolean }) {
  const keys = Object.keys(options) as K[];
  return (
    <div className="space-y-1.5">
      <span className="text-xs font-medium text-text-secondary" id={`seg-${label}`}>{label}</span>
      <div role="radiogroup" aria-labelledby={`seg-${label}`} className="inline-flex rounded-lg border border-border bg-surface p-0.5">
        {keys.map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={value === k}
            tabIndex={value === k ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(k)}
            onKeyDown={(e) => {
              const d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
              if (!d) return;
              e.preventDefault();
              const next = keys[(keys.indexOf(value) + d + keys.length) % keys.length];
              onChange(next);
              (e.currentTarget.parentElement?.querySelector(`[data-key="${next}"]`) as HTMLElement | null)?.focus();
            }}
            data-key={k}
            className={cn(
              "rounded-md px-3 py-1 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-accent-docs/50 focus-visible:outline-none disabled:opacity-50",
              value === k ? "bg-accent-docs/15 font-medium text-accent-docs" : "text-text-secondary hover:text-text-primary",
            )}
          >
            {options[k]}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Controles do resumo final (item 115): tamanho × público e, opcionalmente, as seções que a pessoa quer (modelo de
 * seções). "Regenerar resumo" refaz SÓ o resumo (POST /api/documentos/summary), sem repetir a análise.
 */
export function SummaryControls({
  value,
  onChange,
  onRegenerate,
  template,
  onTemplateChange,
  busy,
  disabled,
  className,
}: {
  value: SummaryOptions;
  onChange: (v: SummaryOptions) => void;
  onRegenerate: () => void;
  /** modelo de seções do resumo (módulo `demo1_summary`); `null` = só o texto corrido (o padrão) */
  template: Template | null;
  onTemplateChange: (t: Template | null, meta: { templateId: string | null }) => void;
  busy?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const off = disabled || busy;
  // o editor escolhe sozinho o 1º modelo ao abrir: por isso só é montado quando a pessoa pede seções próprias
  const [useSections, setUseSections] = useState(template !== null);
  return (
    <div className={cn("space-y-4 rounded-xl border border-border bg-surface p-4", className)} data-testid="summary-controls">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <Segmented label="Tamanho" value={value.size} options={SIZE_LABEL} onChange={(size) => onChange({ ...value, size })} disabled={off} />
        <Segmented label="Público" value={value.audience} options={AUDIENCE_LABEL} onChange={(audience) => onChange({ ...value, audience })} disabled={off} />
        <Button type="button" size="sm" className="ml-auto" disabled={disabled || busy} onClick={onRegenerate}>
          {busy ? <Loader2Icon className="animate-spin" data-icon="inline-start" /> : <RefreshCwIcon data-icon="inline-start" />}
          {busy ? "Gerando…" : "Regenerar resumo"}
        </Button>
      </div>
      <label className="flex w-fit cursor-pointer items-center gap-2 text-sm text-text-primary">
        <input
          type="checkbox"
          checked={useSections}
          disabled={off}
          onChange={(e) => {
            setUseSections(e.target.checked);
            if (!e.target.checked) onTemplateChange(null, { templateId: null });
          }}
          className="size-4 accent-[var(--accent-docs)]"
        />
        Organizar o resumo em seções (modelo de seções)
      </label>
      {useSections && <TemplateEditor module="demo1_summary" value={template} onChange={onTemplateChange} formatFields={["detail", "citations"]} />}
    </div>
  );
}
