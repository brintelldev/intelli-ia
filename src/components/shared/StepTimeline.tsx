import { CheckIcon, Loader2Icon, XIcon } from "lucide-react";
import type { StepData } from "@/lib/stream-steps";
import { cn } from "@/lib/utils";

const seconds = (ms: number) => `${(ms / 1000).toFixed(1).replace(".", ",")} s`;

/**
 * Linha do tempo das etapas de uma operação (raciocínio do agente, progresso da análise).
 * `renderExtra` desenha o que cada módulo põe em `extra` (ex.: "3 fontes", selo de cache).
 */
export function StepTimeline({
  steps,
  renderExtra,
  className,
}: {
  steps: StepData[];
  renderExtra?: (step: StepData) => React.ReactNode;
  className?: string;
}) {
  if (steps.length === 0) return null;
  return (
    <ol className={cn("space-y-2", className)} aria-label="Etapas" aria-live="polite">
      {steps.map((s) => (
        <li key={s.id} data-status={s.status} className="flex items-center gap-2.5 text-sm">
          <span
            className={cn(
              "flex size-5 shrink-0 items-center justify-center rounded-full",
              s.status === "done" && "bg-accent-docs/15 text-accent-docs",
              s.status === "running" && "bg-accent-primary/15 text-accent-primary",
              s.status === "error" && "bg-destructive/15 text-destructive",
            )}
          >
            {s.status === "running" ? <Loader2Icon className="size-3 animate-spin" aria-label="em andamento" /> : s.status === "done" ? <CheckIcon className="size-3" aria-label="concluída" /> : <XIcon className="size-3" aria-label="falhou" />}
          </span>
          <span className={cn(s.status === "running" ? "text-text-primary" : "text-text-secondary", s.status === "error" && "text-destructive")}>{s.label}</span>
          {renderExtra?.(s)}
          {s.status !== "running" && s.ms > 0 && <span className="ml-auto text-xs text-text-muted tabular-nums">{seconds(s.ms)}</span>}
        </li>
      ))}
    </ol>
  );
}
