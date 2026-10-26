import { assertPdf, MAX_PDF_BYTES } from "@/lib/upload";
import { extractPDF } from "@/lib/pdf/extract-client";
import type { ExtractedDocument } from "@/lib/pdf/types";

// Do arquivo escolhido ao texto pronto para a análise (Demo 1, item 111). Só no navegador. PDF digital: o texto sai
// da própria máquina (nenhum byte do arquivo vai ao servidor). Escaneado: o arquivo vai ao docling (OCR).

export type PdfResult = { file: File; doc: ExtractedDocument; method: "digital" | "escaneado" };
export type UploadErrorCode = "invalid" | "too_large" | "protected" | "too_long" | "ocr_unavailable" | "ocr_failed" | "no_text" | "aborted";

export class UploadError extends Error {
  constructor(
    readonly code: UploadErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "UploadError";
  }
}

/** Limites que a API de análise também aplica: falhar aqui evita enviar o que seria recusado depois. */
export const MAX_PAGES = 3000;
export const MAX_CHARS = 2_000_000;

export const MESSAGES = {
  protected: "Este PDF é protegido por senha e não pode ser lido. Remova a proteção (abra o arquivo, salve uma cópia sem senha) e envie de novo.",
  corrupted: "Não foi possível ler este PDF. O arquivo pode estar corrompido; tente abri-lo em outro programa e salvá-lo de novo.",
  tooLong: `Este documento é grande demais para a análise (máximo de ${MAX_PAGES.toLocaleString("pt-BR")} páginas ou ${(MAX_CHARS / 1_000_000).toLocaleString("pt-BR")} milhões de caracteres de texto). Envie uma parte dele.`,
} as const;

/** Rejeições do react-dropzone → texto para a pessoa. */
export function dropRejectionMessage(codes: readonly string[]): string {
  if (codes.includes("file-too-large")) return `O PDF passa do limite de ${MAX_PDF_BYTES / 1024 / 1024} MB.`;
  if (codes.includes("file-invalid-type")) return "Envie um arquivo PDF.";
  if (codes.includes("too-many-files")) return "Envie um PDF por vez.";
  return "Não foi possível usar este arquivo.";
}

type Deps = {
  extract: typeof extractPDF;
  ocr: (file: File, signal?: AbortSignal) => Promise<ExtractedDocument>;
};

async function ocrViaServer(file: File, signal?: AbortSignal): Promise<ExtractedDocument> {
  const form = new FormData();
  form.append("file", file);
  let res: Response;
  try {
    res = await fetch("/api/documentos/parse-pdf", { method: "POST", body: form, signal });
  } catch (e) {
    if (signal?.aborted || (e instanceof DOMException && e.name === "AbortError")) throw new UploadError("aborted", "Leitura cancelada.");
    throw new UploadError("ocr_unavailable", "Não foi possível falar com o servidor. Verifique a conexão e tente de novo.");
  }
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
    const message = j.error ?? "Não foi possível ler este PDF.";
    throw new UploadError(j.code === "no_text" ? "no_text" : j.code === "docling_unavailable" ? "ocr_unavailable" : "ocr_failed", message);
  }
  return (await res.json()) as ExtractedDocument;
}

export async function processPdf(
  file: File,
  opts: { signal?: AbortSignal; onPhase?: (p: { phase: "reading" | "ocr"; pages?: number }) => void; deps?: Partial<Deps> } = {},
): Promise<PdfResult> {
  const { signal, onPhase } = opts;
  const deps: Deps = { extract: extractPDF, ocr: ocrViaServer, ...opts.deps };
  const aborted = () => new UploadError("aborted", "Leitura cancelada.");

  if (file.size > MAX_PDF_BYTES) throw new UploadError("too_large", `O PDF passa do limite de ${MAX_PDF_BYTES / 1024 / 1024} MB.`);
  try {
    assertPdf(new Uint8Array(await file.slice(0, 1024).arrayBuffer())); // tipo pelos bytes, não pelo nome
  } catch (e) {
    throw new UploadError("invalid", e instanceof Error ? e.message : "O arquivo enviado não é um PDF válido.");
  }

  onPhase?.({ phase: "reading" });
  let doc: ExtractedDocument;
  try {
    doc = await deps.extract(file, { onPages: (pages) => onPhase?.({ phase: "reading", pages }) });
  } catch {
    throw new UploadError("invalid", MESSAGES.corrupted);
  }
  if (signal?.aborted) throw aborted();
  if (doc.isProtected) throw new UploadError("protected", MESSAGES.protected);

  let method: PdfResult["method"] = "digital";
  if (doc.isScanned) {
    onPhase?.({ phase: "ocr", pages: doc.pages.length });
    doc = await deps.ocr(file, signal);
    method = "escaneado";
    if (signal?.aborted) throw aborted();
  }

  const chars = doc.pages.reduce((n, p) => n + p.content.length, 0);
  if (doc.pages.length > MAX_PAGES || chars > MAX_CHARS) throw new UploadError("too_long", MESSAGES.tooLong);
  if (!doc.text.trim()) throw new UploadError("no_text", "Nenhum texto foi encontrado neste PDF.");
  return { file, doc, method };
}
