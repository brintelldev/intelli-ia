"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowDownIcon, ArrowUpIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MANDATORY, MAX_SECTIONS, normTitle, TemplateSchema, type Template, type TemplateModule } from "@/lib/templates";
import { cn } from "@/lib/utils";

type Stored = Template & { id: string; name: string; system: boolean };

const TONES = { tecnico: "Técnico", executivo: "Executivo", juridico: "Jurídico" } as const;
const LENGTHS = { curto: "Curto", medio: "Médio", longo: "Longo" } as const;
const DETAILS = { resumido: "Resumido", detalhado: "Detalhado" } as const;

const same = (a: Template, b: Template) => JSON.stringify([a.sections.map((s) => [s.title, s.instructions ?? ""]), a.format]) === JSON.stringify([b.sections.map((s) => [s.title, s.instructions ?? ""]), b.format]);

function Option<K extends string>({ label, value, options, onChange }: { label: string; value: K; options: Record<K, string>; onChange: (v: K) => void }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-text-secondary">
      {label}
      <Select value={value} onValueChange={(v) => v && onChange(v as K)} items={Object.entries(options).map(([value, label]) => ({ value, label: label as string }))}>
        <SelectTrigger size="sm" aria-label={label} className="min-w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(options).map(([v, l]) => (
            <SelectItem key={v} value={v}>{l as string}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

/**
 * Escolher um modelo de seções, ajustar (adicionar, remover, renomear, reordenar, instrução por seção) e
 * definir os critérios de formatação. `onChange` recebe o rascunho e o `templateId` (nulo quando o
 * rascunho foi editado: a rota de IA então usa o rascunho inline). A seção obrigatória do módulo não
 * aparece na lista quando removida, mas é acrescentada no servidor (`withMandatory`).
 */
export function TemplateEditor({
  module,
  value,
  onChange,
  collapsible = true,
  defaultOpen = false,
  formatFields = ["tone", "length", "detail", "citations"],
  className,
}: {
  module: TemplateModule;
  value: Template | null;
  onChange: (t: Template, meta: { templateId: string | null }) => void;
  collapsible?: boolean;
  defaultOpen?: boolean;
  /** quais critérios de formatação mostrar (o resumo do Demo 1 tira tom e tamanho: vêm dos controles de público e tamanho) */
  formatFields?: ("tone" | "length" | "detail" | "citations")[];
  className?: string;
}) {
  const [list, setList] = useState<Stored[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const selected = list?.find((t) => t.id === selectedId) ?? null;
  const dirty = !!value && !!selected && !same(value, selected);
  const emit = useCallback((t: Template, id: string | null) => { setSelectedId(id); onChange(t, { templateId: id }); }, [onChange]);

  const load = useCallback(async () => {
    const r = await fetch(`/api/templates?module=${module}`);
    if (!r.ok) throw new Error(String(r.status));
    return ((await r.json()) as { templates: Stored[] }).templates;
  }, [module]);

  useEffect(() => {
    let alive = true;
    load().then(
      (t) => {
        if (!alive) return;
        setList(t);
        if (!value && t[0]) emit({ sections: t[0].sections, format: t[0].format }, t[0].id);
        else if (value) setSelectedId(t.find((x) => same(x, value))?.id ?? null);
      },
      () => alive && toast.error("Não foi possível carregar os modelos de seções."),
    );
    return () => { alive = false; };
    // carrega uma vez por módulo; `value` e `emit` só importam na primeira carga
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [module]);

  const draft = value;
  const edit = (next: Template) => emit(next, null);
  const setSection = (i: number, patch: Partial<Template["sections"][number]>) =>
    draft && edit({ ...draft, sections: draft.sections.map((s, k) => (k === i ? { ...s, ...patch } : s)) });
  const move = (i: number, d: -1 | 1) => {
    if (!draft) return;
    const sections = [...draft.sections];
    [sections[i], sections[i + d]] = [sections[i + d], sections[i]];
    edit({ ...draft, sections });
  };

  async function save() {
    if (!draft) return;
    const check = TemplateSchema.safeParse(draft);
    if (!check.success) return void toast.error(check.error.issues[0]?.message ?? "Modelo inválido");
    setBusy(true);
    try {
      const r = await fetch("/api/templates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ module, name, ...check.data }) });
      const j = await r.json();
      if (!r.ok) return void toast.error(j.error ?? "Não foi possível salvar.");
      toast.success("Modelo salvo", { description: j.template.name });
      setList(await load());
      setName("");
      emit({ sections: j.template.sections, format: j.template.format }, j.template.id);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!selected || selected.system) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/templates/${selected.id}`, { method: "DELETE" });
      if (!r.ok) return void toast.error("Não foi possível excluir.");
      toast.success("Modelo excluído", { description: selected.name });
      const t = await load();
      setList(t);
      setConfirmDelete(false);
      if (t[0]) emit({ sections: t[0].sections, format: t[0].format }, t[0].id);
    } finally {
      setBusy(false);
    }
  }

  const must = MANDATORY[module];
  const missingMust = !!draft && !draft.sections.some((s) => normTitle(s.title) === normTitle(must.title));
  const title = selected ? `${selected.name}${dirty ? " (editado)" : ""}` : draft ? "Modelo personalizado" : "Carregando…";

  const body = !draft || !list ? (
    <p className="text-sm text-text-secondary">Carregando modelos…</p>
  ) : (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-text-secondary">
          Modelo
          <Select value={selectedId ?? ""} onValueChange={(id) => { const t = list.find((x) => x.id === id); if (t) { setConfirmDelete(false); emit({ sections: t.sections, format: t.format }, t.id); } }} items={list.map((t) => ({ value: t.id, label: t.name }))}>
            <SelectTrigger aria-label="Modelo de seções" className="min-w-56">
              <SelectValue>{() => selected?.name ?? <span className="text-text-secondary">Modelo personalizado</span>}</SelectValue>
            </SelectTrigger>
            <SelectContent className="w-auto min-w-72">
              {list.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  <span className="flex w-full items-center justify-between gap-6">
                    {t.name}
                    <span className="text-xs text-text-muted">{t.system ? "do sistema" : "meu"}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        {selected && !selected.system &&
          (confirmDelete ? (
            <Button type="button" size="sm" variant="destructive" disabled={busy} onClick={remove}>Confirmar exclusão</Button>
          ) : (
            <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => setConfirmDelete(true)}>
              <Trash2Icon data-icon="inline-start" /> Excluir este modelo
            </Button>
          ))}
      </div>

      <ol className="space-y-2" aria-label="Seções">
        {draft.sections.map((s, i) => (
          <li key={i} className="flex flex-wrap items-start gap-2 rounded-lg border border-border bg-surface p-2">
            <span className="mt-2 w-5 shrink-0 text-center text-xs text-text-muted">{i + 1}</span>
            <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
              <Input aria-label={`Título da seção ${i + 1}`} value={s.title} maxLength={80} placeholder="Título da seção" onChange={(e) => setSection(i, { title: e.target.value })} />
              <Input aria-label={`Instrução da seção ${i + 1}`} value={s.instructions ?? ""} maxLength={300} placeholder="Instrução (opcional)" onChange={(e) => setSection(i, { instructions: e.target.value })} />
            </div>
            <div className="flex shrink-0 gap-1">
              <Button type="button" size="icon-sm" variant="ghost" aria-label={`Subir seção ${i + 1}`} disabled={i === 0} onClick={() => move(i, -1)}><ArrowUpIcon /></Button>
              <Button type="button" size="icon-sm" variant="ghost" aria-label={`Descer seção ${i + 1}`} disabled={i === draft.sections.length - 1} onClick={() => move(i, 1)}><ArrowDownIcon /></Button>
              <Button type="button" size="icon-sm" variant="ghost" aria-label={`Remover seção ${i + 1}`} disabled={draft.sections.length === 1} onClick={() => edit({ ...draft, sections: draft.sections.filter((_, k) => k !== i) })}><Trash2Icon /></Button>
            </div>
          </li>
        ))}
        {missingMust && (
          <li className="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-text-secondary">
            <strong className="font-medium text-text-primary">{must.title}</strong>: obrigatória, é acrescentada ao final automaticamente (rastreabilidade das fontes).
          </li>
        )}
      </ol>
      <Button type="button" size="sm" variant="outline" disabled={draft.sections.length >= MAX_SECTIONS} onClick={() => edit({ ...draft, sections: [...draft.sections, { title: "" }] })}>
        <PlusIcon data-icon="inline-start" /> Adicionar seção
      </Button>

      <div className="flex flex-wrap items-end gap-3 border-t border-border pt-4">
        {formatFields.includes("tone") && <Option label="Tom" value={draft.format.tone} options={TONES} onChange={(tone) => edit({ ...draft, format: { ...draft.format, tone } })} />}
        {formatFields.includes("length") && <Option label="Tamanho" value={draft.format.length} options={LENGTHS} onChange={(length) => edit({ ...draft, format: { ...draft.format, length } })} />}
        {formatFields.includes("detail") && <Option label="Nível de detalhe" value={draft.format.detail} options={DETAILS} onChange={(detail) => edit({ ...draft, format: { ...draft.format, detail } })} />}
        {formatFields.includes("citations") && <Option label="Citações no texto" value={draft.format.citations ? "sim" : "nao"} options={{ sim: "Sim", nao: "Não" }} onChange={(v) => edit({ ...draft, format: { ...draft.format, citations: v === "sim" } })} />}
      </div>

      {(dirty || !selected) && (
        <form className="flex flex-wrap items-end gap-2 border-t border-border pt-4" onSubmit={(e) => { e.preventDefault(); void save(); }}>
          <label className="flex min-w-56 flex-1 flex-col gap-1 text-xs text-text-secondary">
            Nome do modelo
            <Input value={name} maxLength={80} placeholder="Ex.: Impactos para RH" onChange={(e) => setName(e.target.value)} />
          </label>
          <Button type="submit" size="sm" disabled={busy || !name.trim()}>Salvar como meu modelo</Button>
        </form>
      )}
    </div>
  );

  if (!collapsible) return <div className={className}>{body}</div>;
  return (
    <details open={defaultOpen || undefined} className={cn("group rounded-xl border border-border bg-surface-raised/40 p-4", className)}>
      <summary className="cursor-pointer select-none text-sm font-medium">
        Formato do relatório <span className="font-normal text-text-secondary">· {title}</span>
      </summary>
      <div className="mt-4">{body}</div>
    </details>
  );
}
