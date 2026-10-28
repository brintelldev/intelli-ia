"use client";

import { useEffect, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type ModelOption = {
  id: string;
  label: string;
  provider: string;
  providerLabel: string;
  replayOnly?: boolean;
  inputPerM: number | null;
  outputPerM: number | null;
};

/** Valor do "sem escolha": o servidor usa o modelo configurado para o módulo. */
export const DEFAULT_MODEL = "";

// Os 3 provedores usam chave própria e paga (as camadas gratuitas podem usar os dados para treino),
// então "pago/gratuito" não distingue nada: o que ajuda a escolher é o custo relativo.
export type CostTier = "Econômico" | "Padrão" | "Avançado";
export function costTier(outputPerM: number | null): CostTier | null {
  if (outputPerM == null) return null;
  return outputPerM <= 1 ? "Econômico" : outputPerM <= 12 ? "Padrão" : "Avançado";
}

const TIER_STYLE: Record<CostTier, string> = {
  Econômico: "border-accent-docs/30 bg-accent-docs/12 text-accent-docs",
  Padrão: "border-accent-search/30 bg-accent-search/12 text-accent-search",
  Avançado: "border-accent-admin/30 bg-accent-admin/12 text-accent-admin",
};

// Monograma em vez do logotipo oficial: marca de terceiros fica fora do repositório.
const PROVIDER_STYLE: Record<string, { letter: string; cls: string }> = {
  anthropic: { letter: "A", cls: "bg-orange-400/15 text-orange-300" },
  openai: { letter: "O", cls: "bg-emerald-400/15 text-emerald-300" },
  google: { letter: "G", cls: "bg-sky-400/15 text-sky-300" },
};

function ProviderMark({ provider }: { provider: string }) {
  const s = PROVIDER_STYLE[provider] ?? { letter: "?", cls: "bg-surface-raised text-text-secondary" };
  return (
    <span aria-hidden className={cn("flex size-5 shrink-0 items-center justify-center rounded text-[11px] font-bold", s.cls)}>
      {s.letter}
    </span>
  );
}

const money = (n: number) => `US$ ${n < 1 ? n.toFixed(2) : String(n)}`;

// Uma busca por sessão de página: vários seletores na mesma tela dividem a resposta.
let cached: Promise<ModelOption[]> | undefined;
export function invalidateModelCatalog() {
  cached = undefined;
  window.dispatchEvent(new Event("intelli-models-changed"));
  localStorage.setItem("intelli-models-changed", String(Date.now()));
}

function loadModels(): Promise<ModelOption[]> {
  cached ??= fetch("/api/models")
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .then((j: { models: ModelOption[] }) => j.models)
    .catch((e) => {
      cached = undefined; // não gravar a falha: a próxima montagem tenta de novo
      throw e;
    });
  return cached;
}

/**
 * Escolha de modelo. A lista vem de GET /api/models, que já omite os provedores desativados pelo Admin
 * (um modelo escolhido que sumiu da lista volta sozinho para o padrão). `models` permite fornecer a
 * lista de fora (testes e a página de demonstração).
 */
export function ModelSelector({
  value,
  onChange,
  models: provided,
  allowDefault = true,
  disabled,
  className,
}: {
  value: string;
  onChange: (id: string) => void;
  models?: ModelOption[];
  allowDefault?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const [fetched, setFetched] = useState<ModelOption[] | null>(null);
  const [failed, setFailed] = useState(false);
  const models = provided ?? fetched;

  useEffect(() => {
    if (provided) return;
    let alive = true;
    const load = () => loadModels().then((m) => { if (alive) { setFetched(m); setFailed(false); } }, () => alive && setFailed(true));
    const refresh = () => { cached = undefined; void load(); };
    void load();
    window.addEventListener("intelli-models-changed", refresh);
    window.addEventListener("focus", refresh);
    const storage = (event: StorageEvent) => { if (event.key === "intelli-models-changed") refresh(); };
    window.addEventListener("storage", storage);
    return () => {
      alive = false;
      window.removeEventListener("intelli-models-changed", refresh);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", storage);
    };
  }, [provided]);

  useEffect(() => {
    if (models && value !== DEFAULT_MODEL && !models.some((m) => m.id === value)) onChange(DEFAULT_MODEL);
  }, [models, value, onChange]);

  const selected = models?.find((m) => m.id === value);
  const items = [
    ...(allowDefault ? [{ value: DEFAULT_MODEL, label: "Padrão do sistema" }] : []),
    ...(models ?? []).map((m) => ({ value: m.id, label: m.label+(m.replayOnly?" · gravação":"") })),
  ];

  return (
    <Select
      value={value}
      onValueChange={(v) => onChange(v ?? DEFAULT_MODEL)}
      items={items}
      disabled={disabled || (!models && !failed)}
    >
      <SelectTrigger aria-label="Modelo de IA" className={cn("min-w-52", className)}>
        <SelectValue>
          {() =>
            selected ? (
              <span className="flex items-center gap-2">
                <ProviderMark provider={selected.provider} />
                {selected.label}{selected.replayOnly?" · gravação":""}
              </span>
            ) : (
              <span className="text-text-secondary">{!models && !failed ? "Carregando modelos…" : "Padrão do sistema"}</span>
            )
          }
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="w-auto min-w-[min(28rem,calc(100vw-2rem))]">
        {allowDefault && (
          <SelectItem value={DEFAULT_MODEL}>
            <span className="flex flex-col">
              <span>Padrão do sistema</span>
              <span className="text-xs text-text-muted">O Admin define o modelo de cada módulo</span>
            </span>
          </SelectItem>
        )}
        {(models ?? []).map((m) => {
          const tier = costTier(m.outputPerM);
          return (
            <SelectItem key={m.id} value={m.id}>
              <span className="flex w-full items-center gap-2">
                <ProviderMark provider={m.provider} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span>{m.label}{m.replayOnly?" · gravação":""}</span>
                  <span className="text-xs text-text-muted">
                    {m.replayOnly?"Somente entradas já gravadas":m.providerLabel}
                    {!m.replayOnly && m.inputPerM != null && m.outputPerM != null && ` · ${money(m.inputPerM)} entrada / ${money(m.outputPerM)} saída por 1M tokens`}
                  </span>
                </span>
                {tier && <span className={cn("rounded-full border px-1.5 py-0.5 text-[10px] font-medium", TIER_STYLE[tier])}>{tier}</span>}
              </span>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
