"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { AlertTriangleIcon, ChevronDownIcon, FileSearchIcon, FileTextIcon, MessageSquareTextIcon, RefreshCwIcon, SparklesIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExportButtons } from "@/components/shared/ExportButtons";
import { ModelSelector } from "@/components/shared/ModelSelector";
import { StepTimeline } from "@/components/shared/StepTimeline";
import type { AnalysisMessage, AnalysisPart } from "@/lib/documentos/analyze";
import type { BriefMessage, BriefPart } from "@/lib/documentos/brief-run";
import type { SummaryMessage, SummaryPart } from "@/lib/documentos/summary-run";
import type { PdfResult } from "@/lib/documentos/upload-client";
import { analysisFromChecked, analysisFromPartial, briefFromChecked, briefFromPartial } from "@/lib/documentos/views";
import { buildExportData, phaseOf, type ApiError, type SummaryValue } from "@/lib/documentos/workspace";
import type { Template } from "@/lib/templates";
import { useStreamedPart } from "@/lib/use-streamed-part";
import { cn } from "@/lib/utils";
import { AnalysisResults } from "./AnalysisResults";
import { AnalysisSidebar } from "./AnalysisSidebar";
import { BriefPanel } from "./BriefPanel";
import { KeywordInput } from "./KeywordInput";
import { PageViewerDialog, type PageTarget } from "./PageViewerDialog";
import { PDFUploadZone } from "./PDFUploadZone";
import { SummaryControls, type SummaryOptions } from "./SummaryControls";
import { SummaryEditor } from "./SummaryEditor";

type Tab = "analise" | "resumo" | "parecer";

function ErrorNote({ error, onRetry }: { error: ApiError; onRetry?: () => void }) {
  return (
    <div role="alert" data-testid="workspace-error" className="flex flex-wrap items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/8 px-4 py-3 text-sm text-destructive">
      <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
      <span className="min-w-0 flex-1">{error.message}</span>
      {onRetry && error.code !== "budget_user" && error.code !== "budget_module" && error.code !== "budget_global" && (
        <Button type="button" size="sm" variant="outline" onClick={onRetry}>
          <RefreshCwIcon data-icon="inline-start" /> Tentar de novo
        </Button>
      )}
    </div>
  );
}

