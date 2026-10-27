import type { DeepPartial } from "ai";
import type { CheckedAnalysis, RawAnalysis } from "./analysis";
import type { CheckedBrief, RawBrief } from "./brief";

// O que a tela mostra. Vem de duas fontes com formas diferentes: o objeto PARCIAL do stream (campos que podem faltar, sem
// conferência) e o FINAL já conferido (com `verified`). Os componentes só conhecem estas formas.

export type ScoreTone = "high" | "mid" | "low";
/** Barra verde acima de 70, amarela de 30 a 70, vermelha abaixo de 30. */
export const scoreTone = (score: number): ScoreTone => (score > 70 ? "high" : score >= 30 ? "mid" : "low");

export type SectionView = { title: string; score: number; pageRef?: number; snippet?: string; verified?: boolean };
export type KeywordView = { keyword: string; count?: number; occurrences: { context: string; page?: number; verified?: boolean }[] };
export type AnalysisView = { summary?: string; taxonomy: string[]; sections: SectionView[]; keywords: KeywordView[]; suggestions: string[]; complete: boolean };

const num = (n: unknown) => (typeof n === "number" && Number.isFinite(n) ? n : undefined);
const text = (s: unknown) => (typeof s === "string" ? s : undefined);
const strings = (xs: readonly (string | undefined)[] | undefined) => (xs ?? []).filter((x): x is string => typeof x === "string" && x.trim() !== "");

export function analysisFromChecked(a: CheckedAnalysis): AnalysisView {
  return {
    summary: a.summary,
    taxonomy: a.taxonomy,
    sections: a.relevanceBySection,
    keywords: a.keywordMatches.map((k) => ({ keyword: k.keyword, count: k.count, occurrences: k.occurrences })),
    suggestions: a.suggestions,
    complete: true,
  };
}

/** Objeto parcial do stream: só entram as seções que já têm título, e nota ainda não chegada vira 0 (a barra cresce quando chegar). */
export function analysisFromPartial(p: DeepPartial<RawAnalysis> | undefined): AnalysisView {
  return {
    summary: text(p?.summary),
    taxonomy: strings(p?.taxonomy),
    sections: (p?.relevanceBySection ?? []).flatMap((s) => (s && text(s.title) ? [{ title: s.title as string, score: Math.min(100, Math.max(0, num(s.score) ?? 0)), pageRef: num(s.pageRef), snippet: text(s.snippet) }] : [])),
    keywords: (p?.keywordMatches ?? []).flatMap((k) =>
      k && text(k.keyword)
        ? [{ keyword: k.keyword as string, occurrences: (k.occurrences ?? []).flatMap((o) => (o && text(o.context) ? [{ context: o.context as string, page: num(o.page) }] : [])) }]
        : [],
    ),
    suggestions: strings(p?.suggestions),
    complete: false,
  };
}

export type FindingView = { keyword: string; finding: string; pageRef: number | null; quote: string; verified?: boolean };
export type RiskView = { risk: string; severity?: "alta" | "media" | "baixa"; pageRef: number | null; quote: string; verified?: boolean };
export type BriefView = {
  objeto?: string;
  metodologia?: string;
  /** fatos objetivos da metodologia (arquivo, palavras-chave, modelo, data), que não vêm do modelo */
  facts?: string;
  achados: FindingView[];
  riscos: RiskView[];
  conclusao?: string;
  recomendacoes: string[];
  complete: boolean;
};

/** O `final` traz a Metodologia como `texto do modelo + fatos`; separa os dois para a tela mostrá-los em blocos distintos. */
export function briefFromChecked(b: CheckedBrief, sections?: { heading: string; content: string }[]): BriefView {
  const full = sections?.find((s) => s.heading === "Metodologia")?.content ?? b.metodologia;
  const facts = full.startsWith(b.metodologia) ? full.slice(b.metodologia.length).trim() : undefined;
  return { objeto: b.objetoAnalise, metodologia: b.metodologia, facts: facts || undefined, achados: b.achadosPrincipais, riscos: b.analiseRiscos, conclusao: b.conclusao, recomendacoes: b.recomendacoes, complete: true };
}

export function briefFromPartial(p: DeepPartial<RawBrief> | undefined): BriefView {
  const sev = (s: unknown) => (s === "alta" || s === "media" || s === "baixa" ? s : undefined);
  return {
    objeto: text(p?.objetoAnalise),
    metodologia: text(p?.metodologia),
    achados: (p?.achadosPrincipais ?? []).flatMap((a) => (a && text(a.finding) ? [{ keyword: text(a.keyword) ?? "", finding: a.finding as string, pageRef: num(a.pageRef) ?? null, quote: text(a.quote) ?? "" }] : [])),
    riscos: (p?.analiseRiscos ?? []).flatMap((r) => (r && text(r.risk) ? [{ risk: r.risk as string, severity: sev(r.severity), pageRef: num(r.pageRef) ?? null, quote: text(r.quote) ?? "" }] : [])),
    conclusao: text(p?.conclusao),
    recomendacoes: strings(p?.recomendacoes),
    complete: false,
  };
}
