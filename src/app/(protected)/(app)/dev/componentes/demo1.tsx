"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useMemo, useState } from "react";
import { AnalysisResults } from "@/components/documentos/AnalysisResults";
import { AnalysisSidebar } from "@/components/documentos/AnalysisSidebar";
import { BriefPanel } from "@/components/documentos/BriefPanel";
import { PageViewerDialog, type PageTarget } from "@/components/documentos/PageViewerDialog";
import { SummaryControls, type SummaryOptions } from "@/components/documentos/SummaryControls";
import { SummaryEditor, type SummaryValue } from "@/components/documentos/SummaryEditor";
import { Button } from "@/components/ui/button";
import { checkAnalysis, type PageIn } from "@/lib/documentos/analysis";
import { briefToSections, checkBrief, methodologyFacts } from "@/lib/documentos/brief";
import type { AnalysisMessage } from "@/lib/documentos/analyze";
import type { BriefMessage } from "@/lib/documentos/brief-run";
import type { SummaryMessage } from "@/lib/documentos/summary-run";
import { analysisFromChecked, analysisFromPartial, briefFromChecked, briefFromPartial, type AnalysisView, type BriefView } from "@/lib/documentos/views";
import type { Template } from "@/lib/templates";

// Contrato SINTÉTICO de exemplo (nenhum dado real).
const PAGES: PageIn[] = [
  { number: 1, content: "CONTRATO Nº 055/2026. CLÁUSULA PRIMEIRA – DO OBJETO. Prestação de serviços de sustentação do sistema de gestão documental da CONTRATANTE, conforme o Termo de Referência." },
  { number: 2, content: "CLÁUSULA SEGUNDA – DA VIGÊNCIA. O prazo de vigência é de 12 meses, prorrogável por até 60 meses. CLÁUSULA TERCEIRA – DO PREÇO. O valor global é de R$ 1.250.000,00, reajustado pelo IPCA." },
  { number: 3, content: "CLÁUSULA QUARTA – DO NÍVEL DE SERVIÇO (SLA). A CONTRATADA garantirá disponibilidade mensal de 99,5% e atendimento de incidentes críticos em até 2 horas, sob pena de glosa de 1% a 10% da fatura mensal." },
  { number: 4, content: "CLÁUSULA QUINTA – DAS PENALIDADES. Multa de 0,5% ao dia sobre a parcela em atraso, limitada a 10%; multa compensatória de 20% em caso de inexecução total." },
  { number: 5, content: "CLÁUSULA SEXTA – DA RESCISÃO. O contrato poderá ser rescindido por inadimplemento ou interesse público, com aviso prévio de 30 dias. CLÁUSULA SÉTIMA – DA GARANTIA. Garantia de 5% do valor do contrato, em seguro-garantia, a ser apresentada em 10 dias." },
];
const KEYWORDS = ["SLA", "multa", "rescisão", "garantia"];

