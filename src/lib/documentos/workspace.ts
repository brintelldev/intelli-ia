import type { ExportData } from "@/lib/export/types";
import type { CheckedAnalysis, PageIn } from "./analysis";
import type { CheckedBrief } from "./brief";

// Lógica pura da página /documentos: em que fase ela está, que mensagem mostrar quando uma chamada falha e como as
// peças (resumo, análise e parecer) viram o documento exportado.

export type Phase = "idle" | "extracting" | "ready" | "analyzing" | "analyzed" | "briefing" | "done" | "error";

export function phaseOf(s: { extracting: boolean; hasPdf: boolean; analyzing: boolean; hasAnalysis: boolean; briefing: boolean; hasBrief: boolean; failed: boolean }): Phase {
  if (s.failed) return "error";
  if (s.briefing) return "briefing";
  if (s.hasBrief) return "done";
  if (s.analyzing) return "analyzing";
  if (s.hasAnalysis) return "analyzed";
  if (s.extracting) return "extracting";
  return s.hasPdf ? "ready" : "idle";
}

export type ApiError = { message: string; code?: string; status?: number };

/**
 * Erro de uma chamada de stream → texto para a pessoa. Falha HTTP (400, 401, 403, 404, 429) chega com o CORPO da resposta
 * como mensagem (um JSON `{ error, code }`); falha no meio do stream chega com a mensagem genérica que o servidor escolheu.
 */
export function parseApiError(e: unknown): ApiError {
  const raw = e instanceof Error ? e.message : String(e ?? "");
  const status = typeof (e as { statusCode?: unknown })?.statusCode === "number" ? (e as { statusCode: number }).statusCode : undefined;
  try {
    const j = JSON.parse(raw) as { error?: unknown; code?: unknown };
    if (typeof j.error === "string") return { message: j.error, code: typeof j.code === "string" ? j.code : undefined, status };
  } catch {
    // não era JSON: é a mensagem direta
  }
  if (status === 401) return { message: "Sua sessão expirou. Entre de novo.", status };
  return { message: raw.trim() && raw.length < 300 ? raw : "Não foi possível concluir a operação. Tente novamente.", status };
}

export type SummaryValue = { summary?: string; sections?: { heading: string; content: string }[] };

const base = (name: string) => name.replace(/\.pdf$/i, "").trim() || "documento";
const pageList = (pages: number[]) => [...new Set(pages)].sort((a, b) => a - b).map((p) => `p. ${p}`).join(", ");

/**
 * O que a exportação leva. Com parecer: o parecer primeiro (é a entrega) e depois o resumo e a análise como anexo; sem
 * parecer: resumo e análise. O resumo é o texto EDITADO pela pessoa. `citations` são os trechos verificados do parecer
 * (ou, sem parecer, as ocorrências verificadas das palavras-chave), para a rastreabilidade no documento.
 */
export function buildExportData(i: {
  filename: string;
  pages: readonly PageIn[];
  keywords: readonly string[];
  analysis?: CheckedAnalysis | null;
  summary?: SummaryValue | null;
  brief?: { brief: CheckedBrief; sections: { heading: string; content: string }[] } | null;
  date: string;
}): ExportData {
  const a = i.analysis ?? null;
  const sections: ExportData["sections"] = [];

  if (i.brief) sections.push(...i.brief.sections);
  const annex = i.brief ? "Anexo — " : "";

  if (i.summary?.summary?.trim()) sections.push({ heading: `${annex}Resumo`, content: i.summary.summary.trim() });
  for (const s of i.summary?.sections ?? []) sections.push({ heading: i.brief ? `${annex}${s.heading}` : s.heading, content: s.content });

  if (a?.relevanceBySection.length) {
    sections.push({
      heading: `${annex}Relevância por seção`,
      content: a.relevanceBySection.map((s) => `- **${s.title}**: ${s.score}/100 (p. ${s.pageRef}${s.verified ? "" : ", trecho não localizado"})`).join("\n"),
    });
  }
  if (a?.keywordMatches.length) {
    sections.push({
      heading: `${annex}Palavras-chave`,
      content: a.keywordMatches
        .map((k) => `- **${k.keyword}**: ${k.count} ${k.count === 1 ? "ocorrência" : "ocorrências"}${k.count ? ` (${pageList(k.occurrences.filter((o) => o.verified).map((o) => o.page))})` : ""}`)
        .join("\n"),
    });
  }
  if (a?.suggestions.length) sections.push({ heading: `${annex}Pontos de atenção`, content: a.suggestions.map((s) => `- ${s}`).join("\n") });

  const fromBrief = i.brief?.brief.achadosPrincipais.filter((x) => x.verified && x.pageRef != null && x.quote).map((x) => ({ label: `${x.keyword} (p. ${x.pageRef}): “${x.quote}”` })) ?? [];
  const fromAnalysis = a?.keywordMatches.flatMap((k) => k.occurrences.filter((o) => o.verified).map((o) => ({ label: `${k.keyword} (p. ${o.page}): “${o.context}”` }))) ?? [];

  const rows: (string | number)[][] = [
    ...(a?.relevanceBySection.map((s): (string | number)[] => ["Seção", s.title, s.score, `p. ${s.pageRef}`]) ?? []),
    ...(a?.keywordMatches.map((k): (string | number)[] => ["Palavra-chave", k.keyword, k.count, pageList(k.occurrences.filter((o) => o.verified).map((o) => o.page))]) ?? []),
  ];

  return {
    title: `${i.brief ? "Parecer técnico" : "Análise"}: ${base(i.filename)}`,
    sections: sections.length ? sections : [{ heading: "Documento", content: "Ainda não há análise para exportar." }],
    metadata: {
      Arquivo: i.filename,
      Páginas: i.pages.length,
      "Palavras-chave": i.keywords.length ? i.keywords.join(", ") : "nenhuma",
      Data: i.date,
      Elaboração: "Análise assistida por IA, com conferência automática das páginas e dos trechos citados",
    },
    citations: (fromBrief.length ? fromBrief : fromAnalysis).slice(0, 30),
    table: rows.length ? { columns: ["Tipo", "Item", "Relevância / ocorrências", "Páginas"], rows } : undefined,
  };
}