function EmptyState({ hasPdf }: { hasPdf: boolean }) {
  const steps = [
    { n: 1, t: "Envie o PDF", d: "Digital ou escaneado. O digital é lido no seu navegador." },
    { n: 2, t: "Defina as palavras-chave", d: "Digite os termos que importam ou aceite as sugestões do documento." },
    { n: 3, t: "Analise e gere o parecer", d: "Relevância por seção, trechos com página e um parecer técnico em 5 seções." },
  ];
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-6 py-12 text-center" data-testid="workspace-empty">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-accent-docs/12 text-accent-docs">
        <FileSearchIcon className="size-7" />
      </span>
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Análise de Documentos</h1>
        <p className="text-text-secondary">{hasPdf ? "Documento pronto. Confira as palavras-chave e clique em Analisar documento." : "Envie um contrato, norma ou relatório e obtenha uma análise com páginas e trechos conferidos."}</p>
      </div>
      <ol className="w-full space-y-3 text-left">
        {steps.map((s) => (
          <li key={s.n} className="flex gap-3 rounded-xl border border-border bg-surface p-3">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-docs/15 text-xs font-bold text-accent-docs">{s.n}</span>
            <span>
              <span className="block text-sm font-medium text-text-primary">{s.t}</span>
              <span className="block text-xs text-text-secondary">{s.d}</span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/**
 * Página /documentos (itens 111 a 117): painel lateral (PDF, palavras-chave, modelo, exportação) e área principal com
 * Análise, Resumo e Parecer. As três chamadas de IA são independentes: o resumo e o parecer reaproveitam a análise
 * já conferida, em vez de repeti-la.
 */
export function DocumentosWorkspace() {
  const [pdf, setPdf] = useState<PdfResult | null>(null);
  const [zoneKey, setZoneKey] = useState(0);
  const [extracting, setExtracting] = useState(false);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [modelId, setModelId] = useState("");
  const [index, setIndex] = useState(true);
  const [tab, setTab] = useState<Tab>("analise");
  const [active, setActive] = useState<number | null>(null);
  const [target, setTarget] = useState<PageTarget | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [summaryOpts, setSummaryOpts] = useState<SummaryOptions>({ size: "medio", audience: "tecnico" });
  const [template, setTemplate] = useState<Template | null>(null);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [edited, setEdited] = useState<SummaryValue | null>(null);

  const analysis = useStreamedPart<AnalysisMessage, AnalysisPart>("/api/documentos/analyze", "data-analysis");
  const brief = useStreamedPart<BriefMessage, BriefPart>("/api/documentos/generate-brief", "data-brief");
  const summary = useStreamedPart<SummaryMessage, SummaryPart>("/api/documentos/summary", "data-summary");
  const { reset: resetAnalysis } = analysis;
  const { reset: resetBrief } = brief;
  const { reset: resetSummary } = summary;

  const finalAnalysis = analysis.part?.phase === "final" ? analysis.part : null;
  const finalBrief = brief.part?.phase === "final" ? brief.part : null;
  const finalSummary = summary.part?.phase === "final" ? summary.part : null;
  const modelOpt = modelId || undefined;

  // resumo mostrado: o que a pessoa editou > o regenerado > o que veio da própria análise
  const original: SummaryValue | null = finalSummary
    ? { summary: finalSummary.summary, sections: finalSummary.sections }
    : finalAnalysis
      ? { summary: finalAnalysis.analysis.summary }
      : null;
  const streamingSummary: SummaryValue | null =
    summary.busy && summary.part?.phase === "partial"
      ? { summary: summary.part.summary, sections: summary.part.sections?.map((s) => ({ heading: s.title ?? "", content: s.content ?? "" })) }
      : null;
  const shownSummary = streamingSummary ?? edited ?? original;

  const clearResults = useCallback(() => {
    resetAnalysis();
    resetBrief();
    resetSummary();
    setEdited(null);
    setTab("analise");
    setActive(null);
  }, [resetAnalysis, resetBrief, resetSummary]);

  const onPdf = useCallback(
    (r: PdfResult | null) => {
      setPdf(r);
      clearResults();
    },
    [clearResults],
  );

  const pages = pdf?.doc.pages.map((p) => ({ number: p.number, content: p.content }));
  const phase = phaseOf({
    extracting,
    hasPdf: !!pdf,
    analyzing: analysis.busy,
    hasAnalysis: !!finalAnalysis,
    briefing: brief.busy,
    hasBrief: !!finalBrief,
    failed: !!analysis.error && !finalAnalysis,
  });

  function analyze() {
    if (!pdf || !pages) return;
    setPanelOpen(false);
    setTab("analise");
    resetBrief();
    resetSummary();
    setEdited(null);
    setActive(null);
    void analysis.run({ pages, keywords, filename: pdf.file.name, modelId: modelOpt, index });
  }
  function makeBrief() {
    if (!pdf || !pages || !finalAnalysis) return;
    setTab("parecer");
    void brief.run({ pages, keywords, filename: pdf.file.name, modelId: modelOpt, analysis: finalAnalysis.analysis });
  }
  function regenerate() {
    if (!pdf || !pages || !finalAnalysis) return;
    setEdited(null);
    void summary.run({
      pages,
      keywords,
      filename: pdf.file.name,
      modelId: modelOpt,
      analysis: finalAnalysis.analysis,
      summary: summaryOpts,
      ...(templateId ? { templateId } : template ? { template } : {}),
    });
  }
  function startOver() {
    setPdf(null);
    clearResults();
    setZoneKey((k) => k + 1);
    setPanelOpen(true);
  }
  const select = (i: number) => {
    setActive(i);
    document.getElementById(`analysis-section-${i}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const analysisView = analysis.part ? (analysis.part.phase === "final" ? analysisFromChecked(analysis.part.analysis) : analysisFromPartial(analysis.part.analysis)) : null;
  const briefView = brief.part ? (brief.part.phase === "final" ? briefFromChecked(brief.part.brief, brief.part.sections) : briefFromPartial(brief.part.brief)) : null;
  const working = analysis.busy || brief.busy || summary.busy;
  const canAnalyze = !!pdf && !extracting && !working;

  return (
    <div className="flex flex-1 flex-col lg:flex-row" data-testid="documentos-workspace" data-phase={phase}>
      <aside className="border-b border-border lg:sticky lg:top-14 lg:h-[calc(100vh-3.5rem)] lg:w-80 lg:shrink-0 lg:overflow-y-auto lg:border-r lg:border-b-0">
        <button
          type="button"
          onClick={() => setPanelOpen((o) => !o)}
          aria-expanded={panelOpen}
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium lg:hidden"
        >
          <span className="min-w-0 truncate">{pdf ? pdf.file.name : "Documento e opções"}</span>
          <ChevronDownIcon className={cn("size-4 shrink-0 transition-transform", panelOpen && "rotate-180")} />
        </button>
        <div className={cn("space-y-6 p-4", !panelOpen && "hidden lg:block")}>
          <PDFUploadZone key={zoneKey} onChange={onPdf} onBusyChange={setExtracting} disabled={working} />

          <div className="space-y-2">
            <h2 className="text-sm font-semibold">Palavras-chave</h2>
            <KeywordInput value={keywords} onChange={setKeywords} documentText={pdf?.doc.text ?? null} filename={pdf?.file.name} disabled={working} />
          </div>

          <div className="space-y-2">
            <h2 className="text-sm font-semibold">Modelo de IA</h2>
            <ModelSelector value={modelId} onChange={setModelId} disabled={working} className="w-full" />
          </div>

          <label className="flex cursor-pointer items-start gap-2 text-xs leading-relaxed text-text-secondary">
            <input type="checkbox" checked={index} onChange={(e) => setIndex(e.target.checked)} disabled={working} className="mt-0.5 size-4 shrink-0 accent-[var(--accent-docs)]" />
            <span>Permitir perguntas sobre este documento no chat (o texto fica guardado no sistema).</span>
          </label>

          {analysis.busy ? (
            <Button type="button" variant="outline" className="w-full" onClick={analysis.stop}>
              <XIcon data-icon="inline-start" /> Cancelar análise
            </Button>
          ) : (
            <Button type="button" className="w-full" disabled={!canAnalyze} onClick={analyze} data-testid="analyze-button">
              <SparklesIcon data-icon="inline-start" />
              {finalAnalysis ? "Analisar de novo" : "Analisar documento"}
            </Button>
          )}

          <div className="space-y-2 border-t border-border pt-5">
            <h2 className="text-sm font-semibold">Exportar</h2>
            <ExportButtons
              module="demo1"
              disabled={!finalAnalysis || working}
              getData={() =>
                buildExportData({
                  filename: pdf!.file.name,
                  pages: pdf!.doc.pages,
                  keywords,
                  analysis: finalAnalysis?.analysis,
                  summary: edited ?? original,
                  brief: finalBrief ? { brief: finalBrief.brief, sections: finalBrief.sections } : null,
                  date: new Date().toLocaleDateString("pt-BR"),
                })
              }
            />
            {!finalAnalysis && <p className="text-xs text-text-muted">Disponível depois da análise.</p>}
          </div>

          {pdf && (
            <Button type="button" variant="ghost" size="sm" className="w-full" disabled={working} onClick={startOver}>
              Começar de novo com outro documento
            </Button>
          )}
        </div>
      </aside>

      <main className="min-w-0 flex-1 p-4 lg:p-8">
        {!analysis.part && !analysis.busy && !analysis.error ? (
          <EmptyState hasPdf={!!pdf} />
        ) : (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <FileTextIcon className="size-5 shrink-0 text-accent-docs" />
                <h1 className="truncate text-lg font-semibold" title={pdf?.file.name}>{pdf?.file.name ?? "Documento"}</h1>
              </div>
              {finalAnalysis?.sourceId && (
                <Link href={`/chat?source=${finalAnalysis.sourceId}`} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium hover:bg-surface-raised" data-testid="ask-chat">
                  <MessageSquareTextIcon className="size-4" /> Perguntar sobre este documento
                </Link>
              )}
              {finalBrief && !brief.busy && (
                <Button type="button" size="sm" variant="outline" onClick={makeBrief}>
                  <RefreshCwIcon data-icon="inline-start" /> Gerar o parecer de novo
                </Button>
              )}
              {finalAnalysis && !finalBrief && !brief.busy && (
                <Button type="button" size="sm" onClick={makeBrief} data-testid="brief-button">
                  <FileTextIcon data-icon="inline-start" /> Gerar parecer técnico
                </Button>
              )}
            </div>

            {analysis.busy && analysis.steps.length > 0 && <StepTimeline steps={analysis.steps} renderExtra={(s) => (s.id === "map" && typeof s.total === "number" ? <span className="text-xs text-text-muted">{String(s.done)} de {String(s.total)}</span> : null)} className="rounded-xl border border-border bg-surface p-4" />}
            {analysis.error && <ErrorNote error={analysis.error} onRetry={analyze} />}

            {analysisView && (
              <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
                <TabsList>
                  <TabsTrigger value="analise">Análise</TabsTrigger>
                  <TabsTrigger value="resumo" disabled={!finalAnalysis}>Resumo</TabsTrigger>
                  <TabsTrigger value="parecer" disabled={!finalAnalysis}>Parecer</TabsTrigger>
                </TabsList>

                <TabsContent value="analise">
                  <div className="grid gap-6 pt-4 lg:grid-cols-[17rem_minmax(0,1fr)]">
                    <AnalysisSidebar sections={analysisView.sections} activeIndex={active} onSelect={select} className="lg:sticky lg:top-20 lg:max-h-[calc(100vh-7rem)] lg:self-start lg:overflow-y-auto" />
                    <AnalysisResults view={analysisView} keywords={keywords} activeIndex={active} onOpenPage={(page, quote) => setTarget({ page, quote })} />
                  </div>
                </TabsContent>

                <TabsContent value="resumo">
                  <div className="space-y-4 pt-4">
                    <SummaryControls value={summaryOpts} onChange={setSummaryOpts} onRegenerate={regenerate} template={template} onTemplateChange={(t, m) => { setTemplate(t); setTemplateId(m.templateId); }} busy={summary.busy} disabled={analysis.busy || brief.busy} />
                    {summary.busy && summary.steps.length > 0 && <StepTimeline steps={summary.steps} />}
                    {summary.error && <ErrorNote error={summary.error} onRetry={regenerate} />}
                    {shownSummary && <SummaryEditor value={shownSummary} original={original ?? undefined} onChange={setEdited} streaming={summary.busy} />}
                  </div>
                </TabsContent>

                <TabsContent value="parecer">
                  <div className="space-y-4 pt-4">
                    {brief.busy && brief.steps.length > 0 && <StepTimeline steps={brief.steps} renderExtra={(s) => (s.id === "verify" && typeof s.total === "number" ? <span className="text-xs text-text-muted">{String(s.verified)} de {String(s.total)} conferidas</span> : null)} className="rounded-xl border border-border bg-surface p-4" />}
                    {brief.error && <ErrorNote error={brief.error} onRetry={makeBrief} />}
                    {briefView ? (
                      <BriefPanel view={briefView} onOpenPage={(page, quote) => setTarget({ page, quote })} />
                    ) : (
                      !brief.busy && (
                        <div className="mx-auto max-w-md space-y-4 py-10 text-center">
                          <p className="text-sm text-text-secondary">O parecer técnico tem 5 seções, e cada achado traz a página e o trecho do documento. Leva cerca de 20 segundos.</p>
                          <Button type="button" onClick={makeBrief} disabled={!finalAnalysis || working}>
                            <FileTextIcon data-icon="inline-start" /> Gerar parecer técnico
                          </Button>
                        </div>
                      )
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            )}
          </div>
        )}
      </main>

      <PageViewerDialog pages={pdf?.doc.pages ?? []} target={target} keywords={keywords} onNavigate={(p) => setTarget({ page: p })} onClose={() => setTarget(null)} />
    </div>
  );
}