const MOCK_ANALYSIS = checkAnalysis(
  {
    relevanceBySection: [
      { title: "Cláusula Quarta – Do Nível de Serviço (SLA)", score: 96, pageRef: 1, snippet: "disponibilidade mensal de 99,5% e atendimento de incidentes críticos em até 2 horas" },
      { title: "Cláusula Quinta – Das Penalidades", score: 92, pageRef: 4, snippet: "Multa de 0,5% ao dia sobre a parcela em atraso, limitada a 10%" },
      { title: "Cláusula Sexta – Da Rescisão", score: 74, pageRef: 5, snippet: "rescindido por inadimplemento ou interesse público, com aviso prévio de 30 dias" },
      { title: "Cláusula Sétima – Da Garantia", score: 48, pageRef: 5, snippet: "Garantia de 5% do valor do contrato, em seguro-garantia" },
      { title: "Cláusula Segunda – Da Vigência", score: 22, pageRef: 2, snippet: "prazo de vigência é de 12 meses, prorrogável por até 60 meses" },
      { title: "Cláusula Inventada – Do Foro", score: 12, pageRef: 5, snippet: "fica eleito o foro de Brasília para dirimir qualquer questão" },
    ],
    taxonomy: ["Nível de serviço (SLA)", "Penalidades e multas", "Rescisão contratual", "Garantia contratual"],
    keywordMatches: [
      { keyword: "SLA", occurrences: [{ context: "disponibilidade mensal de 99,5% e atendimento de incidentes críticos", page: 3 }, { context: "sob pena de glosa de 1% a 10% da fatura mensal", page: 3 }] },
      { keyword: "multa", occurrences: [{ context: "Multa de 0,5% ao dia sobre a parcela em atraso", page: 4 }] },
      { keyword: "rescisão", occurrences: [{ context: "O contrato poderá ser rescindido por inadimplemento", page: 5 }] },
      { keyword: "garantia", occurrences: [{ context: "Garantia de 5% do valor do contrato", page: 5 }] },
    ],
    summary: "Contrato de sustentação de sistema de gestão documental, com SLA de 99,5%, multas moratória e compensatória, rescisão com aviso prévio de 30 dias e garantia de 5%.",
    suggestions: ["Definir como a disponibilidade será medida e a faixa de glosa entre 1% e 10%.", "Esclarecer se glosa e multas podem ser cumuladas."],
  },
  PAGES,
  KEYWORDS,
);
const MOCK_BRIEF = checkBrief(
  {
    objetoAnalise: "Parecer técnico sobre o Contrato nº 055/2026, de **sustentação do sistema de gestão documental**.",
    metodologia: "Leitura integral do documento e localização das cláusulas ligadas às palavras-chave.",
    achadosPrincipais: [
      { keyword: "SLA", finding: "Disponibilidade mensal de 99,5% e atendimento de incidentes críticos em até 2 horas.", pageRef: 3, quote: "disponibilidade mensal de 99,5% e atendimento de incidentes críticos em até 2 horas" },
      { keyword: "multa", finding: "Multa moratória de 0,5% ao dia, limitada a 10%, e compensatória de 20%.", pageRef: 2, quote: "Multa de 0,5% ao dia sobre a parcela em atraso, limitada a 10%" },
      { keyword: "rescisão", finding: "Rescisão por inadimplemento ou interesse público, com aviso prévio de 30 dias.", pageRef: 5, quote: "com aviso prévio de 30 dias" },
      { keyword: "garantia", finding: "Garantia de 5% em seguro-garantia.", pageRef: 5, quote: "esta frase o modelo inventou sobre a garantia" },
    ],
    analiseRiscos: [
      { risk: "A glosa de 1% a 10% não tem critério de gradação.", severity: "media", pageRef: 3, quote: "glosa de 1% a 10% da fatura mensal" },
      { risk: "A garantia de 5% é menor que a multa compensatória de 20%.", severity: "alta", pageRef: 5, quote: "Garantia de 5% do valor do contrato" },
    ],
    conclusao: "O contrato traz as cláusulas essenciais, com lacunas em medição do SLA e gradação da glosa.",
    recomendacoes: ["Incluir critérios objetivos de medição do SLA.", "Avaliar a elevação da garantia."],
  },
  PAGES,
  KEYWORDS,
);
const MOCK_FACTS = methodologyFacts({ filename: "contrato-055-2026.pdf", pages: PAGES.length, keywords: KEYWORDS, modelLabel: "Claude Opus 5.5", partial: false, date: "26/10/2026" });

function lastPart<T>(messages: { role: string; parts: { type: string }[] }[], type: string): T | undefined {
  const m = messages.filter((x) => x.role === "assistant").at(-1);
  return (m?.parts.find((p) => p.type === type) as { data: T } | undefined)?.data;
}

export function Demo1() {
  const [live, setLive] = useState<{ analysis?: AnalysisView; brief?: BriefView }>({});
  const [active, setActive] = useState<number | null>(null);
  const [target, setTarget] = useState<PageTarget | null>(null);
  const [summaryOpts, setSummaryOpts] = useState<SummaryOptions>({ size: "curto", audience: "tecnico" });
  const [template, setTemplate] = useState<Template | null>(null);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [edited, setEdited] = useState<SummaryValue | null>(null);

  const analysisChat = useChat<AnalysisMessage>({ transport: useMemo(() => new DefaultChatTransport({ api: "/api/documentos/analyze" }), []) });
  const briefChat = useChat<BriefMessage>({ transport: useMemo(() => new DefaultChatTransport({ api: "/api/documentos/generate-brief" }), []) });
  const summaryChat = useChat<SummaryMessage>({ transport: useMemo(() => new DefaultChatTransport({ api: "/api/documentos/summary" }), []) });

  const aPart = lastPart<{ phase: string; analysis: never }>(analysisChat.messages, "data-analysis");
  const analysisView: AnalysisView = aPart ? (aPart.phase === "final" ? analysisFromChecked(aPart.analysis) : analysisFromPartial(aPart.analysis)) : (live.analysis ?? analysisFromChecked(MOCK_ANALYSIS));
  const bPart = lastPart<{ phase: string; brief: never; sections?: { heading: string; content: string }[] }>(briefChat.messages, "data-brief");
  const briefView: BriefView = bPart ? (bPart.phase === "final" ? briefFromChecked(bPart.brief, bPart.sections) : briefFromPartial(bPart.brief)) : (live.brief ?? briefFromChecked(MOCK_BRIEF, briefToSections(MOCK_BRIEF, MOCK_FACTS)));
  const sPart = lastPart<{ phase: string; summary?: string; sections?: { heading?: string; title?: string; content?: string }[] }>(summaryChat.messages, "data-summary");
  const generated: SummaryValue | null = sPart?.phase === "final" ? { summary: sPart.summary, sections: sPart.sections?.map((s) => ({ heading: s.heading ?? s.title ?? "", content: s.content ?? "" })) } : null;
  const summaryBusy = summaryChat.status === "submitted" || summaryChat.status === "streaming";

  const body = { pages: PAGES, keywords: KEYWORDS, filename: "contrato-055-2026.pdf", modelId: "anthropic:claude-haiku-5-5" };
  const openPage = (page: number, quote: string) => setTarget({ page, quote });
  const select = (i: number) => {
    setActive(i);
    document.getElementById(`analysis-section-${i}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <div className="space-y-12">
      <section className="space-y-3" data-testid="demo1-analysis">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">AnalysisSidebar + AnalysisResults</h2>
          <Button size="sm" variant="outline" disabled={analysisChat.status === "streaming"} onClick={() => analysisChat.sendMessage({ text: "analisar" }, { body: { ...body, index: false } })}>Analisar de verdade (Haiku)</Button>
          <Button size="sm" variant="ghost" onClick={() => { analysisChat.setMessages([]); setLive({}); }}>Voltar ao exemplo</Button>
        </div>
        <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <AnalysisSidebar sections={analysisView.sections} activeIndex={active} onSelect={select} />
          <AnalysisResults view={analysisView} keywords={KEYWORDS} activeIndex={active} onOpenPage={openPage} />
        </div>
      </section>

      <section className="space-y-3" data-testid="demo1-brief">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">BriefPanel</h2>
          <Button size="sm" variant="outline" disabled={briefChat.status === "streaming"} onClick={() => briefChat.sendMessage({ text: "parecer" }, { body: { ...body, analysis: undefined } })}>Gerar parecer de verdade (Haiku)</Button>
          <Button size="sm" variant="ghost" onClick={() => briefChat.setMessages([])}>Voltar ao exemplo</Button>
        </div>
        <BriefPanel view={briefView} onOpenPage={openPage} />
      </section>

      <section className="space-y-3" data-testid="demo1-summary">
        <h2 className="text-lg font-semibold">SummaryControls + SummaryEditor</h2>
        <SummaryControls
          value={summaryOpts}
          onChange={setSummaryOpts}
          template={template}
          onTemplateChange={(t, m) => { setTemplate(t); setTemplateId(m.templateId); }}
          busy={summaryBusy}
          onRegenerate={() => { setEdited(null); void summaryChat.sendMessage({ text: "resumo" }, { body: { ...body, modelId: undefined, summary: summaryOpts, ...(templateId ? { templateId } : template && !templateId ? { template } : {}) } }); }}
        />
        {summaryChat.error && <p className="text-sm text-destructive" data-testid="summary-error">{summaryChat.error.message}</p>}
        {(generated || edited) && <SummaryEditor value={edited ?? generated!} original={generated ?? undefined} onChange={setEdited} streaming={summaryBusy} />}
        <code data-testid="summary-state" className="block text-xs text-text-secondary">{JSON.stringify({ opts: summaryOpts, status: summaryChat.status, templateId })}</code>
      </section>

      <PageViewerDialog pages={PAGES} target={target} keywords={KEYWORDS} onNavigate={(p) => setTarget((t) => (t ? { page: p, quote: undefined } : t))} onClose={() => setTarget(null)} />
    </div>
  );
}
